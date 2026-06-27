/**
 * @module math/priority
 * @description Dynamic priority scoring for civic issues.
 *
 * The score blends five dimensions into a single 0–100 value so that
 * the most urgent, validated, and safety-critical issues surface first.
 *
 * ```
 * P(t) = w1·S_vis + w2·log(1+N) + w3·V_ratio + w4·SLA_ratio + w5·R_safety
 * ```
 */

// ─── Weights ─────────────────────────────────────────────────────────
/** @type {number} Severity visual weight */
const W1 = 0.20;
/** @type {number} Report volume weight */
const W2 = 0.25;
/** @type {number} Community verification weight */
const W3 = 0.20;
/** @type {number} SLA urgency weight */
const W4 = 0.20;
/** @type {number} Safety criticality weight */
const W5 = 0.15;

// ─── Severity mapping ───────────────────────────────────────────────
/** @type {Record<string, number>} */
const SEVERITY_MAP = {
  critical: 1.0,
  high: 0.75,
  medium: 0.5,
  low: 0.25,
};

// ─── Safety-critical categories ──────────────────────────────────────
/** @type {Set<string>} Categories that pose direct public safety risks. */
const SAFETY_CRITICAL = new Set(['water_leak', 'drainage', 'road_damage']);

const SAFETY_KEYWORDS = [
  'wire', 'electric', 'shock', 'hazard', 'danger', 'fire', 
  'flood', 'injury', 'accident', 'emergency', 'cave-in', 'open manhole', 'exposed'
];

/**
 * Check if an issue is safety-critical based on its category or description text.
 *
 * @param {string} category
 * @param {string} description
 * @returns {boolean}
 */
export function checkIfSafetyCritical(category, description = '') {
  if (SAFETY_CRITICAL.has(category)) return true;

  const text = (description || '').toLowerCase();
  const matchCount = SAFETY_KEYWORDS.filter(kw => text.includes(kw)).length;
  return matchCount >= 2;
}

/**
 * @typedef {Object} PriorityInput
 * @property {string} severity         — one of 'critical' | 'high' | 'medium' | 'low'
 * @property {number} reportCount      — total number of reports for this issue / cluster
 * @property {number} verificationUp   — upvotes / confirmations
 * @property {number} verificationDown — downvotes / refutations
 * @property {number} elapsedHours     — hours since the issue was first reported
 * @property {number} slaHours         — target resolution time in hours
 * @property {string} category         — issue category (e.g. 'pothole')
 * @property {string} [description]    — optional report description text
 */

/**
 * Compute a priority score for a civic issue.
 *
 * The returned value is clamped and scaled to [0, 100].
 */
export function computePriority({
  severity,
  reportCount,
  verificationUp,
  verificationDown,
  elapsedHours,
  slaHours,
  category,
  description,
}) {
  // ── 1. Severity (S_vis) ──────────────────────────────────────────
  const sVis = SEVERITY_MAP[severity] ?? SEVERITY_MAP.medium;

  // ── 2. Report volume — log(1 + N) ───────────────────────────────
  const maxExpectedReports = 100;
  const logReports = Math.log(1 + Math.max(reportCount || 0, 0));
  const logNorm = logReports / Math.log(1 + maxExpectedReports);
  const nReports = Math.min(logNorm, 1);

  // ── 3. Verification ratio ───────────────────────────────────────
  const up = Math.max(verificationUp || 0, 0);
  const down = Math.max(verificationDown || 0, 0);
  const rawRatio = (up - down) / (up + down + 1);
  const vRatio = (rawRatio + 1) / 2;

  // ── 4. SLA urgency ──────────────────────────────────────────────
  const elapsed = Math.max(elapsedHours || 0, 0);
  const sla = slaHours > 0 ? slaHours : 1;
  const slaRatio = Math.min(elapsed / sla, 1);

  // ── 5. Safety criticality (dynamic) ─────────────────────────────
  const rSafety = checkIfSafetyCritical(category, description) ? 1.0 : 0.5;

  // ── Combine ─────────────────────────────────────────────────────
  const raw =
    W1 * sVis +
    W2 * nReports +
    W3 * vRatio +
    W4 * slaRatio +
    W5 * rSafety;

  return Math.min(Math.max(raw, 0), 1) * 100;
}

/**
 * Compute priority score along with its individual weighted components.
 *
 * @param {PriorityInput} input
 * @returns {{ score: number, breakdown: { severity: number, volume: number, verification: number, sla_urgency: number, safety: number } }}
 */
export function computePriorityWithBreakdown(input) {
  const sVis = SEVERITY_MAP[input.severity] ?? SEVERITY_MAP.medium;

  const maxExpectedReports = 100;
  const logReports = Math.log(1 + Math.max(input.reportCount || 0, 0));
  const logNorm = logReports / Math.log(1 + maxExpectedReports);
  const nReports = Math.min(logNorm, 1);

  const up = Math.max(input.verificationUp || 0, 0);
  const down = Math.max(input.verificationDown || 0, 0);
  const rawRatio = (up - down) / (up + down + 1);
  const vRatio = (rawRatio + 1) / 2;

  const elapsed = Math.max(input.elapsedHours || 0, 0);
  const sla = input.slaHours > 0 ? input.slaHours : 1;
  const slaRatio = Math.min(elapsed / sla, 1);

  const rSafety = checkIfSafetyCritical(input.category, input.description) ? 1.0 : 0.5;

  // Compute continuous score first (matches computePriority exactly)
  const raw = W1 * sVis + W2 * nReports + W3 * vRatio + W4 * slaRatio + W5 * rSafety;
  const score = Math.round(Math.min(Math.max(raw, 0), 1) * 100);

  // Breakdown as rounded weighted contributions (informational only)
  const severityVal = Math.round(W1 * sVis * 100);
  const volumeVal = Math.round(W2 * nReports * 100);
  const verificationVal = Math.round(W3 * vRatio * 100);
  const slaUrgencyVal = Math.round(W4 * slaRatio * 100);
  const safetyVal = Math.round(W5 * rSafety * 100);

  return {
    score,
    breakdown: {
      severity: severityVal,
      volume: volumeVal,
      verification: verificationVal,
      sla_urgency: slaUrgencyVal,
      safety: safetyVal,
    },
  };
}
