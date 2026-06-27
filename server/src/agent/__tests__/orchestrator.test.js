import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../config/firebase.js';
import { createTraceLogger } from '../traceLogger.js';
import { resetLLMClient, setTestLLMClient } from '../../llm/index.js';

async function loadOrchestratorWithStubbedLLM() {
  resetLLMClient();
  const fakeLlm = {
    async chat() {
      return { text: 'Enriched reasoning summary' };
    }
  };
  setTestLLMClient(fakeLlm);

  const orchestratorUrl = new URL('../orchestrator.js', import.meta.url);
  const orchestrator = await import(`${orchestratorUrl.href}?t=${Date.now()}`);
  return orchestrator;
}

test('processReport runs the full deterministic tool pipeline and records every step', async () => {
  const orchestrator = await loadOrchestratorWithStubbedLLM();

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

  // Phase 2 Schema & Explainability checks
  const ticketDoc = await db.collection('tickets').doc(result.ticketId).get();
  const ticket = ticketDoc.data();
  assert.ok(ticket.verification_score !== undefined);
  assert.ok(ticket.verification_explanation);
  assert.ok(ticket.priority_explanation);
  assert.ok(ticket.sla_risk_score !== undefined);
  assert.ok(ticket.sla_risk_explanation);
  assert.ok(ticket.dispatch_plan);
  assert.ok(ticket.cluster_explanation);

  // Phase 4 checks
  assert.ok(ticket.priority_detail);
  const calculatedTotal = ticket.priority_detail.severity +
                          ticket.priority_detail.volume +
                          ticket.priority_detail.verification +
                          ticket.priority_detail.sla_urgency +
                          ticket.priority_detail.safety;
  assert.equal(calculatedTotal, ticket.priority_score);
  assert.ok(ticket.cluster_detail);
  assert.ok(ticket.cluster_detail.found !== undefined);
  assert.ok(ticket.sla_params);

  assert.equal(result.trace.some((step) => step.step === 'create_ticket' && step.status === 'success'), true);
  assert.ok(steps.some((step) => step.step === 'intake'));
  assert.ok(steps.some((step) => step.step === 'classify_issue'));
  assert.ok(steps.some((step) => step.step === 'geo_resolve'));
  assert.ok(steps.some((step) => step.step === 'find_cluster'));
  assert.ok(steps.some((step) => step.step === 'record_verification'));
  assert.ok(steps.some((step) => step.step === 'create_ticket'));
  assert.ok(steps.some((step) => step.step === 'compute_priority'));
  assert.ok(steps.some((step) => step.step === 'check_sla_status'));
  assert.ok(steps.some((step) => step.step === 'planning'));
  assert.ok(steps.some((step) => step.step === 'notify_reporters'));
  assert.ok(steps.some((step) => step.step === 'agent_response'));
  assert.ok(steps.some((step) => step.status === 'success'));
  assert.ok(steps.some((step) => step.status === 'pending'));
  resetLLMClient();
  assert.ok(steps.every((step) => step.reportId === 'report-1'));
  assert.ok(steps.every((step) => step.index != null));
});

