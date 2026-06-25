import test from 'node:test';
import assert from 'node:assert';
import { weibullCDF, weibullPDF, weibullHazard, weibullMLE } from '../weibull.js';

test('weibull functions basic calculations', () => {
  const cdf = weibullCDF(48, 48, 1.8);
  assert.ok(cdf > 0.60 && cdf < 0.65);

  const pdf = weibullPDF(48, 48, 1.8);
  assert.ok(pdf > 0);

  const haz = weibullHazard(48, 48, 1.8);
  assert.ok(haz > 0);

  assert.throws(() => weibullCDF(10, 0, 1.8), RangeError);
  assert.throws(() => weibullCDF(10, 48, -1), RangeError);
});

test('weibullMLE estimation convergence', () => {
  const times = [12, 18, 24, 30, 36, 42, 48];
  const fit = weibullMLE(times);
  assert.ok(fit.lambda > 25 && fit.lambda < 40);
  assert.ok(fit.k > 1);
});
