import { getLLMClient } from '../llm/index.js';
import config from '../config/env.js';
import { retryWithBackoff } from '../utils/retryHelper.js';

const CATEGORIES = ["pothole", "water_leak", "streetlight", "waste", "road_damage", "drainage", "other"];

/**
 * Primary classifier — full reasoning pass over the citizen's text + media,
 * via Gemini 2.5 Flash's native multimodal understanding.
 */
export async function classifyWithLLM(base64Data, mimeType, text = '') {
  const mediaKind = mimeType.startsWith('video') ? 'video' : mimeType.startsWith('audio') ? 'audio' : 'image';
  const prompt = `You are a civic issue classifier for an Indian city. Analyze this ${mediaKind} and any text description to classify the issue.

${text ? `Citizen description: "${text}"` : ''}

Respond in JSON format:
{
  "category": one of ["pothole", "water_leak", "streetlight", "waste", "road_damage", "drainage", "other"],
  "severity": one of ["critical", "high", "medium", "low"],
  "confidence": number 0-1,
  "reasoning": "brief explanation",
  "evidence": "what you see in the media"
}`;

  try {
    const client = getLLMClient();
    const media = base64Data ? { mimeType, data: base64Data } : null;
    const response = await retryWithBackoff(() => client.chatWithMedia(prompt, media));
    const responseText = response.text || '';
    let parsed;
    try {
      let cleanText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const startIdx = cleanText.indexOf('{');
      const endIdx = cleanText.lastIndexOf('}');
      if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
        throw new Error('No JSON object boundaries found');
      }
      cleanText = cleanText.substring(startIdx, endIdx + 1);
      parsed = JSON.parse(cleanText);
    } catch (parseErr) {
      console.warn('[Classifier] JSON parsing failed:', parseErr.message);
      return { category: 'other', severity: 'medium', confidence: 0.5, reasoning: `JSON Parse error: ${parseErr.message}`, source: 'llm' };
    }
    return { ...parsed, source: 'llm' };
  } catch (err) {
    console.error('[Classifier] Classification failed:', err.message);
    return { category: 'other', severity: 'medium', confidence: 0.5, reasoning: `Classification failed: ${err.message}`, source: 'error' };
  }
}

/**
 * Secondary, INDEPENDENT visual-only auditor classification.
 *
 * Replaces the earlier Google Cloud Vision label-detection signal. Gemini 2.5
 * Flash is natively multimodal, so instead of calling out to a separate vision
 * API, we make a second, deliberately isolated call: the model is told to
 * reason purely from pixels (it never sees the citizen's text description),
 * which gives a genuinely independent second opinion for the Bayesian
 * consensus fusion below — the same statistical role Cloud Vision used to
 * play, without the extra GCP dependency or credential surface.
 *
 * Returns null (rather than throwing) when there's no media to audit or the
 * call fails — callers must treat a null result as "no independent signal
 * available" and fall back to the primary classifier alone.
 */
export async function classifyWithVisualAudit(base64Data, mimeType) {
  if (!base64Data) return null;

  const mediaKind = mimeType?.startsWith('video') ? 'video' : 'image';
  const prompt = `You are an independent visual auditor for a civic issue reporting system. You are shown ONLY the attached ${mediaKind} — you have not been given any citizen-written description, and you must not assume one. Identify the civic issue category using purely visual evidence.

Respond in JSON format:
{
  "category": one of ["pothole", "water_leak", "streetlight", "waste", "road_damage", "drainage", "other"],
  "confidence": number 0-1,
  "visual_evidence": ["short phrase", "short phrase"]
}
List 2-4 concrete things you actually see (e.g. "cracked asphalt", "standing water", "broken lamp post").`;

  try {
    const client = getLLMClient();
    const media = { mimeType, data: base64Data };
    const response = await retryWithBackoff(() => client.chatWithMedia(prompt, media));
    const responseText = response.text || '';
    let cleanText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const startIdx = cleanText.indexOf('{');
    const endIdx = cleanText.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
      throw new Error('No JSON object boundaries found');
    }
    cleanText = cleanText.substring(startIdx, endIdx + 1);
    const parsed = JSON.parse(cleanText);

    const category = CATEGORIES.includes(parsed.category) ? parsed.category : 'other';
    const confidence = typeof parsed.confidence === 'number' ? Math.min(Math.max(parsed.confidence, 0), 1) : 0.5;

    return {
      category,
      confidence,
      visual_evidence: Array.isArray(parsed.visual_evidence) ? parsed.visual_evidence : [],
      source: 'gemini_visual_audit',
    };
  } catch (err) {
    console.warn('[VisualAudit] Independent visual classification failed, skipping consensus fusion:', err.message);
    return null;
  }
}

