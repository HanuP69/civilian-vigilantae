/**
 * @module math/verification
 * @description Multi-agent verification score computations blending AI confidence,
 * reporter trust, spatial cluster evidence, and community voting history.
 */

/**
 * Calculate the consolidated verification score.
 * Uses exact Bayesian updating in log-odds space:
 *   Posterior Log-Odds = Prior Log-Odds (AI) + Reporter Trust Log-Odds + Proximity Density Log-Odds + Community Votes Log-Odds.
 *
 * @param {Object} params
 * @param {number} params.aiConfidence    - AI categorization confidence in [0, 1]
 * @param {number} params.reporterTrust   - User reputation trust score in [0, 1]
 * @param {number} params.nearbyEvidence  - Spatial cluster proximity density indicator in [0, 1]
 * @param {number} params.communityVotes - Net community vote ratio in [0, 1]
 * @returns {number} Verification score in [0, 100]
 */
export function calculateVerificationScore({
  aiConfidence,
  reporterTrust,
  nearbyEvidence,
  communityVotes,
}) {
  // Clamp variables to prevent infinity/NaN in log-odds calculations
  const ai = Math.min(Math.max(aiConfidence ?? 0.5, 0.1), 0.9);
  const rep = Math.min(Math.max(reporterTrust ?? 0.5, 0.1), 0.9);
  const near = Math.min(Math.max(nearbyEvidence ?? 0.0, 0.0), 1.0);
  const comm = Math.min(Math.max(communityVotes ?? 0.5, 0.1), 0.9);

  // 1. Initial prior probability based on AI confidence
  const prior = ai;
  const l0 = Math.log(prior / (1 - prior));

  // 2. Update with Reporter Trust likelihood
  const lReporter = Math.log(rep / (1 - rep));

  // 3. Update with Nearby Evidence (spatial density)
  // Maps nearbyEvidence [0, 1] to a likelihood ratio between [0.3, 0.7] remapped from 0.5
  const pNear = 0.5 + 0.4 * (near - 0.5);
  const lNearby = Math.log(pNear / (1 - pNear));

  // 4. Update with Community votes
  const lComm = Math.log(comm / (1 - comm));

  // Final log-odds
  const lFinal = l0 + lReporter + lNearby + lComm;

  // Convert back to probability
  const pFinal = 1 / (1 + Math.exp(-lFinal));

  return Math.round(pFinal * 10000) / 100; // Return score in [0, 100] (2 decimal places)
}

/**
 * Determine ticket status from verification score.
 * Thresholds:
 *   - verified: Score >= 70
 *   - reported: 40 <= Score < 70
 *   - needs_review: 20 <= Score < 40
 *   - disputed: Score < 20
 *
 * @param {number} score - Verification score in [0, 100]
 * @returns {'verified'|'reported'|'needs_review'|'disputed'} status
 */
export function statusFromVerificationScore(score) {
  if (score >= 70) return 'verified';
  if (score >= 40) return 'reported';
  if (score >= 20) return 'needs_review';
  return 'disputed';
}
