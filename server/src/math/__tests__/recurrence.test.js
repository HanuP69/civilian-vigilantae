import test from 'node:test';
import assert from 'node:assert';
import { computeRecurrenceRisk } from '../recurrence.js';

test('recurrence risk estimation with fallback', () => {
  const tickets = [
    { ward: 'Hazratganj', category: 'pothole', resolved_at: '2026-06-01T12:00:00Z' }
  ];
  const risks = computeRecurrenceRisk(tickets, 14);
  assert.strictEqual(risks.length, 1);
  assert.strictEqual(risks[0].ward, 'Hazratganj');
  assert.strictEqual(risks[0].category, 'pothole');
  assert.ok(risks[0].probability > 0);
});

test('recurrence risk estimation with enough data', () => {
  const tickets = [
    { ward: 'Hazratganj', category: 'pothole', resolved_at: '2026-06-01T12:00:00Z' },
    { ward: 'Hazratganj', category: 'pothole', resolved_at: '2026-06-05T12:00:00Z' },
    { ward: 'Hazratganj', category: 'pothole', resolved_at: '2026-06-10T12:00:00Z' },
    { ward: 'Hazratganj', category: 'pothole', resolved_at: '2026-06-15T12:00:00Z' }
  ];
  const risks = computeRecurrenceRisk(tickets, 14);
  assert.ok(risks.length >= 1);
  assert.strictEqual(risks[0].ward, 'Hazratganj');
  assert.ok(risks[0].probability > 0);
});