/**
 * Bayesian consensus fusion between two INDEPENDENT classification opinions:
 *  - `primary`   — the main text+media-aware classifier (treated as the prior)
 *  - `secondary` — the visual-only auditor (treated as the likelihood)
 *
 * This is a 2-classifier Naive-Bayes ensemble run entirely on Gemini 2.5
 * Flash (one call sees text+media, the other sees media only), replacing the
 * earlier Gemini + Google Cloud Vision fusion. Math is unchanged: multiply
 * prior x likelihood per category, normalize to a posterior, and report
 * Shannon entropy of that posterior as an uncertainty signal.
 *
 * If no independent signal is available (no media, or the audit call
 * failed), the likelihood is uniform across categories, so the posterior
 * collapses to the primary classifier's own confidence — i.e. consensus
 * degrades gracefully to single-model classification rather than failing.
 *
 * @param {{category: string, confidence: number}} primary
 * @param {{category: string, confidence: number}|null} secondary
 */
export function computeBayesianConsensus(primary, secondary) {
  // 1. Prior — primary classifier's own confidence distribution
  const pPrimary = primary.confidence || 0.5;
  const prior = {};
  CATEGORIES.forEach(c => {
    prior[c] = c === primary.category ? pPrimary : (1 - pPrimary) / (CATEGORIES.length - 1);
  });

  // 2. Likelihood — independent visual-audit opinion (or uniform if unavailable)
  const likelihood = {};
  if (secondary && secondary.category) {
    const pSecondary = secondary.confidence ?? 0.5;
    CATEGORIES.forEach(c => {
      likelihood[c] = c === secondary.category ? pSecondary : (1 - pSecondary) / (CATEGORIES.length - 1);
    });
  } else {
    CATEGORIES.forEach(c => { likelihood[c] = 1 / CATEGORIES.length; });
  }

  // 3. Posterior Consensus
  const posterior = {};
  let sumPosterior = 0;
  CATEGORIES.forEach(c => {
    posterior[c] = prior[c] * likelihood[c];
    sumPosterior += posterior[c];
  });
  CATEGORIES.forEach(c => {
    posterior[c] = posterior[c] / sumPosterior;
  });

  // Find max posterior category
  let maxCat = CATEGORIES[0];
  let maxProb = 0;
  CATEGORIES.forEach(c => {
    if (posterior[c] > maxProb) {
      maxProb = posterior[c];
      maxCat = c;
    }
  });

  // Shannon Entropy — disagreement between the two opinions shows up as higher entropy
  let entropy = 0;
  CATEGORIES.forEach(c => {
    const p = posterior[c];
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  });

  return {
    consensusCategory: maxCat,
    consensusConfidence: maxProb,
    entropy: Math.round(entropy * 100) / 100,
    posteriorDistribution: posterior,
  };
}

export async function classifyMedia(base64Data, mimeType, text) {
  let llm;
  let visualAudit;

  const isVisualMedia = mimeType?.startsWith('image') || mimeType?.startsWith('video');

  const [llmResult, auditResult] = await Promise.allSettled([
    classifyWithLLM(base64Data, mimeType, text),
    isVisualMedia ? classifyWithVisualAudit(base64Data, mimeType) : Promise.resolve(null),
  ]);

  llm = llmResult.status === 'fulfilled' ? llmResult.value : null;
  visualAudit = auditResult.status === 'fulfilled' ? auditResult.value : null;

  // Fallback if LLM classification with media failed:
  // If we had media but the classification returned an error or failed, try a text-only classification fallback!
  if (!llm || llm.source === 'error') {
    console.warn('[Classifier] Media classification failed/errored. Retrying with text-only fallback...');
    try {
      llm = await classifyWithLLM(null, 'text/plain', text);
    } catch (fallbackErr) {
      console.error('[Classifier] Text-only fallback classification failed:', fallbackErr.message);
      llm = { category: 'other', severity: 'medium', confidence: 0.5, reasoning: 'Fallback classification failed', source: 'error' };
    }
  }

  const consensus = computeBayesianConsensus(llm, visualAudit);
  const agreement = !visualAudit || consensus.consensusCategory === llm.category;

  // Confidence threshold: check if classification is uncertain (confidence < 0.65)
  const isUncertain = consensus.consensusConfidence < 0.65;

  return {
    classificationResult: {
      category: consensus.consensusCategory,
      severity: llm.severity,
      confidence: consensus.consensusConfidence,
      reasoning: llm.reasoning,
      evidence: visualAudit?.visual_evidence?.length
        ? visualAudit.visual_evidence.join(', ')
        : (llm.evidence || 'No visual evidence detected'),
      source: llm.source,
      entropy: consensus.entropy,
      original_llm: llm,
      visual_audit: visualAudit,
      uncertain_classification: isUncertain,
    },
    // Field name kept as `cloudVisionResult` for backward DB-schema compatibility
    // (older seeded tickets and downstream consumers expect this key); it now
    // carries the Gemini visual-audit result instead of a Cloud Vision response.
    cloudVisionResult: visualAudit,
    classificationAgreement: agreement,
  };
}
