import { getLLMClient } from '../llm/index.js';
import config from '../config/env.js';

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
    const response = await client.chatWithMedia(prompt, media);
    const responseText = response.text || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { category: 'other', severity: 'medium', confidence: 0.5, reasoning: 'Could not parse response', source: 'llm' };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return { ...parsed, source: 'llm' };
  } catch (err) {
    console.error('[Classifier] Classification failed:', err.message);
    return { category: 'other', severity: 'medium', confidence: 0.5, reasoning: `Classification failed: ${err.message}`, source: 'error' };
  }
}

export async function classifyWithCloudVision(base64Data) {
  try {
    const vision = await import('@google-cloud/vision');
    const client = new vision.ImageAnnotatorClient();
    const [result] = await client.labelDetection({ image: { content: base64Data } });
    const labels = result.labelAnnotations || [];
    return {
      labels: labels.map(l => ({ description: l.description, score: l.score })),
      confidence: labels[0]?.score || 0,
      source: 'cloud_vision',
    };
  } catch (err) {
    console.warn('[CloudVision] Unavailable, skipping:', err.message);
    return null;
  }
}

const CATEGORIES = ["pothole", "water_leak", "streetlight", "waste", "road_damage", "drainage", "other"];

const VISION_TO_CATEGORY = {
  'Pothole': 'pothole', 'Road surface': 'pothole', 'Asphalt': 'pothole',
  'Water': 'water_leak', 'Pipe': 'water_leak', 'Leak': 'water_leak', 'Plumbing': 'water_leak',
  'Street light': 'streetlight', 'Light fixture': 'streetlight', 'Lamp': 'streetlight',
  'Waste': 'waste', 'Garbage': 'waste', 'Litter': 'waste', 'Trash': 'waste', 'Pollution': 'waste',
  'Road': 'road_damage', 'Crack': 'road_damage', 'Infrastructure': 'road_damage',
  'Drain': 'drainage', 'Sewer': 'drainage', 'Flood': 'drainage', 'Manhole': 'drainage',
};

export function computeBayesianConsensus(gemini, vision) {
  // 1. Gemini/LLM Prior
  const pGem = gemini.confidence || 0.5;
  const prior = {};
  CATEGORIES.forEach(c => {
    if (c === gemini.category) {
      prior[c] = pGem;
    } else {
      prior[c] = (1 - pGem) / (CATEGORIES.length - 1);
    }
  });

  // 2. Vision Likelihood
  const likelihood = {};
  const rawScores = {};
  CATEGORIES.forEach(c => { rawScores[c] = 0; });

  if (vision && vision.labels && vision.labels.length > 0) {
    vision.labels.forEach(label => {
      for (const [keyword, category] of Object.entries(VISION_TO_CATEGORY)) {
        if (label.description.toLowerCase().includes(keyword.toLowerCase())) {
          rawScores[category] += label.score || 0;
        }
      }
    });
    // Softmax normalization
    const exps = {};
    let sumExp = 0;
    CATEGORIES.forEach(c => {
      exps[c] = Math.exp(rawScores[c]);
      sumExp += exps[c];
    });
    CATEGORIES.forEach(c => {
      likelihood[c] = exps[c] / sumExp;
    });
  } else {
    // Uniform likelihood
    CATEGORIES.forEach(c => {
      likelihood[c] = 1 / CATEGORIES.length;
    });
  }

  // 3. Posterior Consensus
  const posterior = {};
  let sumPosterior = 0;
  CATEGORIES.forEach(c => {
    posterior[c] = prior[c] * likelihood[c];
    sumPosterior += posterior[c];
  });

  // Normalize
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

  // Shannon Entropy
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
    posteriorDistribution: posterior
  };
}

export function mapVisionLabelsToCategory(labels) {
  for (const label of labels) {
    for (const [keyword, category] of Object.entries(VISION_TO_CATEGORY)) {
      if (label.description.toLowerCase().includes(keyword.toLowerCase())) return category;
    }
  }
  return null;
}

export async function classifyMedia(base64Data, mimeType, text) {
  const [llmResult, visionResult] = await Promise.allSettled([
    classifyWithLLM(base64Data, mimeType, text),
    mimeType.startsWith('image') ? classifyWithCloudVision(base64Data) : Promise.resolve(null),
  ]);

  const llm = llmResult.status === 'fulfilled' ? llmResult.value : { category: 'other', severity: 'medium', confidence: 0.5, source: 'llm' };
  const vision = visionResult.status === 'fulfilled' ? visionResult.value : null;

  const consensus = computeBayesianConsensus(llm, vision);
  const agreement = consensus.consensusCategory === llm.category;

  return {
    classificationResult: {
      category: consensus.consensusCategory,
      severity: llm.severity,
      confidence: consensus.consensusConfidence,
      reasoning: llm.reasoning,
      evidence: llm.evidence || 'No visual evidence detected',
      source: llm.source,
      entropy: consensus.entropy,
      original_llm: llm
    },
    cloudVisionResult: vision,
    classificationAgreement: agreement,
  };
}

