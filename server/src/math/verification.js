/**
 * @module math/verification
 * @description Multi-agent verification score computations blending AI confidence,
 * reporter trust, spatial cluster evidence, and community voting history.
 */

import { haversine } from './haversine.js';

// ─── A/B Testing Weights Calibration ────────────────────────────────
/**
 * Calibration weights for log-odds Bayesian updates.
 * Control (standard updating) vs. Variant configurations.
 */
export const AB_TEST_WEIGHTS = {
  control: { wAi: 1.0, wTrust: 1.0, wNearby: 1.0, wVotes: 1.0 },
  variantA: { wAi: 0.4, wTrust: 0.3, wNearby: 0.2, wVotes: 0.1 },
  variantB: { wAi: 0.5, wTrust: 0.25, wNearby: 0.15, wVotes: 0.1 }
};

const activeVariantName = process.env.VERIFICATION_AB_VARIANT || 'control';
export const activeWeights = AB_TEST_WEIGHTS[activeVariantName] || AB_TEST_WEIGHTS.control;

/**
 * Calculates nearby evidence index using a spatial decay function.
 * S(d) = sum(e^(-d_i / 100)), clamped to [0, 1].
 *
 * @param {number} newLat
 * @param {number} newLng
 * @param {Array<{lat: number, lng: number}>} neighbors
 * @returns {number} nearby evidence index in [0, 1]
 */
export function calculateNearbyEvidence(newLat, newLng, neighbors) {
  if (!neighbors || neighbors.length === 0) return 0.0;
  let sumDecay = 0;
  for (const n of neighbors) {
    if (n && n.lat !== undefined && n.lng !== undefined) {
      const d = haversine(Number(newLat), Number(newLng), Number(n.lat), Number(n.lng));
      sumDecay += Math.exp(-d / 100); // 100m spatial decay factor
    } else {
      sumDecay += 0.5; // fallback
    }
  }
  return Math.min(sumDecay / 5, 1.0);
}

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
 * @param {string} [params.variantName]  - Active A/B test variant name
 * @returns {number} Verification score in [0, 100]
 */
export function calculateVerificationScore({
  aiConfidence,
  reporterTrust,
  nearbyEvidence,
  communityVotes,
  variantName = activeVariantName
}) {
  const weights = AB_TEST_WEIGHTS[variantName] || AB_TEST_WEIGHTS.control;
  const { wAi, wTrust, wNearby, wVotes } = weights;

  // Clamp variables to prevent infinity/NaN in log-odds calculations
  const ai = Math.min(Math.max(aiConfidence ?? 0.5, 0.1), 0.9);
  const rep = Math.min(Math.max(reporterTrust ?? 0.5, 0.1), 0.9);
  const near = Math.min(Math.max(nearbyEvidence ?? 0.0, 0.0), 1.0);
  
  // 1. Initial prior probability based on AI confidence
  const prior = ai;
  const l0 = Math.log(prior / (1 - prior));

  // 2. Update with Reporter Trust likelihood
  const lReporter = Math.log(rep / (1 - rep));

  // 3. Update with Nearby Evidence (spatial density)
  // Maps nearbyEvidence [0, 1] to a likelihood ratio between [0.3, 0.7] remapped from 0.5
  const pNear = 0.5 + 0.4 * (near - 0.5);
  const lNearby = Math.log(pNear / (1 - pNear));

  // 4. Update with Community votes (only if votes exist)
  let lComm = 0;
  if (communityVotes !== null && communityVotes !== undefined) {
    const comm = Math.min(Math.max(communityVotes, 0.1), 0.9);
    lComm = Math.log(comm / (1 - comm));
  }

  // Final weighted log-odds
  const lFinal = wAi * l0 + wTrust * lReporter + wNearby * lNearby + wVotes * lComm;

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
