import { getLLMClient } from '../llm/index.js';
import { getToolsForContext } from './tools.js';
import { toolHandlers } from './toolHandlers.js';
import { createTraceLogger } from './traceLogger.js';

const SYSTEM_PROMPT = `You are SENTINEL-CIVIC, an AI agent that processes citizen reports about community issues in Lucknow, India. You autonomously classify, deduplicate, prioritize, and route civic issue reports.`;

async function enrichReasoning(stepName, payload) {
  try {
    const llm = getLLMClient();
    const prompt = `Enrich this agent step's reasoning with a professional, operational Lucknow municipal dispatch tone. Keep it under 20 words.\nStep: ${stepName}\nData: ${JSON.stringify(payload)}`;
    const response = await llm.chat([{ role: 'user', content: prompt }], []);
    return response.text?.trim() || '';
  } catch {
    return '';
  }
}

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
  };

  // Phase 1: Intake -> Classification -> Geo -> Clustering -> Verification -> Priority -> SLA Risk -> Planning -> Ticket -> Notify

  // 1. Intake
  const completeIntake = trace.startStep('intake', { reportData });
  const intakeResult = {
    report_id: reportData.id || 'new',
    text: reportData.text,
    lat: reportData.lat,
    lng: reportData.lng,
    reporter_id: ctx.userId,
    reporter_name: ctx.userName,
    address: ctx.userAddress,
    media_urls: ctx.mediaUrls,
  };
  const intakeReasoning = await enrichReasoning('intake', intakeResult) || 'Citizen report successfully received and logged.';
  completeIntake(intakeResult, intakeReasoning);

  // Validate coordinates immediately (Test Plan requirement: "invalid lat/lng rejected")
  const latitude = parseFloat(reportData.lat);
  const longitude = parseFloat(reportData.lng);
  if (Number.isNaN(latitude) || Number.isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    trace.logStep('validation_error', { lat: reportData.lat, lng: reportData.lng }, { error: 'Invalid coordinates' }, 'Coordinates are out of bounds or missing.', 0);
    throw new Error('Invalid coordinates');
  }

  // 2. Classification
  const completeClassify = trace.startStep('classify_issue', { text: reportData.text });
  let classificationResult = ctx.classificationResult;
  if (!classificationResult) {
    classificationResult = await toolHandlers.classify_issue({ text: reportData.text, has_media: !!ctx.mediaUrls.length }, ctx);
  }
  ctx.classificationResult = classificationResult;
  const classificationReasoning = await enrichReasoning('classify_issue', classificationResult) || `Categorized as [${classificationResult.category}] with severity [${classificationResult.severity}] (confidence: ${classificationResult.confidence}).`;
  completeClassify(classificationResult, classificationReasoning);

  // 3. Geo
  const completeGeo = trace.startStep('geo_resolve', { lat: latitude, lng: longitude });
  const geoResult = await toolHandlers.geo_resolve({ lat: latitude, lng: longitude });
  const geoReasoning = await enrichReasoning('geo_resolve', geoResult) || `Geospatial match resolved location coordinates to ward [${geoResult.ward}].`;
  completeGeo(geoResult, geoReasoning);

  // 4. Clustering
  const completeCluster = trace.startStep('find_cluster', { lat: latitude, lng: longitude, category: classificationResult.category });
  const clusterResult = await toolHandlers.find_cluster({
    lat: latitude,
    lng: longitude,
    category: classificationResult.category,
    timestamp: new Date().toISOString(),
  });
  const clusterReasoning = await enrichReasoning('find_cluster', clusterResult) || (clusterResult.found ? `Duplicate alert: matches existing incident swarm #${clusterResult.ticket_id}.` : 'No duplicate hotspots identified in proximity.');
  completeCluster(clusterResult, clusterReasoning);

  // 5. Verification
  const completeVerify = trace.startStep('record_verification', { found: clusterResult.found });
  
  let reporterTrust = 0.5;
  if (ctx.userId && ctx.userId !== 'anonymous') {
    try {
      const { db } = await import('../config/firebase.js');
      const userDoc = await db.collection('users').doc(ctx.userId).get();
      if (userDoc.exists) {
        reporterTrust = userDoc.data().trust_score ?? 0.5;
      }
    } catch (err) {
      console.warn('[Orchestrator] Failed to fetch reporter trust:', err.message);
    }
  }

  const aiConfidence = classificationResult.confidence ?? 0.5;
  const nearbyEvidence = clusterResult.found ? Math.min((clusterResult.cluster_size || 1) / 5, 1.0) : 0.0;
  const communityVotes = 0.5; // neutral initial value

  const { calculateVerificationScore, statusFromVerificationScore } = await import('../math/verification.js');
  const vScore = calculateVerificationScore({
    aiConfidence,
    reporterTrust,
    nearbyEvidence,
    communityVotes,
  });
  const vStatus = statusFromVerificationScore(vScore);

  const verificationResult = {
    verification_score: vScore,
    status: vStatus,
    explanation: `Verification score ${vScore}% derived from AI confidence, reporter reputation trust, and cluster density.`,
  };
  const verificationReasoning = await enrichReasoning('record_verification', verificationResult) || `Multi-agent verification resolved score to ${vScore}% (${vStatus}).`;
  completeVerify(verificationResult, verificationReasoning);

  // 6. Ticket Execution (create or merge)
  let ticketId = null;
  let merged = false;
  if (clusterResult.found) {
    const completeMerge = trace.startStep('merge_into_ticket', { ticket_id: clusterResult.ticket_id, reason: 'Duplicate found by clustering agent' });
    const mergeResult = await toolHandlers.merge_into_ticket({ ticket_id: clusterResult.ticket_id, reason: 'Duplicate found by clustering agent' }, ctx);
    ticketId = clusterResult.ticket_id;
    merged = true;
    const mergeReasoning = await enrichReasoning('merge_into_ticket', mergeResult) || `Merged report into existing ticket #${clusterResult.ticket_id}.`;
    completeMerge(mergeResult, mergeReasoning);
  } else {
    const completeCreate = trace.startStep('create_ticket', {
      title: reportData.text?.substring(0, 50) || 'Incident Report',
      description: reportData.text,
      category: classificationResult.category,
      severity: classificationResult.severity,
      lat: latitude,
      lng: longitude,
      address: geoResult.address,
      ward: geoResult.ward,
      status: vStatus,
    });
    const createResult = await toolHandlers.create_ticket({
      title: reportData.text?.substring(0, 50) || 'Incident Report',
      description: reportData.text,
      category: classificationResult.category,
      severity: classificationResult.severity,
      lat: latitude,
      lng: longitude,
      address: geoResult.address,
      ward: geoResult.ward,
      status: vStatus,
    }, ctx);
    ticketId = createResult.ticket_id;
    merged = false;
    const createReasoning = await enrichReasoning('create_ticket', createResult) || `Initialized new database ticket #${ticketId}.`;
    completeCreate(createResult, createReasoning);
  }

  // 7. Priority
  const completePriority = trace.startStep('compute_priority', { ticket_id: ticketId });
  const priorityResult = await toolHandlers.compute_priority({ ticket_id: ticketId });
  const priorityReasoning = await enrichReasoning('compute_priority', priorityResult) || `Priority score calculated as ${priorityResult.priority_score}.`;
  completePriority(priorityResult, priorityReasoning);

  // 8. SLA Risk
  const completeSLA = trace.startStep('check_sla_status', { ticket_id: ticketId });
  const slaResult = await toolHandlers.check_sla_status({ ticket_id: ticketId });
  const slaReasoning = await enrichReasoning('check_sla_status', slaResult) || `Weibull forecast resolves breach probability at ${Math.round((slaResult.probability || 0) * 100)}%.`;
  completeSLA(slaResult, slaReasoning);

  // 9. Planning
  const completePlan = trace.startStep('planning', { ticket_id: ticketId });
  const depts = {
    pothole: 'Roads & Infrastructure', water_leak: 'Water Supply', streetlight: 'Electrical & Lighting',
    waste: 'Sanitation & Waste Management', road_damage: 'Roads & Infrastructure',
    drainage: 'Drainage & Sewerage', other: 'General Maintenance',
  };
  const severityCrew = { critical: 4, high: 3, medium: 2, low: 1 };
  const severityCost = { critical: 15000, high: 8000, medium: 4000, low: 1500 };
  const severityEta = { critical: '12h', high: '24h', medium: '48h', low: '72h' };

  const dept = depts[classificationResult.category] || depts.other;
  const crew = severityCrew[classificationResult.severity] || 2;
  const cost = severityCost[classificationResult.severity] || 4000;
  const eta = severityEta[classificationResult.severity] || '48h';
  const materials = classificationResult.category === 'pothole' || classificationResult.category === 'road_damage'
    ? ['asphalt', 'roller', 'compactor']
    : classificationResult.category === 'water_leak'
      ? ['pipe patching clamps', 'valves']
      : ['tools'];

  const planResult = {
    department: dept,
    crew_size: crew,
    materials,
    estimated_cost: cost,
    eta,
    explanation: `Automated dispatch plan formulated for ${dept} team.`,
  };
  const planReasoning = await enrichReasoning('planning', planResult) || `Dispatch planning generated resource recommendation for ${dept}.`;
  completePlan(planResult, planReasoning);

  // 10. Notify
  const completeNotify = trace.startStep('notify_reporters', { ticket_id: ticketId, status: 'reported' });
  const notifyResult = await toolHandlers.notify_reporters({ ticket_id: ticketId, status: 'reported' });
  const notifyReasoning = await enrichReasoning('notify_reporters', notifyResult) || 'Dispatched push notification alerts to regional sentinels.';
  completeNotify(notifyResult, notifyReasoning);

  // 11. Root Cause Diagnosis
  const { db } = await import('../config/firebase.js');
  let reportsForRootCause = [];
  if (merged) {
    try {
      const ticketSnap = await db.collection('tickets').doc(ticketId).get();
      if (ticketSnap.exists) {
        const ticketData = ticketSnap.data();
        reportsForRootCause.push({
          title: ticketData.title,
          description: ticketData.description,
          address: ticketData.address,
          ward: ticketData.ward
        });
      }
    } catch (err) {
      console.warn('[Orchestrator] Failed to fetch existing ticket for root cause:', err.message);
    }
  }
  reportsForRootCause.push({
    title: reportData.text?.substring(0, 50) || 'Incident Report',
    description: reportData.text,
    address: geoResult.address,
    ward: geoResult.ward
  });

  const { analyzeRootCause } = await import('../services/rootCauseService.js');
  const rootCauseResult = await analyzeRootCause(classificationResult.category, reportsForRootCause);

  // Store full trace in ticket.agent_trace along with Phase 2/4 explainability fields and root cause diagnosis
  await db.collection('tickets').doc(ticketId).update({
    agent_trace: trace.getSteps(),
    verification_score: verificationResult.verification_score,
    verification_explanation: verificationReasoning,
    priority_explanation: priorityReasoning,
    priority_detail: priorityResult.priority_detail || null,
    sla_risk_score: Math.round((slaResult.probability || 0) * 100),
    sla_risk_explanation: slaReasoning,
    sla_params: slaResult.localized_params || null,
    dispatch_plan: planResult,
    cluster_explanation: clusterReasoning,
    cluster_detail: clusterResult,
    root_cause: rootCauseResult,
  });

  // Log final agent response
  trace.logStep('agent_response', {}, { text: 'Report processing complete.' }, 'SENTINEL-CIVIC pipeline operations complete.', 0);

  return { ticketId, merged, trace: trace.getSteps() };
}

export async function processSchedulerTick(onStep) {
  const { db } = await import('../config/firebase.js');
  const trace = createTraceLogger('scheduler-tick', onStep);

  const ticketsSnap = await db.collection('tickets').get();
  const openTickets = [];
  ticketsSnap.forEach(doc => {
    const t = doc.data();
    if (['reported', 'verified', 'in_progress'].includes(t.status)) openTickets.push(t);
  });

  if (openTickets.length === 0) return { processed: 0, trace: trace.getSteps() };

  let processedCount = 0;
  for (const t of openTickets) {
    const completeSLA = trace.startStep('check_sla_status', { ticket_id: t.id });
    const slaResult = await toolHandlers.check_sla_status({ ticket_id: t.id });
    completeSLA(slaResult, `SLA Checked. Breach probability: ${slaResult.probability ?? 0}`);

    if (slaResult.probability > 0.8 || slaResult.is_breached) {
      const completeEscalate = trace.startStep('escalate_ticket', { ticket_id: t.id, reason: 'High SLA breach probability forecasted' });
      const escalateResult = await toolHandlers.escalate_ticket({ ticket_id: t.id, reason: 'High SLA breach probability forecasted' });
      completeEscalate(escalateResult, 'Ticket escalated.');
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
