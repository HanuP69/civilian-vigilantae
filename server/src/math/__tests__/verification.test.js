import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateVerificationScore, statusFromVerificationScore } from '../verification.js';

test('calculateVerificationScore calculates correct weighted output', () => {
  // Perfect confidence score: 0.4*1 + 0.2*1 + 0.2*1 + 0.2*1 = 1.0 (100)
  let score = calculateVerificationScore({
    aiConfidence: 1.0,
    reporterTrust: 1.0,
    nearbyEvidence: 1.0,
    communityVotes: 1.0,
  });
  assert.equal(score, 100);

  // Baseline/Neutral: 0.4*0.5 + 0.2*0.5 + 0.2*0.0 + 0.2*0.5 = 0.2 + 0.1 + 0 + 0.1 = 0.40 (40)
  score = calculateVerificationScore({
    aiConfidence: 0.5,
    reporterTrust: 0.5,
    nearbyEvidence: 0.0,
    communityVotes: 0.5,
  });
  assert.equal(score, 40);

  // High dispute: 0.4*0.8 + 0.2*0.2 + 0.2*0.0 + 0.2*0.1 = 0.32 + 0.04 + 0.0 + 0.02 = 0.38 (38)
  score = calculateVerificationScore({
    aiConfidence: 0.8,
    reporterTrust: 0.2,
    nearbyEvidence: 0.0,
    communityVotes: 0.1,
  });
  assert.equal(score, 38);
});

test('statusFromVerificationScore maps status correctly to boundaries', () => {
  assert.equal(statusFromVerificationScore(80), 'verified');
  assert.equal(statusFromVerificationScore(70), 'verified');
  assert.equal(statusFromVerificationScore(65), 'reported');
  assert.equal(statusFromVerificationScore(40), 'reported');
  assert.equal(statusFromVerificationScore(35), 'needs_review');
  assert.equal(statusFromVerificationScore(20), 'needs_review');
  assert.equal(statusFromVerificationScore(15), 'disputed');
  assert.equal(statusFromVerificationScore(0), 'disputed');
});
