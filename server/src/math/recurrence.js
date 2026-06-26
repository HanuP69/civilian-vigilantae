/**
 * @module math/recurrence
 * @description Recurrence-risk forecasting using Weibull survival analysis.
 *
 * Groups historically resolved tickets by (ward, category), computes
 * inter-arrival intervals, fits Weibull parameters via MLE, and returns
 * a probability-ranked list of recurrence forecasts with recommended
 * actions.
 */

import { weibullCDF, weibullMLE, DEFAULT_PARAMS } from './weibull.js';

/**
 * Minimum number of inter-arrival intervals required to run MLE.
 * Below this threshold we fall back to category defaults.
 */
const MIN_DATA_POINTS = 3;

/**
 * @typedef {Object} ResolvedTicket
 * @property {Date|string} resolved_at — when the ticket was resolved
 * @property {string}      category    — issue category (e.g. 'pothole')
 * @property {string}      ward        — ward / zone identifier
 */

/**
 * @typedef {Object} RecurrenceRisk
 * @property {string} ward              — ward identifier
 * @property {string} category          — issue category
 * @property {number} probability       — P(recurrence within forecast window) in [0, 1]
 * @property {number} lambda            — Weibull scale parameter used (hours)
 * @property {number} k                 — Weibull shape parameter used
 * @property {Date}   lastResolved      — most recent resolution timestamp
 * @property {string} recommendedAction — human-readable action label
 */

/**
 * Derive a human-readable action from the recurrence probability.
 *
 * @param {number} probability — recurrence probability in [0, 1]
 * @returns {string} recommended action label
 */
function actionForProbability(probability) {
  if (probability > 0.7) return 'Urgent preventive inspection recommended';
  if (probability > 0.5) return 'Schedule routine inspection';
  if (probability > 0.3) return 'Monitor';
  return 'Low risk';
}

/**
 * Compute recurrence-risk forecasts for all (ward, category) groups in the
 * set of resolved tickets.
 *
 * **Methodology**
 * 1. Group tickets by `(ward, category)`.
 * 2. Sort each group chronologically and compute inter-arrival intervals.
 * 3. If ≥ {@link MIN_DATA_POINTS} intervals exist, fit Weibull parameters
 *    via MLE; otherwise fall back to {@link DEFAULT_PARAMS}.
 * 4. Compute `P(recurrence) = weibullCDF(hoursSinceLastResolved + forecastDays·24, λ, k)`.
 * 5. Assign a recommended action based on probability thresholds.
 * 6. Return results sorted by probability descending.
 *
 * @param {ResolvedTicket[]} resolvedTickets — historical resolved tickets
 * @param {number}           [forecastDays=14] — forecast horizon in days
 * @returns {RecurrenceRisk[]} probability-ranked recurrence forecasts
 *
 * @example
 * const risks = computeRecurrenceRisk(tickets, 14);
 * risks[0].probability; // 0.87
 * risks[0].recommendedAction; // 'Urgent preventive inspection recommended'
 */
export function computeRecurrenceRisk(resolvedTickets, forecastDays = 14) {
  if (!Array.isArray(resolvedTickets) || resolvedTickets.length === 0) {
    return [];
  }

  // ── 1. Group by (ward, category) ────────────────────────────────
  /** @type {Map<string, { ward: string, category: string, dates: Date[] }>} */
  const groups = new Map();

  for (const ticket of resolvedTickets) {
    const resolvedAt =
      ticket.resolved_at instanceof Date
        ? ticket.resolved_at
        : (ticket.resolved_at?.toDate?.() ?? new Date(ticket.resolved_at));

    // Skip tickets with invalid dates
    if (Number.isNaN(resolvedAt.getTime())) continue;

    const key = `${ticket.ward}::${ticket.category}`;
    if (!groups.has(key)) {
      groups.set(key, { ward: ticket.ward, category: ticket.category, dates: [] });
    }
    groups.get(key).dates.push(resolvedAt);
  }

  /** @type {RecurrenceRisk[]} */
  const results = [];

  const now = new Date();

  for (const { ward, category, dates } of groups.values()) {
    // Sort ascending
    dates.sort((a, b) => a.getTime() - b.getTime());

    const lastResolved = dates[dates.length - 1];

    // ── 2. Compute inter-arrival intervals (hours) ───────────────
    /** @type {number[]} */
    const intervals = [];
    for (let i = 1; i < dates.length; i++) {
      const deltaMs = dates[i].getTime() - dates[i - 1].getTime();
      const deltaH = deltaMs / (1000 * 60 * 60);
      if (deltaH > 0) {
        intervals.push(deltaH);
      }
    }

    // ── 3. Fit or fall back ──────────────────────────────────────
    let lambda;
    let k;

    if (intervals.length >= MIN_DATA_POINTS) {
      try {
        const fit = weibullMLE(intervals);
        lambda = fit.lambda;
        k = fit.k;
      } catch {
        // MLE failed — use defaults
        const def = DEFAULT_PARAMS[category] ?? DEFAULT_PARAMS.other;
        lambda = def.lambda;
        k = def.k;
      }
    } else {
      const def = DEFAULT_PARAMS[category] ?? DEFAULT_PARAMS.other;
      lambda = def.lambda;
      k = def.k;
    }

    // ── 4. Forecast probability ──────────────────────────────────
    // t = hours since last resolution + forecast window
    const hoursSinceLast = Math.max(
      (now.getTime() - lastResolved.getTime()) / (1000 * 60 * 60),
      0,
    );
    const forecastHours = forecastDays * 24;
    const F_t0 = weibullCDF(hoursSinceLast, lambda, k);
    const F_t1 = weibullCDF(hoursSinceLast + forecastHours, lambda, k);
    const probability = F_t0 >= 1 ? 1 : (F_t1 - F_t0) / (1 - F_t0);

    // ── 5. Action ────────────────────────────────────────────────
    const recommendedAction = actionForProbability(probability);

    results.push({
      ward,
      category,
      probability: Math.round(probability * 1e6) / 1e6, // 6 decimal places
      lambda: Math.round(lambda * 100) / 100,
      k: Math.round(k * 1000) / 1000,
      lastResolved,
      recommendedAction,
    });
  }

  // ── 6. Sort descending by probability ──────────────────────────
  results.sort((a, b) => b.probability - a.probability);

  return results;
}
