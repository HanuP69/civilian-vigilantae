import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateVerificationScore, statusFromVerificationScore } from '../verification.js';

test('calculateVerificationScore calculates correct weighted output', () => {
  // Perfect confidence score: Bayesian consensus log-odds
  let score = calculateVerificationScore({
    aiConfidence: 1.0,
    reporterTrust: 1.0,
    nearbyEvidence: 1.0,
    communityVotes: 1.0,
  });
  assert.equal(score, 99.94);

  // Baseline/Neutral:
  score = calculateVerificationScore({
    aiConfidence: 0.5,
    reporterTrust: 0.5,
    nearbyEvidence: 0.0,
    communityVotes: 0.5,
  });
  assert.equal(score, 30);

  // High dispute:
  score = calculateVerificationScore({
    aiConfidence: 0.8,
    reporterTrust: 0.2,
    nearbyEvidence: 0.0,
    communityVotes: 0.1,
  });
  assert.equal(score, 4.55);
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
