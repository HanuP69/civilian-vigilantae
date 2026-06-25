import { getLLMClient } from '../llm/index.js';
import config from '../config/env.js';

export async function classifyWithGemini(base64Data, mimeType, text = '') {
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

const VISION_TO_CATEGORY = {
  'Pothole': 'pothole', 'Road surface': 'pothole', 'Asphalt': 'pothole',
  'Water': 'water_leak', 'Pipe': 'water_leak', 'Leak': 'water_leak', 'Plumbing': 'water_leak',
  'Street light': 'streetlight', 'Light fixture': 'streetlight', 'Lamp': 'streetlight',
  'Waste': 'waste', 'Garbage': 'waste', 'Litter': 'waste', 'Trash': 'waste', 'Pollution': 'waste',
  'Road': 'road_damage', 'Crack': 'road_damage', 'Infrastructure': 'road_damage',
  'Drain': 'drainage', 'Sewer': 'drainage', 'Flood': 'drainage', 'Manhole': 'drainage',
};

export function mapVisionLabelsToCategory(labels) {
  for (const label of labels) {
    for (const [keyword, category] of Object.entries(VISION_TO_CATEGORY)) {
      if (label.description.toLowerCase().includes(keyword.toLowerCase())) return category;
    }
  }
  return null;
}

export async function classifyMedia(base64Data, mimeType, text) {
  const [geminiResult, visionResult] = await Promise.allSettled([
    classifyWithGemini(base64Data, mimeType, text),
    mimeType.startsWith('image') ? classifyWithCloudVision(base64Data) : Promise.resolve(null),
  ]);

  const gemini = geminiResult.status === 'fulfilled' ? geminiResult.value : { category: 'other', severity: 'medium', confidence: 0.5, source: 'gemini' };
  const vision = visionResult.status === 'fulfilled' ? visionResult.value : null;

  let agreement = true;
  if (vision && vision.labels?.length > 0) {
    const visionCategory = mapVisionLabelsToCategory(vision.labels);
    if (visionCategory && visionCategory !== gemini.category) {
      agreement = false;
    }
  }

  return {
    classificationResult: gemini,
    cloudVisionResult: vision,
    classificationAgreement: agreement,
  };
}
