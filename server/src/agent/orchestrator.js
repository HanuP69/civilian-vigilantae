import { ReportIntakeAgent } from './agents/ReportIntakeAgent.js';
import { ClusteringAgent } from './agents/ClusteringAgent.js';
import { VerificationAgent } from './agents/VerificationAgent.js';
import { PriorityAgent } from './agents/PriorityAgent.js';
import { SLAAgent } from './agents/SLAAgent.js';
import { PlannerAgent } from './agents/PlannerAgent.js';
import { GovernanceAgent } from './agents/GovernanceAgent.js';

import { createTraceLogger } from './traceLogger.js';
import { toolHandlers } from './toolHandlers.js';
import { enrichReasoning } from './enricher.js';

export async function processReport(reportData, onStep) {
  const trace = createTraceLogger(reportData.id || 'new', onStep);
  const ctx = {
    userId: reportData.reporter_id || 'anonymous',
    userName: reportData.reporter_name || 'Anonymous',
    userAddress: reportData.address || null,
    mediaUrls: reportData.media_urls || [],
    mediaType: reportData.media_type || 'image',
    mediaBase64: reportData.mediaBase64 || null,
    mediaMimeType: reportData.mediaMimeType || null,
    classificationResult: reportData.classificationResult || null,
    cloudVisionResult: reportData.cloudVisionResult || null,
    classificationAgreement: reportData.classificationAgreement ?? true,
    trace,
    reportData,
  };

  // 1. Intake Ingestion Flow (Intake + Validation + Classification + Geo)
  await ReportIntakeAgent.execute(ctx);

  // 2. Clustering Agent (checks swarms)
  await ClusteringAgent.execute(ctx);

  // 3. Verification Agent (trust scores & confidence status)
  await VerificationAgent.execute(ctx);

  // 4. Ticket Create or Merge
  let ticketId = null;
  let merged = false;
  if (ctx.clusterResult.found) {
    const completeMerge = trace.startStep('merge_into_ticket', { ticket_id: ctx.clusterResult.ticket_id, reason: 'Duplicate found by clustering agent' });
    const mergeResult = await toolHandlers.merge_into_ticket({ ticket_id: ctx.clusterResult.ticket_id, reason: 'Duplicate found by clustering agent' }, ctx);
    ticketId = ctx.clusterResult.ticket_id;
    merged = true;
    const mergeReasoning = await enrichReasoning('merge_into_ticket', mergeResult) || `Merged report into existing ticket #${ctx.clusterResult.ticket_id}.`;
    completeMerge(mergeResult, mergeReasoning);
  } else {
    const completeCreate = trace.startStep('create_ticket', {
      title: reportData.text?.substring(0, 50) || 'Incident Report',
      description: reportData.text,
      category: ctx.classificationResult.category,
      severity: ctx.classificationResult.severity,
      lat: ctx.latitude,
      lng: ctx.longitude,
      address: ctx.geoResult.address,
      ward: ctx.geoResult.ward,
      status: ctx.vStatus,
    });
    const createResult = await toolHandlers.create_ticket({
      title: reportData.text?.substring(0, 50) || 'Incident Report',
      description: reportData.text,
      category: ctx.classificationResult.category,
      severity: ctx.classificationResult.severity,
      lat: ctx.latitude,
      lng: ctx.longitude,
      address: ctx.geoResult.address,
      ward: ctx.geoResult.ward,
      status: ctx.vStatus,
    }, ctx);
    ticketId = createResult.ticket_id;
    merged = false;
    const createReasoning = await enrichReasoning('create_ticket', createResult) || `Initialized new database ticket #${ticketId}.`;
    completeCreate(createResult, createReasoning);
  }

  ctx.ticketId = ticketId;

  // 5. Priority Agent
  await PriorityAgent.execute(ctx);

  // 6. SLA Agent
  await SLAAgent.execute(ctx);

  // 7. Planner Agent
  await PlannerAgent.execute(ctx);

  // 8. Governance Agent (Notification)
  await GovernanceAgent.executeNotify(ctx);

  // 9. Root Cause Diagnosis
  const { db } = await import('../config/firebase.js');
  let reportsForRootCause = [];

  // Single read for both root cause data and asset details
  const ticketDoc = await db.collection('tickets').doc(ticketId).get();
  let ticketAssetId = null;
  let ticketAssetName = null;
  if (ticketDoc.exists) {
    const ticketData = ticketDoc.data();
    ticketAssetId = ticketData.asset_id || null;
    ticketAssetName = ticketData.asset_name || null;
    if (merged) {
      reportsForRootCause.push({
        title: ticketData.title,
        description: ticketData.description,
        address: ticketData.address,
        ward: ticketData.ward,
        created_at: ticketData.created_at,
        asset_id: ticketData.asset_id,
        asset_name: ticketData.asset_name
      });
    }
  }

  reportsForRootCause.push({
    title: reportData.text?.substring(0, 50) || 'Incident Report',
    description: reportData.text,
    address: ctx.geoResult.address,
    ward: ctx.geoResult.ward,
    created_at: new Date().toISOString(),
    asset_id: ticketAssetId,
    asset_name: ticketAssetName
  });

  const { analyzeRootCause } = await import('../services/rootCauseService.js');
  const rootCauseResult = await analyzeRootCause(ctx.classificationResult.category, reportsForRootCause);

  trace.logStep('agent_response', {}, { text: 'Report processing complete.' }, 'SENTINEL-CIVIC pipeline operations complete.', 0);

  // Store full trace and dynamic calculations in Firestore
  await db.collection('tickets').doc(ticketId).update({
    agent_trace: trace.getSteps(),
    verification_score: ctx.verificationResult.verification_score,
    verification_explanation: ctx.verificationResult.explanation,
    priority_explanation: ctx.priorityResult.explanation || 'Priority resolved.',
    priority_detail: ctx.priorityResult.priority_detail || null,
    sla_risk_score: Math.round((ctx.slaResult.probability || 0) * 100),
    sla_risk_explanation: ctx.slaResult.explanation || 'SLA probability resolved.',
    sla_params: ctx.slaResult.localized_params || null,
    dispatch_plan: ctx.planResult,
    cluster_explanation: ctx.clusterResult.found ? 'Swarms detected and resolved.' : 'No duplicate hotspots identified.',
    cluster_detail: ctx.clusterResult,
    root_cause: rootCauseResult,
  });

  return { ticketId, merged, trace: trace.getSteps() };
}

