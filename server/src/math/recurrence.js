/**
 * @module math/recurrence
 * @description Recurrence-risk forecasting using Weibull survival analysis and causal factor modeling.
 */

import { weibullCDF, weibullMLE, DEFAULT_PARAMS } from './weibull.js';

const MIN_DATA_POINTS = 3;

/**
 * Compute recurrence-risk forecasts for all (ward, category) groups in the
 * set of resolved tickets, incorporating causal factors (weather, repair quality, growth rate).
 *
 * @param {Array} resolvedTickets — historical resolved tickets
 * @param {number}           [forecastDays=14] — forecast horizon in days
 * @returns {Array} probability-ranked recurrence forecasts
 */
export function computeRecurrenceRisk(resolvedTickets, forecastDays = 14) {
  if (!Array.isArray(resolvedTickets) || resolvedTickets.length === 0) {
    return [];
  }

  // 1. Group by (ward, category)
  const groups = new Map();

  for (const ticket of resolvedTickets) {
    const resolvedAt =
      ticket.resolved_at instanceof Date
        ? ticket.resolved_at
        : (ticket.resolved_at?.toDate?.() ?? new Date(ticket.resolved_at));

    if (Number.isNaN(resolvedAt.getTime())) continue;

    const key = `${ticket.ward}::${ticket.category}`;
    if (!groups.has(key)) {
      groups.set(key, { ward: ticket.ward, category: ticket.category, tickets: [] });
    }
    groups.get(key).tickets.push({
      resolvedAt,
      verification_score: ticket.verification_score
    });
  }

  const results = [];
  const now = new Date();

  for (const { ward, category, tickets: groupTickets } of groups.values()) {
    groupTickets.sort((a, b) => a.resolvedAt.getTime() - b.resolvedAt.getTime());

    const lastResolved = groupTickets[groupTickets.length - 1].resolvedAt;

    // 2. Compute inter-arrival intervals
    const intervals = [];
    for (let i = 1; i < groupTickets.length; i++) {
      const deltaMs = groupTickets[i].resolvedAt.getTime() - groupTickets[i - 1].resolvedAt.getTime();
      const deltaH = deltaMs / (1000 * 60 * 60);
      if (deltaH > 0) {
        intervals.push(deltaH);
      }
    }

    // 3. Fit or fall back
    let lambda;
    let k;

    if (intervals.length >= MIN_DATA_POINTS) {
      try {
        const fit = weibullMLE(intervals);
        lambda = fit.lambda;
        k = fit.k;
      } catch {
        const def = DEFAULT_PARAMS[category] ?? DEFAULT_PARAMS.other;
        lambda = def.lambda;
        k = def.k;
      }
    } else {
      const def = DEFAULT_PARAMS[category] ?? DEFAULT_PARAMS.other;
      lambda = def.lambda;
      k = def.k;
    }

    // 4. Base Forecast probability
    const hoursSinceLast = Math.max(
      (now.getTime() - lastResolved.getTime()) / (1000 * 60 * 60),
      0,
    );
    const forecastHours = forecastDays * 24;
    const F_t0 = weibullCDF(hoursSinceLast, lambda, k);
    const F_t1 = weibullCDF(hoursSinceLast + forecastHours, lambda, k);
    const baseProbability = F_t0 >= 1 ? 1 : (F_t1 - F_t0) / (1 - F_t0);

    // 5. Causal Factors Adjustment
    let multiplier = 1.0;

    // 5a. Weather / Seasonality (Lucknow, India climate)
    const currentMonth = now.getMonth(); // 0-11
    if (currentMonth >= 6 && currentMonth <= 8) { // Monsoon (Jul-Sep)
      if (category === 'drainage') multiplier += 0.35;
      if (category === 'pothole' || category === 'road_damage') multiplier += 0.30;
    } else if (currentMonth >= 3 && currentMonth <= 5) { // Summer (Apr-Jun)
      if (category === 'streetlight') multiplier += 0.20;
      if (category === 'waste') multiplier += 0.15;
    }

    // 5b. Repair Quality (based on verification score of resolved tickets in the group)
    const validScores = groupTickets.map(gt => gt.verification_score).filter(s => s != null);
    if (validScores.length > 0) {
      const avgVerification = validScores.reduce((sum, s) => sum + s, 0) / validScores.length;
      // High consensus resolution indicates high repair quality, reducing recurrence risk
      const qualityFactor = 1 - (avgVerification - 50) / 100;
      multiplier *= Math.max(0.5, Math.min(1.5, qualityFactor));
    }

    // 5c. Swarm Growth Rate (Recent inter-arrival velocity)
    if (intervals.length > 0) {
      const recentIntervals = intervals.slice(-3);
      const avgRecentInterval = recentIntervals.reduce((sum, val) => sum + val, 0) / recentIntervals.length;
      if (avgRecentInterval < 24) {
        multiplier *= 1.25; // Increase risk by 25% for fast swarms
      }
    }

    const finalProbability = Math.max(0.01, Math.min(0.99, baseProbability * multiplier));

    // recommended action
    let recommendedAction = 'Low risk';
    if (finalProbability > 0.7) recommendedAction = 'Urgent preventive inspection recommended';
    else if (finalProbability > 0.5) recommendedAction = 'Schedule routine inspection';
    else if (finalProbability > 0.3) recommendedAction = 'Monitor';

    results.push({
      ward,
      category,
      probability: Math.round(finalProbability * 1e6) / 1e6,
      lambda: Math.round(lambda * 100) / 100,
      k: Math.round(k * 1000) / 1000,
      lastResolved,
      recommendedAction,
    });
  }

  results.sort((a, b) => b.probability - a.probability);
  return results;
}
