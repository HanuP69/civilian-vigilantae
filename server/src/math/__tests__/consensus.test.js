import test from 'node:test';
import assert from 'node:assert';
import { computeBayesianConsensus } from '../../services/classificationService.js';

test('computeBayesianConsensus calculates prior-likelihood posteriors correctly', () => {
  // Test case 1: primary classifier has high confidence, no independent visual-audit opinion
  const primary = { category: 'pothole', confidence: 0.8 };
  const secondary = null;
  const res = computeBayesianConsensus(primary, secondary);

  assert.strictEqual(res.consensusCategory, 'pothole');
  assert.ok(res.consensusConfidence > 0.7);
  assert.ok(res.entropy < 1.5); // Low uncertainty

  // Test case 2: primary classifier is unsure, the independent visual-audit
  // opinion (second Gemini call, media-only) provides strong evidence for a
  // different category.
  const primaryUnsure = { category: 'streetlight', confidence: 0.3 };
  const visualAuditStrong = { category: 'pothole', confidence: 0.9 };
  const res2 = computeBayesianConsensus(primaryUnsure, visualAuditStrong);

  // Consensus category should shift to pothole due to strong visual-audit likelihood
  assert.strictEqual(res2.consensusCategory, 'pothole');
  assert.ok(res2.consensusConfidence > 0.5);
});