test('processReport throws error for invalid coordinates', async () => {
  const orchestrator = await loadOrchestratorWithStubbedLLM();

  await assert.rejects(
    async () => {
      await orchestrator.processReport({
        id: 'report-2',
        text: 'bad coords',
        lat: 95.0, // Invalid latitude (> 90)
        lng: 80.95,
        classificationResult: { category: 'other', severity: 'medium', confidence: 0.8, reasoning: 'test' },
      });
    },
    /Invalid coordinates/
  );
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

test('weighted community votes update verification, priority, and voter reputation trust', async () => {
  const handlers = (await import('../toolHandlers.js')).toolHandlers;

  // 1. Create a ticket
  const created = await handlers.create_ticket({
    title: 'Consensus Quest',
    description: 'Civic anomaly verification test',
    category: 'water_leak',
    severity: 'medium',
    lat: 26.85,
    lng: 80.95,
    address: 'Hazratganj',
    ward: 'Hazratganj'
  }, { userId: 'u_reporter', userName: 'Reporter' });
  const ticketId = created.ticket_id;

  // 2. Create users with different trust scores (seeded with 10 actions to satisfy threshold)
  await db.collection('users').doc('voter_high').set({
    uid: 'voter_high', display_name: 'Noble Ranger', trust_score: 0.9,
    reports_verified: 10, reports_rejected: 0, verification_accuracy: 1.0, xp: 0
  });
  await db.collection('users').doc('voter_low').set({
    uid: 'voter_low', display_name: 'Novice Squire', trust_score: 0.1,
    reports_verified: 10, reports_rejected: 0, verification_accuracy: 1.0, xp: 0
  });

  // 3. noble ranger upvotes
  await handlers.record_verification({ ticket_id: ticketId, vote_type: 'still_issue' }, { userId: 'voter_high' });

  // 4. novice squire downvotes
  await handlers.record_verification({ ticket_id: ticketId, vote_type: 'looks_resolved' }, { userId: 'voter_low' });

  let ticketDoc = await db.collection('tickets').doc(ticketId).get();
  let ticket = ticketDoc.data();
  assert.equal(ticket.verification_up, 1);
  assert.equal(ticket.verification_down, 1);
  // community votes ratio should be 0.9 / (0.9 + 0.1) = 0.9
  assert.ok(ticket.verification_score > 0);

  // 5. Cast 4 more downvotes to resolve the ticket (reaches 5 downvotes)
  for (let i = 1; i <= 4; i++) {
    await handlers.record_verification({ ticket_id: ticketId, vote_type: 'looks_resolved' }, { userId: `down_voter_${i}` });
  }

  ticketDoc = await db.collection('tickets').doc(ticketId).get();
  ticket = ticketDoc.data();
  // Status should transition to resolved
  assert.equal(ticket.status, 'resolved');
  assert.ok(ticket.resolved_at);

  // 6. Verify reputation updates
  // voter_low voted looks_resolved (correct stance) -> reports_verified: 11, reports_rejected: 0
  // Laplace trust: (11 + 1) / (11 + 2) = 0.92
  const lowVoterDoc = await db.collection('users').doc('voter_low').get();
  const lowVoter = lowVoterDoc.data();
  assert.equal(lowVoter.reports_verified, 11);
  assert.equal(lowVoter.reports_rejected, 0);
  assert.equal(lowVoter.trust_score, 0.92);

  // voter_high voted still_issue (correct for verified, incorrect for resolved) -> reports_verified: 11, reports_rejected: 1
  // Laplace trust: (11 + 1) / (12 + 2) = 0.86
  const highVoterDoc = await db.collection('users').doc('voter_high').get();
  const highVoter = highVoterDoc.data();
  assert.equal(highVoter.reports_verified, 11);
  assert.equal(highVoter.reports_rejected, 1);
  assert.equal(highVoter.trust_score, 0.86);
});

test('analyzeRootCause analyzes report cluster and diagnoses probable cause', async () => {
  const { analyzeRootCause } = await import('../../services/rootCauseService.js');
  const reports = [
    { title: 'Pipe Leak', description: 'Huge water gusher on Aliganj main road.', address: 'Aliganj', ward: 'Aliganj' },
    { title: 'Low pressure', description: 'Water pressure dropped completely in Aliganj.', address: 'Aliganj', ward: 'Aliganj' }
  ];

  const result = await analyzeRootCause('water_leak', reports);
  assert.ok(result.cause);
  assert.ok(result.confidence);
  assert.ok(result.explanation);
});

test('record_verification enforces 50m geofence validation', async () => {
  const handlers = (await import('../toolHandlers.js')).toolHandlers;
  const created = await handlers.create_ticket({
    title: 'Geofence test',
    description: 'Civic geofence verification test',
    category: 'water_leak',
    severity: 'medium',
    lat: 26.85,
    lng: 80.95,
    address: 'Hazratganj',
    ward: 'Hazratganj'
  }, { userId: 'u_reporter', userName: 'Reporter' });
  const ticketId = created.ticket_id;

  // Attempt to vote from 1 km away (lat: 26.86, lng: 80.95)
  const failRes = await handlers.record_verification({
    ticket_id: ticketId,
    vote_type: 'still_issue',
    lat: 26.86,
    lng: 80.95
  }, { userId: 'geofence_voter' });

  assert.equal(failRes.error, 'Verification rejected: you must be within 50 meters of the issue location to verify.');

  // Vote from exactly the same spot (lat: 26.85, lng: 80.95)
  const successRes = await handlers.record_verification({
    ticket_id: ticketId,
    vote_type: 'still_issue',
    lat: 26.85,
    lng: 80.95
  }, { userId: 'geofence_voter' });

  assert.ok(!successRes.error);
  assert.equal(successRes.verification_up, 1);
});

test('processReport redirects duplicate reports to verification upvotes', async () => {
  const orchestrator = await loadOrchestratorWithStubbedLLM();
  
  // Clean mock tickets collection for test isolation
  const ticketsSnap = await db.collection('tickets').get();
  for (const doc of ticketsSnap.docs) {
    await db.collection('tickets').doc(doc.id).delete();
  }
  
  // 1. Create first report (ticket created)
  const res1 = await orchestrator.processReport({
    id: 'report-orig',
    text: 'Water leak',
    lat: 26.85,
    lng: 80.95,
    reporter_id: 'voter_first',
    reporter_name: 'Reporter 1',
    address: 'Hazratganj',
    classificationResult: { category: 'water_leak', severity: 'medium', confidence: 0.9, reasoning: 'test' },
  }, () => {});

  const ticketId = res1.ticketId;
  assert.ok(ticketId);
  assert.equal(res1.merged, false);

  // 2. Create second report at same location (duplicate)
  const res2 = await orchestrator.processReport({
    id: 'report-dup',
    text: 'Water leak duplicate',
    lat: 26.8501,
    lng: 80.9501,
    reporter_id: 'voter_second',
    reporter_name: 'Reporter 2',
    address: 'Hazratganj',
    classificationResult: { category: 'water_leak', severity: 'medium', confidence: 0.9, reasoning: 'test' },
  }, () => {});

  assert.equal(res2.ticketId, ticketId);
  assert.equal(res2.merged, true);

  // Verify that voter_second's vote was registered as 'still_issue'
  const ticketDoc = await db.collection('tickets').doc(ticketId).get();
  const ticket = ticketDoc.data();
  assert.equal(ticket.votes['voter_second'], 'still_issue');
  assert.equal(ticket.verification_up, 1);
});

