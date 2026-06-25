import test from 'node:test';
import assert from 'node:assert';
import { haversine, haversineNormalized } from '../haversine.js';

test('haversine distance', () => {
  const d = haversine(18.9398, 72.8355, 18.9220, 72.8347);
  assert.ok(d > 1900 && d < 2100);
});

test('haversine same point', () => {
  const d = haversine(18.9398, 72.8355, 18.9398, 72.8355);
  assert.strictEqual(d, 0);
});

test('haversineNormalized logic', () => {
  const n = haversineNormalized(18.9398, 72.8355, 18.9220, 72.8347, 500);
  assert.strictEqual(n, 1);

  const n2 = haversineNormalized(18.9398, 72.8355, 18.9398, 72.8355, 500);
  assert.strictEqual(n2, 0);

  assert.throws(() => haversineNormalized(0, 0, 0, 0, 0), RangeError);
});
