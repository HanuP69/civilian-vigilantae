import test from 'node:test';
import assert from 'node:assert';
import { dbscan, compositeDistance } from '../dbscan.js';

test('compositeDistance calculation', () => {
  const p1 = { id: '1', lat: 26.85, lng: 80.95, timestamp: new Date('2026-06-25T12:00:00Z'), category: 'pothole' };
  const p2 = { id: '2', lat: 26.85, lng: 80.95, timestamp: new Date('2026-06-25T12:00:00Z'), category: 'pothole' };
  const distSame = compositeDistance(p1, p2);
  assert.strictEqual(distSame, 0);

  const p3 = { id: '3', lat: 26.85, lng: 80.95, timestamp: new Date('2026-06-25T12:00:00Z'), category: 'water_leak' };
  const distDiffCat = compositeDistance(p1, p3);
  assert.ok(distDiffCat > 0);
});

test('dbscan clustering basic', () => {
  const points = [
    { id: 'a', lat: 26.8500, lng: 80.9500, timestamp: new Date('2026-06-25T12:00:00Z'), category: 'pothole' },
    { id: 'b', lat: 26.8501, lng: 80.9501, timestamp: new Date('2026-06-25T12:30:00Z'), category: 'pothole' },
    { id: 'c', lat: 26.8900, lng: 80.9900, timestamp: new Date('2026-06-25T12:00:00Z'), category: 'pothole' }
  ];

  const result = dbscan(points, 0.35, 2);
  assert.strictEqual(result.clusters.length, 1);
  assert.ok(result.clusters[0].includes('a'));
  assert.ok(result.clusters[0].includes('b'));
  assert.ok(result.noise.includes('c'));
});
