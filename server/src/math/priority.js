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
const W1 = 0.20; // Severity visual weight
const W2 = 0.25; // Report volume weight
const W3 = 0.20; // Community verification weight
const W4 = 0.20; // SLA urgency weight
const W5 = 0.15; // Safety criticality weight

// ─── Severity mapping ───────────────────────────────────────────────
const SEVERITY_MAP = {
  critical: 1.0,
  high: 0.75,
  medium: 0.5,
  low: 0.25,
};

/**
 * Check safety-critical status using a dynamic Risk Matrix.
 * Factors in Category Base Risk, Night-time environment, and description keywords.
 *
 * @param {string} category
 * @param {string} description
 * @param {string|Date|null} createdAt
 * @returns {number} Safety coefficient (0.5, 0.75, or 1.0)
 */
export function computeSafetyRisk(category, description = '', createdAt = null) {
  // 1. Base Category Risk
  let risk = 0.3;
  const cat = (category || '').toLowerCase();
  if (['water_leak', 'drainage', 'road_damage'].includes(cat)) {
    risk = 0.8;
  } else if (['streetlight', 'electricity', 'electrical'].includes(cat)) {
    risk = 0.5;
  } else if (cat === 'pothole') {
    risk = 0.6;
  }

  // 2. Night multiplier (Hour < 6 or >= 18)
  const date = createdAt ? new Date(createdAt) : new Date();
  const hour = date.getHours();
  const isNight = hour < 6 || hour >= 18;

  if (isNight) {
    // Streetlight failures and electricity grids are extremely risky at night
    if (['streetlight', 'electricity', 'electrical'].includes(cat)) {
      risk += 0.4;
    }
  }

  // 3. Keyword safety boost
  const text = (description || '').toLowerCase();
  const SAFETY_KEYWORDS = [
    'wire', 'electric', 'shock', 'hazard', 'danger', 'fire', 
    'flood', 'injury', 'accident', 'emergency', 'cave-in', 'open manhole', 'exposed', 'dark', 'night', 'blindspot'
  ];
  const matchCount = SAFETY_KEYWORDS.filter(kw => text.includes(kw)).length;
  if (matchCount >= 2) {
    risk += 0.3;
  } else if (matchCount === 1) {
    risk += 0.15;
  }

  // Clamp risk score to [0, 1]
  const finalRisk = Math.min(Math.max(risk, 0), 1);

  // Return risk coefficient thresholds
  if (finalRisk >= 0.7) return 1.0;
  if (finalRisk >= 0.4) return 0.75;
  return 0.5;
}

/**
 * Check if an issue is safety-critical based on its category or description text.
 * Backwards compatibility wrapper.
 *
 * @param {string} category
 * @param {string} description
 * @returns {boolean}
 */
export function checkIfSafetyCritical(category, description = '') {
  return computeSafetyRisk(category, description) >= 0.7;
}

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
  createdAt,
}) {
  // ── 1. Severity (S_vis) ──────────────────────────────────────────
  const sVis = SEVERITY_MAP[severity] ?? SEVERITY_MAP.medium;

  // ── 2. Report volume — log(N) (single report = zero bonus) ──────
  const maxExpectedReports = 100;
  const logReports = Math.log(Math.max(reportCount || 1, 1));
  const logNorm = logReports / Math.log(maxExpectedReports);
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

  // ── 5. Safety criticality (dynamic Risk Matrix) ─────────────────
  const rSafety = computeSafetyRisk(category, description, createdAt);

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
 * @param {Object} input
 * @returns {{ score: number, breakdown: { severity: number, volume: number, verification: number, sla_urgency: number, safety: number } }}
 */
export function computePriorityWithBreakdown(input) {
  const sVis = SEVERITY_MAP[input.severity] ?? SEVERITY_MAP.medium;

  const maxExpectedReports = 100;
  const logReports = Math.log(Math.max(input.reportCount || 1, 1));
  const logNorm = logReports / Math.log(maxExpectedReports);
  const nReports = Math.min(logNorm, 1);

  const up = Math.max(input.verificationUp || 0, 0);
  const down = Math.max(input.verificationDown || 0, 0);
  const rawRatio = (up - down) / (up + down + 1);
  const vRatio = (rawRatio + 1) / 2;

  const elapsed = Math.max(input.elapsedHours || 0, 0);
  const sla = input.slaHours > 0 ? input.slaHours : 1;
  const slaRatio = Math.min(elapsed / sla, 1);

  // Dynamic Risk Matrix
  const rSafety = computeSafetyRisk(input.category, input.description, input.createdAt);

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
