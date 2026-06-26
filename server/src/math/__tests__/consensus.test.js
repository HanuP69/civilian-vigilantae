import test from 'node:test';
import assert from 'node:assert';
import { computeBayesianConsensus } from '../../services/classificationService.js';

test('computeBayesianConsensus calculates prior-likelihood posteriors correctly', () => {
  // Test case 1: Gemini has high confidence, no vision result
  const gemini = { category: 'pothole', confidence: 0.8 };
  const vision = null;
  const res = computeBayesianConsensus(gemini, vision);
  
  assert.strictEqual(res.consensusCategory, 'pothole');
  assert.ok(res.consensusConfidence > 0.7);
  assert.ok(res.entropy < 1.5); // Low uncertainty

  // Test case 2: Gemini is unsure, Cloud Vision provides strong evidence for a category
  const geminiUnsure = { category: 'streetlight', confidence: 0.3 };
  const visionStrong = {
    labels: [
      { description: 'Pothole', score: 2.0 },
      { description: 'Asphalt', score: 1.0 }
    ]
  };
  const res2 = computeBayesianConsensus(geminiUnsure, visionStrong);
  
  // Consensus category should shift to pothole due to strong vision likelihood
  assert.strictEqual(res2.consensusCategory, 'pothole');
  assert.ok(res2.consensusConfidence > 0.5);
});
