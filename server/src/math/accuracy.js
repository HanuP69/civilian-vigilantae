/**
 * @module math/accuracy
 * @description Accuracy measurement utility functions for assessing SLA forecasts and consensus categorization.
 */

/**
 * Compute the Brier Score for probability calibration.
 *
 * Brier Score = (1 / N) * Σ (p_i - o_i)^2
 * Where:
 * - p_i is the predicted probability [0, 1] of an event happening (e.g. resolving before SLA deadline)
 * - o_i is the actual binary outcome (1 for event happened/resolved on time, 0 for event didn't happen/breached)
 *
 * A score closer to 0 indicates higher forecasting calibration and accuracy.
 *
 * @param {number[]} predictions - array of predicted probabilities
 * @param {number[]} outcomes - array of actual binary outcomes (0 or 1)
 * @returns {number} Brier score value
 */
export function computeBrierScore(predictions, outcomes) {
  if (!Array.isArray(predictions) || !Array.isArray(outcomes)) {
    throw new TypeError('Predictions and outcomes must be arrays');
  }
  if (predictions.length !== outcomes.length) {
    throw new Error('Predictions and outcomes arrays must have the same length');
  }
  if (predictions.length === 0) {
    return 0;
  }

  let sumSquaredError = 0;
  for (let i = 0; i < predictions.length; i++) {
    const p = predictions[i];
    const o = outcomes[i];

    if (p < 0 || p > 1) {
      throw new RangeError(`Prediction probability must be between 0 and 1, got ${p} at index ${i}`);
    }
    if (o !== 0 && o !== 1) {
      throw new RangeError(`Outcome must be binary (0 or 1), got ${o} at index ${i}`);
    }

    sumSquaredError += Math.pow(p - o, 2);
  }

  return sumSquaredError / predictions.length;
}

/**
 * Compute the categorical classification accuracy.
 *
 * Accuracy = (Number of correct classifications) / (Total classifications)
 *
 * @param {string[]} predictions - array of predicted categories
 * @param {string[]} groundTruths - array of actual categories
 * @returns {number} accuracy ratio in [0, 1]
 */
export function computeClassificationAccuracy(predictions, groundTruths) {
  if (!Array.isArray(predictions) || !Array.isArray(groundTruths)) {
    throw new TypeError('Predictions and ground truths must be arrays');
  }
  if (predictions.length !== groundTruths.length) {
    throw new Error('Predictions and ground truths arrays must have the same length');
  }
  if (predictions.length === 0) {
    return 0;
  }

  let correct = 0;
  for (let i = 0; i < predictions.length; i++) {
    if (predictions[i] === groundTruths[i]) {
      correct++;
    }
  }

  return correct / predictions.length;
}
