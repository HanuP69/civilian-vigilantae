/**
 * @module math/verification
 * @description Multi-agent verification score computations blending AI confidence,
 * reporter trust, spatial cluster evidence, and community voting history.
 */

/**
 * Calculate the consolidated verification score.
 * Formula:
 *   Score = 40% AI confidence + 20% reporter trust + 20% nearby evidence + 20% community votes.
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
  const ai = Math.min(Math.max(aiConfidence ?? 0.5, 0), 1);
  const rep = Math.min(Math.max(reporterTrust ?? 0.5, 0), 1);
  const near = Math.min(Math.max(nearbyEvidence ?? 0.0, 0), 1);
  const comm = Math.min(Math.max(communityVotes ?? 0.5, 0), 1);

  const score = (0.40 * ai + 0.20 * rep + 0.20 * near + 0.20 * comm) * 100;
  return Math.round(score * 100) / 100; // Round to 2 decimal places
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
