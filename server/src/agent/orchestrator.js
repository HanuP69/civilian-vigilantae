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

class AgentMessageBus {
  constructor() {
    this.messages = [];
  }
  
  sendMessage(from, to, type, payload) {
    const msg = {
      from,
      to,
      type,
      payload,
      timestamp: new Date().toISOString()
    };
    this.messages.push(msg);
    console.log(`[Agent Bus] [${from} -> ${to}] ${type}:`, JSON.stringify(payload));
    return msg;
  }

  getMessages() {
    return this.messages;
  }
}

export async function processReport(reportData, onStep) {
  const trace = createTraceLogger(reportData.id || 'new', onStep);
  const messageBus = new AgentMessageBus();
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
    messageBus,
  };

  // 1. Ingestion Flow (Intake + Validation + Classification + Geo)
  await ReportIntakeAgent.execute(ctx);

  // Pre-resolve nearest asset outside transaction (since it does a read of static assets)
  const resolvedWard = ctx.geoResult.ward;
  const { resolveNearestAsset, updateAssetHealth } = await import('../services/assetService.js');
  const asset = await resolveNearestAsset(resolvedWard, ctx.classificationResult.category || 'other') || {
    id: 'unknown_asset',
    name: 'General Ward Asset'
  };

  // 2. Transaction Block: Atomic duplicate search, verification computation, and ticket creation/merge
  const { db } = await import('../config/firebase.js');
  const { v4: uuidv4 } = await import('uuid');
  const { dbscan } = await import('../math/dbscan.js');
  const { calculateVerificationScore, statusFromVerificationScore } = await import('../math/verification.js');
  const { computePriority } = await import('../math/priority.js');
  const { DEPARTMENTS } = await import('./toolHandlers.js');
  const { DEFAULT_PARAMS } = await import('../math/weibull.js');

  let ticketId = null;
  let merged = false;

  await db.runTransaction(async (transaction) => {
    const completeCluster = trace.startStep('find_cluster', { lat: ctx.latitude, lng: ctx.longitude, category: ctx.classificationResult.category });

    // Read active tickets for duplicate checking
    const ticketsSnap = await transaction.get(db.collection('tickets'));
    const recentTickets = [];
    const ticketMetaById = {};
    const now = new Date();
    const { getMaxTimeWindowForCategory, calculateTextSimilarity } = await import('../math/dbscan.js');

    ticketsSnap.forEach(doc => {
      const t = { ...doc.data(), id: doc.id };
      if (t.status === 'resolved' || t.merged_into) return;
      const created = t.created_at?.toDate?.() ?? new Date(t.created_at);
      const maxWindow = getMaxTimeWindowForCategory(t.category);
      if (now - created < maxWindow) {
        recentTickets.push({ id: t.id, lat: t.lat, lng: t.lng, timestamp: created, category: t.category });
        ticketMetaById[t.id] = t;
      }
    });

    const newPoint = { id: '__new__', lat: ctx.latitude, lng: ctx.longitude, timestamp: now, category: ctx.classificationResult.category };
    const points = [...recentTickets, newPoint];
    
    let found = false;
    let bestId = null;
    let neighbors = [];
    
    if (points.length >= 2) {
      const { clusters } = dbscan(points);
      for (const cluster of clusters) {
        if (cluster.includes('__new__')) {
          const rawNeighbors = cluster.filter(id => id !== '__new__');
          const { haversine } = await import('../math/haversine.js');
          
          for (const id of rawNeighbors) {
            const t = ticketMetaById[id];
            if (!t) continue;
            
            // 1. Proximity Check: must be within 100 meters
            const dist = haversine(ctx.latitude, ctx.longitude, t.lat, t.lng);
            if (dist > 100) continue;
            
            // 2. Text Similarity Check: Jaccard similarity must be >= 0.25 if text is present
            const textSim = calculateTextSimilarity(ctx.reportData.text, t.description || t.title);
            if (ctx.reportData.text && (t.description || t.title) && textSim < 0.25) {
              continue;
            }
            
            neighbors.push({ id, lat: t.lat, lng: t.lng, distance: dist });
          }
          
          if (neighbors.length > 0) {
            bestId = neighbors.reduce((best, n) => {
              const bScore = ticketMetaById[best]?.priority_score ?? 0;
              const cScore = ticketMetaById[n.id]?.priority_score ?? 0;
              return cScore > bScore ? n.id : best;
            }, neighbors[0].id);
            found = true;
            break;
          }
        }
      }
    }

    ctx.clusterResult = { found, ticket_id: bestId, cluster_size: neighbors.length + 1, category: ctx.classificationResult.category, neighbors };

    const { enrichReasoning } = await import('./enricher.js');
    const clusterReasoning = await enrichReasoning('find_cluster', ctx.clusterResult) || 
      (found ? `Duplicate alert: matches existing incident cluster #${bestId}.` : 'No duplicate hotspots identified in proximity.');
    completeCluster(ctx.clusterResult, clusterReasoning);

    if (found) {
      const completeVerify = trace.startStep('record_verification', { found: true });
      const completeMerge = trace.startStep('merge_into_ticket', { ticket_id: bestId, reason: 'Duplicate found by clustering agent' });
      const ticketRef = db.collection('tickets').doc(bestId);
      const ticketDoc = await transaction.get(ticketRef);
      if (!ticketDoc.exists) throw new Error('Target merge ticket not found');
      
      const t = ticketDoc.data();
      const childReports = t.child_reports || [];
      childReports.push({ 
        reporter_id: ctx.userId, 
        reason: 'Duplicate found by clustering agent', 
        timestamp: new Date().toISOString() 
      });

      // Record upvote from duplicate reporter if not already voted
      const votes = t.votes || {};
      let verificationUp = t.verification_up || 0;
      let verificationDown = t.verification_down || 0;
      const verifiedBy = t.verified_by || [];

      if (ctx.userId && ctx.userId !== 'anonymous' && !votes[ctx.userId]) {
        votes[ctx.userId] = 'still_issue';
        verificationUp += 1;
        if (!verifiedBy.includes(ctx.userId)) {
          verifiedBy.push(ctx.userId);
        }
      }

      // Fetch user trust scores to compute weighted community votes ratio
      let weightedUp = 0;
      let weightedDown = 0;
      for (const [uid, vType] of Object.entries(votes)) {
        if (uid === 'anonymous') {
          if (vType === 'still_issue') weightedUp += 0.5;
          else weightedDown += 0.5;
          continue;
        }
        let vTrust = 0.5;
        const voterDocRef = db.collection('users').doc(uid);
        const voterDoc = await transaction.get(voterDocRef);
        if (voterDoc.exists) {
          const voterData = voterDoc.data();
          const totalActions = (voterData.reports_verified || 0) + (voterData.reports_rejected || 0);
          if (totalActions >= 10) {
            vTrust = voterData.trust_score ?? 0.5;
          }
        }
        if (vType === 'still_issue') weightedUp += vTrust;
        else weightedDown += vTrust;
      }

      const commVotesValue = (weightedUp + weightedDown) > 0
        ? (weightedUp / (weightedUp + weightedDown))
        : null;

      const { calculateVerificationScore, statusFromVerificationScore, calculateNearbyEvidence } = await import('../math/verification.js');
      const aiConfidence = t.ai_confidence ?? t.classificationResult?.confidence ?? 0.7;
      const nearbyEvidence = calculateNearbyEvidence(t.lat, t.lng, ctx.clusterResult.neighbors || []);

      const newVScore = calculateVerificationScore({
        aiConfidence,
        reporterTrust: t.reporter_trust ?? 0.5,
        nearbyEvidence,
        communityVotes: commVotesValue
      });
      const newStatus = statusFromVerificationScore(newVScore);

      // Recalculate priority
      const { computePriority } = await import('../math/priority.js');
      const slaDeadline = t.sla_deadline ? (t.sla_deadline.toDate?.() ?? new Date(t.sla_deadline)) : null;
      const ts = t.created_at?.toDate?.() ?? new Date(t.created_at);
      const elapsedHours = Number.isNaN(ts.getTime()) ? 0 : (Date.now() - ts.getTime()) / 3600000;
      const slaHours = Math.max(1, slaDeadline && !Number.isNaN(ts.getTime())
        ? (slaDeadline.getTime() - ts.getTime()) / 3600000
        : 48);

      const priorityResult = computePriority({
        severity: t.severity || 'medium',
        reportCount: childReports.length + 1,
        verificationUp,
        verificationDown,
        elapsedHours,
        slaHours,
        category: t.category || 'other',
        description: t.description || reportData.text,
        createdAt: t.created_at,
      });

      transaction.update(ticketRef, {
        child_reports: childReports,
        votes,
        verified_by: verifiedBy,
        verification_up: verificationUp,
        verification_score: newVScore,
        status: newStatus,
        priority_score: priorityResult,
        updated_at: new Date().toISOString()
      });

      ticketId = bestId;
      merged = true;
      
      ctx.verificationResult = { verification_score: newVScore, status: newStatus, explanation: 'Merged duplicate ticket. Verification score updated.' };
      completeVerify(ctx.verificationResult, `Multi-agent verification resolved score to ${newVScore}% (${newStatus}) after merging upvote.`);

      const mergeResult = { ticket_id: bestId, child_reports: childReports };
      const mergeReasoning = await enrichReasoning('merge_into_ticket', mergeResult) || `Merged report into existing ticket #${bestId}.`;
      completeMerge(mergeResult, mergeReasoning);
    } else {
      const completeVerify = trace.startStep('record_verification', { found: false });
      const completeCreate = trace.startStep('create_ticket', {
        title: reportData.text?.substring(0, 50) || 'Incident Report',
        description: reportData.text,
        category: ctx.classificationResult.category,
        severity: ctx.classificationResult.severity,
        lat: ctx.latitude,
        lng: ctx.longitude,
        address: ctx.geoResult.address,
        ward: ctx.geoResult.ward,
      });

      ticketId = `ticket-${uuidv4().substring(0, 8)}`;
      const slaHours = DEFAULT_PARAMS[ctx.classificationResult.category]?.lambda || 168;
      
      // Read reporter trust inside transaction
      let reporterTrust = 0.5;
      const repDocRef = db.collection('users').doc(ctx.userId);
      const repDoc = await transaction.get(repDocRef);
      if (repDoc.exists) {
        const repData = repDoc.data();
        const totalActions = (repData.reports_verified || 0) + (repData.reports_rejected || 0);
        if (totalActions >= 10) {
          reporterTrust = repData.trust_score ?? 0.5;
        }
      }

      const vScore = calculateVerificationScore({
        aiConfidence: ctx.classificationResult.confidence,
        reporterTrust,
        nearbyEvidence: 0.0,
        communityVotes: null
      });
      const vStatus = statusFromVerificationScore(vScore);
      ctx.vScore = vScore;
      ctx.vStatus = vStatus;
      ctx.verificationResult = { verification_score: vScore, explanation: 'Initial verification check passed. Awaiting community votes.' };
      completeVerify(ctx.verificationResult, `Multi-agent verification resolved score to ${vScore}% (${vStatus}).`);

      const initialPriority = computePriority({
        severity: ctx.classificationResult.severity || 'medium',
        reportCount: 1,
        verificationUp: 0,
        verificationDown: 0,
        elapsedHours: 0,
        slaHours,
        category: ctx.classificationResult.category || 'other',
        description: ctx.reportData.text,
        createdAt: new Date().toISOString(),
      });

      const ticket = {
        id: ticketId,
        title: reportData.text?.substring(0, 50) || 'Incident Report',
        description: reportData.text,
        category: ctx.classificationResult.category,
        severity: ctx.classificationResult.severity,
        status: vStatus,
        priority_score: initialPriority,
        lat: ctx.latitude,
        lng: ctx.longitude,
        address: ctx.geoResult.address || `${resolvedWard}, Lucknow`,
        ward: resolvedWard,
        asset_id: asset.id,
        asset_name: asset.name,
        department: DEPARTMENTS[ctx.classificationResult.category] || 'General Maintenance',
        media_urls: ctx.mediaUrls || [],
        media_type: ctx.mediaType || 'image',
        ai_classification: ctx.classificationResult,
        cloud_vision_result: ctx.cloudVisionResult || null,
        classification_agreement: ctx.classificationAgreement ?? true,
        reporter_id: ctx.userId,
        reporter_name: ctx.userName,
        verification_up: 0,
        verification_down: 0,
        verified_by: [],
        cluster_id: null,
        merged_into: null,
        child_reports: [],
        sla_deadline: new Date(Date.now() + slaHours * 3600000).toISOString(),
        sla_probability: 0,
        agent_trace: [],
        verification_score: vScore,
        verification_explanation: 'Initial verification check passed. Awaiting community votes.',
        priority_explanation: 'Initial priority calculated on severity and base metrics.',
        sla_risk_score: 0,
        sla_risk_explanation: 'SLA risk monitoring initiated.',
        dispatch_plan: {
          department: DEPARTMENTS[ctx.classificationResult.category] || 'General Maintenance',
          crew_size: 2,
          materials: ['tools'],
          estimated_cost: 4000,
          eta: '48h',
          explanation: 'Initial automated dispatch plan.',
        },
        cluster_explanation: 'No duplicate hotspots identified in proximity.',
        resolution_media_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        resolved_at: null,
      };

      transaction.set(db.collection('tickets').doc(ticketId), ticket);
      merged = false;

      const createResult = { ticket_id: ticketId, status: 'created' };
      const createReasoning = await enrichReasoning('create_ticket', createResult) || `Initialized new database ticket #${ticketId}.`;
      completeCreate(createResult, createReasoning);
    }
  });

  ctx.ticketId = ticketId;
  ctx.merged = merged;

  // 3. Post-Creation Generic Pipeline Loop (Priority, SLA, Planner)
  const postAgents = [
    PriorityAgent,
    SLAAgent,
    PlannerAgent
  ];
  for (const agent of postAgents) {
    await agent.execute(ctx);
  }

  // 4. Notifications & Broadcast
  await GovernanceAgent.executeNotify(ctx);
  await updateAssetHealth(asset.id);

  if (ticketId && ctx.userId !== 'anonymous') {
    const { awardXP } = await import('../services/userService.js');
    try {
      await awardXP(ctx.userId, merged ? 'vote' : 'report', ticketId);
    } catch (err) {
      console.error('[XP Award] Failed to award XP:', err.message);
    }
  }

  // 5. Root Cause Diagnosis Setup
  let reportsForRootCause = [];
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
    agent_messages: ctx.messageBus.getMessages(),
    verification_score: ctx.verificationResult.verification_score,
    verification_explanation: ctx.verificationResult.explanation,
    priority_explanation: ctx.priorityResult.explanation || 'Priority resolved.',
    priority_detail: ctx.priorityResult.priority_detail || null,
    sla_risk_score: Math.round((ctx.slaResult.probability || 0) * 100),
    sla_risk_explanation: ctx.slaResult.explanation || 'SLA probability resolved.',
    sla_params: ctx.slaResult.localized_params || null,
    dispatch_plan: ctx.planResult,
    cluster_explanation: ctx.clusterResult.found ? 'Clusters detected and resolved.' : 'No duplicate hotspots identified.',
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

  // Clean up expired demo accounts (G1-5)
  try {
    const usersSnap = await db.collection('users').get();
    const nowMs = Date.now();
    for (const doc of usersSnap.docs) {
      const u = doc.data();
      if (u.email && u.email.startsWith('google.hero.')) {
        const joined = u.joined_at ? new Date(u.joined_at).getTime() : nowMs;
        if (nowMs - joined > 24 * 3600 * 1000) {
          console.log(`[Scheduler] Cleaning up expired demo user account: ${u.email}`);
          await db.collection('users').doc(doc.id).delete();
        }
      }
    }
  } catch (err) {
    console.warn('[Scheduler] Demo users cleanup failed:', err.message);
  }

  return { processed: processedCount, trace: trace.getSteps() };
}