export async function processSchedulerTick(onStep) {
  const { db } = await import('../config/firebase.js');
  const trace = createTraceLogger('scheduler-tick', onStep);

  const ticketsSnap = await db.collection('tickets').get();
  const openTickets = [];
  ticketsSnap.forEach(doc => {
    const t = { ...doc.data(), id: doc.id };
    if (['reported', 'verified', 'in_progress'].includes(t.status)) openTickets.push(t);
  });

  if (openTickets.length === 0) return { processed: 0, trace: trace.getSteps() };

  let processedCount = 0;
  for (const t of openTickets) {
    const completeSLA = trace.startStep('check_sla_status', { ticket_id: t.id });
    const slaResult = await toolHandlers.check_sla_status({ ticket_id: t.id });
    completeSLA(slaResult, `SLA Checked. Breach probability: ${slaResult.probability ?? 0}`);

    if (slaResult.probability > 0.8 || slaResult.is_breached) {
      await GovernanceAgent.executeEscalate(t, trace);
    }

    const completePriority = trace.startStep('compute_priority', { ticket_id: t.id });
    const priorityResult = await toolHandlers.compute_priority({ ticket_id: t.id });
    completePriority(priorityResult, `Priority recalculated: ${priorityResult.priority_score}`);

    // Update ticket agent trace
    const ticketDoc = await db.collection('tickets').doc(t.id).get();
    if (ticketDoc.exists) {
      const existingTrace = ticketDoc.data().agent_trace || [];
      await db.collection('tickets').doc(t.id).update({
        agent_trace: [...existingTrace, ...trace.getSteps()],
      });
    }

    processedCount++;
  }

  return { processed: processedCount, trace: trace.getSteps() };
}
