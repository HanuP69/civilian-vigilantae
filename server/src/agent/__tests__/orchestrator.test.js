import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../config/firebase.js';
import { createTraceLogger } from '../traceLogger.js';
import { resetLLMClient, setTestLLMClient } from '../../llm/index.js';

function buildSequence(sequence) {
  const queue = [...sequence];
  return async function chat(messages) {
    const step = queue.shift();
    if (!step) {
      return { toolCalls: [], text: 'done' };
    }
    return step(messages);
  };
}

async function loadOrchestratorWithStubbedLLM(sequence) {
  resetLLMClient();
  const fakeLlm = { async chat(messages) { return chatSequence(messages); } };
  const chatSequence = buildSequence(sequence);
  setTestLLMClient(fakeLlm);

  const orchestratorUrl = new URL('../orchestrator.js', import.meta.url);
  const orchestrator = await import(`${orchestratorUrl.href}?t=${Date.now()}`);
  return orchestrator;
}

test('processReport runs the full tool pipeline and records every step', async () => {
  const orchestrator = await loadOrchestratorWithStubbedLLM([
    () => ({ toolCalls: [{ name: 'classify_issue', args: { text: 'pothole', has_media: false } }], text: 'classify' }),
    () => ({ toolCalls: [{ name: 'geo_resolve', args: { lat: 26.85, lng: 80.95 } }], text: 'geo' }),
    () => ({ toolCalls: [{ name: 'find_cluster', args: { lat: 26.85, lng: 80.95, category: 'pothole', timestamp: new Date().toISOString() } }], text: 'cluster' }),
    () => ({ toolCalls: [{ name: 'create_ticket', args: { title: 'Pothole', description: 'Big pothole', category: 'road_damage', severity: 'high', lat: 26.85, lng: 80.95, address: 'Hazratganj', ward: 'Hazratganj' } }], text: 'create' }),
    () => ({ toolCalls: [{ name: 'compute_priority', args: { ticket_id: 'ticket-test' } }], text: 'priority' }),
    () => ({ toolCalls: [], text: 'done' }),
  ]);

  const steps = [];
  const result = await orchestrator.processReport({
    id: 'report-1',
    text: 'pothole',
    lat: 26.85,
    lng: 80.95,
    reporter_id: 'u1',
    reporter_name: 'Test',
    address: 'Hazratganj',
    classificationResult: { category: 'road_damage', severity: 'high', confidence: 0.95, reasoning: 'test' },
  }, (step) => steps.push(step));

  assert.ok(result.ticketId);
  assert.equal(result.merged, false);
  assert.equal(result.trace.some((step) => step.step === 'create_ticket' && step.status === 'success'), true);
  assert.ok(steps.some((step) => step.step === 'llm_reasoning'));
  assert.ok(steps.some((step) => step.step === 'classify_issue'));
  assert.ok(steps.some((step) => step.step === 'geo_resolve'));
  assert.ok(steps.some((step) => step.step === 'find_cluster'));
  assert.ok(steps.some((step) => step.step === 'create_ticket'));
  assert.ok(steps.some((step) => step.step === 'compute_priority'));
  assert.ok(steps.some((step) => step.step === 'agent_response'));
  assert.ok(steps.some((step) => step.status === 'success'));
  assert.ok(steps.some((step) => step.status === 'pending'));
  resetLLMClient();
  assert.ok(steps.every((step) => step.reportId === 'report-1'));
  assert.ok(steps.every((step) => step.index != null));
});

test('processReport records the fallback response when no tool call is emitted', async () => {
  const orchestrator = await loadOrchestratorWithStubbedLLM([
    () => ({ toolCalls: [], text: 'No tool call needed' }),
  ]);

  const steps = [];
  const result = await orchestrator.processReport({
    id: 'report-2',
    text: 'bad',
    classificationResult: { category: 'other', severity: 'medium', confidence: 0.8, reasoning: 'test' },
  }, (step) => steps.push(step));

  assert.equal(result.ticketId, null);
  assert.ok(steps.some((step) => step.step === 'llm_reasoning'));
  assert.ok(steps.some((step) => step.step === 'agent_response'));
  resetLLMClient();
});

test('trace logger emits pending and completed steps with report ids', async () => {
  const events = [];
  const trace = createTraceLogger('report-trace', (step) => events.push(step));
  const finish = trace.startStep('classify_issue', { text: 'hello' });
  finish({ category: 'pothole' }, 'done', 'success');
  trace.logStep('agent_response', {}, { text: 'ok' });

  const steps = trace.getSteps();
  assert.equal(steps.length, 2);
  assert.equal(steps[0].status, 'success');
  assert.equal(steps[1].status, 'success');
  assert.equal(events[0].reportId, 'report-trace');
  assert.equal(events[1].reportId, 'report-trace');
});

test('tool handlers create and merge tickets correctly', async () => {
  const ctx = { userId: 'u2', userName: 'Tester', trace: { getSteps: () => [{ step: 'classify_issue', status: 'success' }] } };

  const created = await (await import('../toolHandlers.js')).toolHandlers.create_ticket({ title: 'Leak', description: 'Water leak', category: 'water_leak', severity: 'medium', lat: 26.8, lng: 80.9, address: 'Aminabad', ward: 'Aminabad' }, ctx);
  assert.ok(created.ticket_id);

  const merged = await (await import('../toolHandlers.js')).toolHandlers.merge_into_ticket({ ticket_id: created.ticket_id, reason: 'duplicate' }, ctx);
  assert.equal(merged.merged, true);
  const ticketDoc = await db.collection('tickets').doc(created.ticket_id).get();
  const ticket = ticketDoc.data();
  assert.equal(ticket.child_reports.length, 1);
  assert.equal(ticket.status, 'reported');
});

test('find_cluster uses a fresh timestamp for recent duplicate matching', async () => {
  const handlers = (await import('../toolHandlers.js')).toolHandlers;
  const oldTimestamp = '2023-10-05T10:00:00.000Z';
  const created = await handlers.create_ticket({ title: 'Leak', description: 'Water leak', category: 'water_leak', severity: 'medium', lat: 26.85, lng: 80.95, address: 'Hazratganj', ward: 'Hazratganj' }, { userId: 'u3', userName: 'Tester' });

  const result = await handlers.find_cluster({ lat: 26.8502, lng: 80.9502, category: 'water_leak', timestamp: oldTimestamp });

  assert.equal(result.found, false);
  assert.ok(created.ticket_id);
});

test('tool handlers cover classification, geocoding, and error fallback branches', async () => {
  const handlers = (await import('../toolHandlers.js')).toolHandlers;
  const classifyResult = await handlers.classify_issue({ text: 'broken light', has_media: false }, {});
  assert.ok(classifyResult.category);
  assert.ok(classifyResult.severity);

  const wardResult = await handlers.geo_resolve({ lat: 26.85, lng: 80.95 });
  assert.equal(wardResult.ward, 'Hazratganj');

  const priority = await handlers.compute_priority({ ticket_id: 'missing-ticket' });
  assert.equal(priority.error, 'Ticket not found');
});
