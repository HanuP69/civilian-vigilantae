import test from 'node:test';
import assert from 'node:assert';
import { computePriority } from '../priority.js';

test('priority boundary conditions', () => {
  const pMin = computePriority({
    severity: 'low',
    reportCount: 0,
    verificationUp: 0,
    verificationDown: 100,
    elapsedHours: 0,
    slaHours: 24,
    category: 'other'
  });
  assert.ok(pMin >= 0 && pMin <= 100);

  const pMax = computePriority({
    severity: 'critical',
    reportCount: 1000,
    verificationUp: 100,
    verificationDown: 0,
    elapsedHours: 100,
    slaHours: 1,
    category: 'road_damage'
  });
  assert.ok(pMax > 80 && pMax <= 100);
});

test('priority normal cases', () => {
  const p1 = computePriority({
    severity: 'high',
    reportCount: 5,
    verificationUp: 10,
    verificationDown: 2,
    elapsedHours: 12,
    slaHours: 24,
    category: 'pothole'
  });

  const p2 = computePriority({
    severity: 'low',
    reportCount: 1,
    verificationUp: 1,
    verificationDown: 0,
    elapsedHours: 1,
    slaHours: 48,
    category: 'other'
  });

  assert.ok(p1 > p2);
});
