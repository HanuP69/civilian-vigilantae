import test from 'node:test';
import assert from 'node:assert';
import { weibullCDF, weibullPDF, weibullHazard, weibullMLE, weibullConditionalProbability } from '../weibull.js';

test('weibull functions basic calculations', () => {
  const cdf = weibullCDF(48, 48, 1.8);
  assert.ok(cdf > 0.60 && cdf < 0.65);

  const pdf = weibullPDF(48, 48, 1.8);
  assert.ok(pdf > 0);

  const haz = weibullHazard(48, 48, 1.8);
  assert.ok(haz > 0);

  const cond = weibullConditionalProbability(24, 48, 48, 1.8);
  assert.ok(cond > 0 && cond < 1);
  // Conditional probability of resolving by 48 given survival to 24
  // P(T <= 48 | T > 24) = (F(48) - F(24)) / (1 - F(24))
  const f24 = weibullCDF(24, 48, 1.8);
  const f48 = weibullCDF(48, 48, 1.8);
  const expected = (f48 - f24) / (1 - f24);
  assert.ok(Math.abs(cond - expected) < 1e-9);

  assert.throws(() => weibullCDF(10, 0, 1.8), RangeError);
  assert.throws(() => weibullCDF(10, 48, -1), RangeError);
});

test('weibullMLE estimation convergence', () => {
  const times = [12, 18, 24, 30, 36, 42, 48];
  const fit = weibullMLE(times);
  assert.ok(fit.lambda > 25 && fit.lambda < 40);
  assert.ok(fit.k > 1);
});

