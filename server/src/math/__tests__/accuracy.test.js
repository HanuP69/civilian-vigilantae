import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBrierScore, computeClassificationAccuracy } from '../accuracy.js';

test('computeBrierScore calculates values correctly', () => {
  // Case 1: Perfect prediction calibration
  // Predictions equal outcomes: (1-1)^2 = 0, (0-0)^2 = 0
  let score = computeBrierScore([1.0, 0.0, 1.0], [1, 0, 1]);
  assert.strictEqual(score, 0);

  // Case 2: Worst prediction calibration
  // Predictions are complete opposites: (0-1)^2 = 1, (1-0)^2 = 1
  score = computeBrierScore([0.0, 1.0], [1, 0]);
  assert.strictEqual(score, 1.0);

  // Case 3: Standard calibration case
  // predictions = [0.8, 0.2, 0.4]
  // outcomes = [1, 0, 1]
  // errors = (0.8 - 1)^2 + (0.2 - 0)^2 + (0.4 - 1)^2
  //        = 0.04 + 0.04 + 0.36 = 0.44
  // Mean = 0.44 / 3 = 0.146666...
  score = computeBrierScore([0.8, 0.2, 0.4], [1, 0, 1]);
  assert.ok(Math.abs(score - 0.14666666666666667) < 1e-9);

  // Case 4: Empty input
  score = computeBrierScore([], []);
  assert.strictEqual(score, 0);
});

test('computeBrierScore handles validation constraints', () => {
  // Array type validation
  assert.throws(() => computeBrierScore(null, []), TypeError);
  assert.throws(() => computeBrierScore([], 'not-array'), TypeError);

  // Length check
  assert.throws(() => computeBrierScore([0.5], [1, 0]), Error);

  // Range checks
  assert.throws(() => computeBrierScore([-0.1], [1]), RangeError);
  assert.throws(() => computeBrierScore([1.2], [1]), RangeError);

  // Binary outcome check
  assert.throws(() => computeBrierScore([0.5], [2]), RangeError);
  assert.throws(() => computeBrierScore([0.5], [-1]), RangeError);
});

test('computeClassificationAccuracy calculates ratios correctly', () => {
  // 100% agreement
  let acc = computeClassificationAccuracy(['pothole', 'waste'], ['pothole', 'waste']);
  assert.strictEqual(acc, 1.0);

  // 50% agreement
  acc = computeClassificationAccuracy(['pothole', 'drainage'], ['pothole', 'waste']);
  assert.strictEqual(acc, 0.5);

  // 0% agreement
  acc = computeClassificationAccuracy(['other', 'streetlight'], ['pothole', 'waste']);
  assert.strictEqual(acc, 0.0);

  // Empty input
  acc = computeClassificationAccuracy([], []);
  assert.strictEqual(acc, 0.0);
});

test('computeClassificationAccuracy checks validation constraints', () => {
  assert.throws(() => computeClassificationAccuracy(null, []), TypeError);
  assert.throws(() => computeClassificationAccuracy([], {}), TypeError);
  assert.throws(() => computeClassificationAccuracy(['pothole'], []), Error);
});
