import { db } from '../config/firebase.js';
import { dbscan, compositeDistance } from '../math/dbscan.js';
import { computePriority, computePriorityWithBreakdown } from '../math/priority.js';
import { weibullCDF, DEFAULT_PARAMS, weibullConditionalProbability, weibullMLE } from '../math/weibull.js';
import { computeRecurrenceRisk } from '../math/recurrence.js';
import { haversine } from '../math/haversine.js';
import { v4 as uuidv4 } from 'uuid';
import { broadcast } from '../services/sseService.js';
import { classifyWithLLM } from '../services/classificationService.js';

const DEPARTMENTS = {
  pothole: 'Roads & Infrastructure', water_leak: 'Water Supply', streetlight: 'Electrical & Lighting',
  waste: 'Sanitation & Waste Management', road_damage: 'Roads & Infrastructure',
  drainage: 'Drainage & Sewerage', other: 'General Maintenance',
};

const WARD_LOOKUP = [
  { name: 'Hazratganj', center: [26.8500, 80.9450], radius: 0.015 },
  { name: 'Aminabad', center: [26.8467, 80.9310], radius: 0.012 },
  { name: 'Aliganj', center: [26.8850, 80.9390], radius: 0.018 },
  { name: 'Gomti Nagar', center: [26.8560, 80.9830], radius: 0.020 },
  { name: 'Indira Nagar', center: [26.8720, 80.9860], radius: 0.018 },
  { name: 'Alambagh', center: [26.8180, 80.9110], radius: 0.015 },
  { name: 'Chowk', center: [26.8580, 80.9170], radius: 0.012 },
  { name: 'Rajajipuram', center: [26.8530, 80.8920], radius: 0.016 },
];

function resolveWard(lat, lng) {
  let closest = WARD_LOOKUP[0];
  let minDist = Infinity;
  for (const w of WARD_LOOKUP) {
    const d = haversine(lat, lng, w.center[0], w.center[1]);
    if (d < minDist) { minDist = d; closest = w; }
  }
  return closest.name;
}

async function updateVoterReputations(votes, newStatus) {
  const { awardXP } = await import('../services/userService.js');
  for (const [uid, voteType] of Object.entries(votes)) {
    if (uid === 'anonymous') continue;

    let isCorrect = false;
    if (newStatus === 'verified') {
      isCorrect = (voteType === 'still_issue');
    } else if (newStatus === 'resolved') {
      isCorrect = (voteType === 'looks_resolved');
    } else if (newStatus === 'disputed') {
      isCorrect = (voteType === 'looks_resolved');
    } else {
      continue;
    }

    try {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (!userDoc.exists) continue;
      const userData = userDoc.data();

      const reportsVerified = (userData.reports_verified || 0) + (isCorrect ? 1 : 0);
      const reportsRejected = (userData.reports_rejected || 0) + (isCorrect ? 0 : 1);
      const totalVotes = reportsVerified + reportsRejected;
      const accuracy = totalVotes > 0 ? (reportsVerified / totalVotes) : 1.0;

      // Laplace smoothing: trust_score = (reportsVerified + 1) / (totalVotes + 2)
      const trustScore = Math.round(((reportsVerified + 1) / (totalVotes + 2)) * 100) / 100;

      await userRef.update({
        reports_verified: reportsVerified,
        reports_rejected: reportsRejected,
        verification_accuracy: accuracy,
        trust_score: trustScore,
      });

      if (isCorrect) {
        await awardXP(uid, 'vote_accurate');
      }
    } catch (err) {
      console.error(`[Reputation] Failed to update voter ${uid}:`, err.message);
    }
  }
}

export const toolHandlers = {
  async classify_issue({ text, has_media }, ctx) {
    if (ctx.classificationResult) {
      return ctx.classificationResult;
    }

    if (has_media && ctx?.mediaBase64 && ctx?.mediaMimeType) {
      const result = await classifyWithLLM(ctx.mediaBase64, ctx.mediaMimeType, text);
      return result;
    }

    if (text) {
      const result = await classifyWithLLM(null, 'text/plain', text);
      return result;
    }

    return { category: 'other', severity: 'medium', confidence: 0.5, reasoning: 'Text-only fallback classification' };
  },

  async geo_resolve({ lat, lng }) {
    const ward = resolveWard(lat, lng);
    return { address: `${ward}, Lucknow, Uttar Pradesh`, ward, lat, lng };
  },

  async find_cluster({ lat, lng, category, timestamp }) {
    const ticketsSnap = await db.collection('tickets').get();
    const recentTickets = [];
    const parsedTimestamp = timestamp ? new Date(timestamp) : new Date();
    const now = Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp;
    const windowMs = 72 * 60 * 60 * 1000;

    ticketsSnap.forEach(doc => {
      const t = doc.data();
      if (t.status === 'resolved') return;
      const created = t.created_at?.toDate?.() ?? new Date(t.created_at);
      if (now - created < windowMs) {
        recentTickets.push({ id: t.id, lat: t.lat, lng: t.lng, timestamp: created, category: t.category });
      }
    });

    const newPoint = { id: '__new__', lat, lng, timestamp: now, category };
    const points = [...recentTickets, newPoint];
    if (points.length < 2) return { found: false };

    const { clusters } = dbscan(points);
    for (const cluster of clusters) {
      if (cluster.includes('__new__')) {
        const existingId = cluster.find(id => id !== '__new__');
        if (existingId) {
          const neighbors = cluster.filter(id => id !== '__new__');
          return { found: true, ticket_id: existingId, cluster_size: cluster.length, category, neighbors };
        }
      }
    }
    return { found: false, neighbors: [] };
  },

  async compute_priority({ ticket_id }) {
    const doc = await db.collection('tickets').doc(ticket_id).get();
    if (!doc.exists) return { error: 'Ticket not found' };
    const t = doc.data();
    const ts = t.created_at?.toDate?.() ?? new Date(t.created_at);
    const elapsedHours = Number.isNaN(ts.getTime()) ? 0 : (Date.now() - ts.getTime()) / 3600000;
    const slaHours = DEFAULT_PARAMS[t.category]?.lambda || 168;
    const result = computePriorityWithBreakdown({
      severity: t.severity, reportCount: (t.child_reports?.length || 0) + 1,
      verificationUp: t.verification_up || 0, verificationDown: t.verification_down || 0,
      elapsedHours, slaHours, category: t.category,
    });
    await db.collection('tickets').doc(ticket_id).update({
      priority_score: result.score,
      priority_detail: result.breakdown,
    });
    broadcast('ticket_updated', { ticket_id, event: 'priority_computed', priority_score: result.score, priority_detail: result.breakdown });
    return { ticket_id, priority_score: result.score, priority_detail: result.breakdown };
  },

  async create_ticket({ title, description, category, severity, lat, lng, address, ward, department, status }, ctx) {
    const id = `ticket-${uuidv4().substring(0, 8)}`;
    const slaHours = DEFAULT_PARAMS[category]?.lambda || 168;
    const initialPriority = computePriority({
      severity: severity || 'medium',
      reportCount: 1,
      verificationUp: 0,
      verificationDown: 0,
      elapsedHours: 0,
      slaHours,
      category: category || 'other',
    });
    const ticket = {
      id, title, description, category, severity, status: status || 'reported',
      priority_score: initialPriority, lat, lng,
      address: address || `${ward || resolveWard(lat, lng)}, Lucknow`,
      ward: ward || resolveWard(lat, lng),
      department: department || DEPARTMENTS[category] || 'General Maintenance',
      media_urls: ctx?.mediaUrls || [], media_type: ctx?.mediaType || 'image',
      ai_classification: ctx?.classificationResult || { category, severity, confidence: 0.8, source: 'gemini' },
      cloud_vision_result: ctx?.cloudVisionResult || null,
      classification_agreement: ctx?.classificationAgreement ?? true,
      reporter_id: ctx?.userId || 'anonymous',
      reporter_name: ctx?.userName || 'Anonymous',
      verification_up: 0, verification_down: 0, verified_by: [],
      cluster_id: null, merged_into: null, child_reports: [],
      sla_deadline: new Date(Date.now() + slaHours * 3600000).toISOString(),
      sla_probability: 0, agent_trace: ctx?.trace?.getSteps() || [],
      verification_score: 70,
      verification_explanation: 'Initial verification check passed. Awaiting community votes.',
      priority_explanation: 'Initial priority calculated on severity and base metrics.',
      sla_risk_score: 0,
      sla_risk_explanation: 'SLA risk monitoring initiated.',
      dispatch_plan: {
        department: department || DEPARTMENTS[category] || 'General Maintenance',
        crew_size: 2,
        materials: ['tools'],
        estimated_cost: 4000,
        eta: '48h',
        explanation: 'Initial automated dispatch plan.',
      },
      cluster_explanation: 'No duplicate hotspots identified in proximity.',
      resolution_media_url: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), resolved_at: null,
    };
    await db.collection('tickets').doc(id).set(ticket);
    broadcast('ticket_created', ticket);
    return { ticket_id: id, status: 'created' };
  },

  async merge_into_ticket({ ticket_id, reason }, ctx) {
    const doc = await db.collection('tickets').doc(ticket_id).get();
    if (!doc.exists) return { error: 'Ticket not found' };
    const t = doc.data();
    const childReports = t.child_reports || [];
    childReports.push({ reporter_id: ctx?.userId, reason, timestamp: new Date().toISOString() });
    await db.collection('tickets').doc(ticket_id).update({
      child_reports: childReports, updated_at: new Date().toISOString(),
    });
    broadcast('ticket_updated', { ticket_id, event: 'merged', reason });
    return { ticket_id, merged: true, total_reports: childReports.length + 1 };
  },

  async record_verification({ ticket_id, vote_type }, ctx) {
    const doc = await db.collection('tickets').doc(ticket_id).get();
    if (!doc.exists) return { error: 'Ticket not found' };
    const t = doc.data();
    const votes = t.votes || {};
    const userId = ctx?.userId || 'anonymous';
    if (userId !== 'anonymous' && votes[userId]) {
      return { error: 'Already voted' };
    }
    votes[userId] = vote_type;

    const newUp = Object.values(votes).filter(v => v === 'still_issue').length;
    const newDown = Object.values(votes).filter(v => v === 'looks_resolved').length;

    // Fetch user trust scores to compute weighted community votes ratio
    let weightedUp = 0;
    let weightedDown = 0;
    for (const [uid, vType] of Object.entries(votes)) {
      if (uid === 'anonymous') {
        if (vType === 'still_issue') weightedUp += 0.5;
        else weightedDown += 0.5;
        continue;
      }
      const voterDoc = await db.collection('users').doc(uid).get();
      const vTrust = voterDoc.exists ? (voterDoc.data().trust_score ?? 0.5) : 0.5;
      if (vType === 'still_issue') weightedUp += vTrust;
      else weightedDown += vTrust;
    }
    const commVotesValue = (weightedUp + weightedDown) > 0
      ? (weightedUp / (weightedUp + weightedDown))
      : 0.5;

    // Get components for verification score recalculation
    let reporterTrust = t.reporter_trust;
    if (reporterTrust === undefined && t.reporter_id) {
      const repDoc = await db.collection('users').doc(t.reporter_id).get();
      if (repDoc.exists) {
        reporterTrust = repDoc.data().trust_score ?? 0.5;
      }
    }
    if (reporterTrust === undefined) reporterTrust = 0.5;

    const aiConfidence = t.ai_confidence ?? t.classificationResult?.confidence ?? 0.7;
    const nearbyEvidence = t.nearby_evidence ?? (t.cluster_detail?.found ? Math.min((t.cluster_detail.cluster_size || 1) / 5, 1.0) : 0.0);

    const { calculateVerificationScore, statusFromVerificationScore } = await import('../math/verification.js');
    const newVScore = calculateVerificationScore({
      aiConfidence,
      reporterTrust,
      nearbyEvidence,
      communityVotes: commVotesValue,
    });

    let newStatus = statusFromVerificationScore(newVScore);

    // Apply count thresholds for community resolution or reopening
    let finalStatus = newStatus;
    let resolvedAt = t.resolved_at || null;
    if (newDown >= 5 && t.status !== 'resolved') {
      finalStatus = 'resolved';
      resolvedAt = new Date().toISOString();
    } else if (newUp >= 5 && t.status === 'resolved') {
      finalStatus = 'reopened';
    } else if (t.status === 'resolved') {
      finalStatus = 'resolved';
    }

    // Recalculate Priority Score
    const { computePriorityWithBreakdown } = await import('../math/priority.js');
    const ts = t.created_at?.toDate?.() ?? new Date(t.created_at);
    const elapsedHours = Number.isNaN(ts.getTime()) ? 0 : (Date.now() - ts.getTime()) / 3600000;
    const slaDeadline = t.sla_deadline ? (t.sla_deadline.toDate?.() ?? new Date(t.sla_deadline)) : null;
    const slaHours = slaDeadline && !Number.isNaN(ts.getTime())
      ? (slaDeadline.getTime() - ts.getTime()) / 3600000
      : 48;

    const priorityResult = computePriorityWithBreakdown({
      severity: t.severity || 'medium',
      reportCount: t.cluster_detail?.cluster_size || 1,
      verificationUp: newUp,
      verificationDown: newDown,
      elapsedHours,
      slaHours,
      category: t.category || 'other',
    });

    const update = {
      updated_at: new Date().toISOString(),
      votes,
      verified_by: Object.keys(votes),
      verification_up: newUp,
      verification_down: newDown,
      verification_score: newVScore,
      status: finalStatus,
      resolved_at: resolvedAt,
      priority_score: priorityResult.score,
      priority_detail: priorityResult.breakdown,
      ai_confidence: aiConfidence,
      reporter_trust: reporterTrust,
      nearby_evidence: nearbyEvidence,
    };

    await db.collection('tickets').doc(ticket_id).update(update);

    // Update voter reputations and award XP if status transitioned
    if (finalStatus !== t.status) {
      await updateVoterReputations(votes, finalStatus);
    }

    broadcast('verification_recorded', { ticket_id, vote_type, up: newUp, down: newDown, status: finalStatus });
    return { ticket_id, verification_up: newUp, verification_down: newDown };
  },

  async check_sla_status({ ticket_id }) {
    const doc = await db.collection('tickets').doc(ticket_id).get();
    if (!doc.exists) return { error: 'Ticket not found' };
    const t = doc.data();
    const ts = t.created_at?.toDate?.() ?? new Date(t.created_at);
    const elapsedHours = Number.isNaN(ts.getTime()) ? 0 : (Date.now() - ts.getTime()) / 3600000;
    const params = DEFAULT_PARAMS[t.category] || DEFAULT_PARAMS.other;
    const slaDeadline = t.sla_deadline ? (t.sla_deadline.toDate?.() ?? new Date(t.sla_deadline)) : null;
    const slaHours = slaDeadline
      ? (slaDeadline.getTime() - ts.getTime()) / 3600000
      : params.lambda;

    // Localized Weibull MLE Parameter Estimation
    const resolvedSnap = await db.collection('tickets')
      .where('status', '==', 'resolved')
      .where('ward', '==', t.ward)
      .where('category', '==', t.category)
      .get();
    
    const intervals = [];
    resolvedSnap.forEach(rd => {
      const ticketData = rd.data();
      if (ticketData.resolved_at && ticketData.created_at) {
        const resTs = ticketData.resolved_at?.toDate?.() ?? new Date(ticketData.resolved_at);
        const creTs = ticketData.created_at?.toDate?.() ?? new Date(ticketData.created_at);
        const durationH = (resTs.getTime() - creTs.getTime()) / 3600000;
        if (durationH > 0) intervals.push(durationH);
      }
    });

    let fitParams = { lambda: params.lambda, k: params.k };
    let localizedUsed = false;
    if (intervals.length >= 3) {
      try {
        fitParams = weibullMLE(intervals);
        localizedUsed = true;
      } catch (err) {
        // Fallback to category defaults if MLE fails to converge
      }
    }

    const breached = slaDeadline ? Date.now() > slaDeadline.getTime() : elapsedHours > slaHours;
    const probability = breached ? 0 : weibullConditionalProbability(elapsedHours, slaHours, fitParams.lambda, fitParams.k);

    await db.collection('tickets').doc(ticket_id).update({
      sla_probability: probability,
      sla_risk_score: Math.round(probability * 100),
      sla_risk_explanation: `Weibull conditional resolution probability is ${Math.round(probability * 100)}% with parameters scale lambda = ${Math.round(fitParams.lambda * 10) / 10}h and shape k = ${Math.round(fitParams.k * 100) / 100}.`,
      sla_params: { lambda: fitParams.lambda, k: fitParams.k, localizedUsed }
    });
    return { 
      ticket_id, 
      elapsed_hours: Math.round(elapsedHours), 
      sla_hours: Math.round(slaHours), 
      probability: Math.round(probability * 100) / 100, 
      breached,
      localized_params: { lambda: Math.round(fitParams.lambda * 10) / 10, k: Math.round(fitParams.k * 100) / 100, localizedUsed }
    };
  },

  async escalate_ticket({ ticket_id, reason }) {
    const doc = await db.collection('tickets').doc(ticket_id).get();
    if (!doc.exists) return { error: 'Ticket not found' };
    const t = doc.data();
    const ts = t.created_at?.toDate?.() ?? new Date(t.created_at);
    const elapsedHours = Number.isNaN(ts.getTime()) ? 0 : (Date.now() - ts.getTime()) / 3600000;
    const slaHours = DEFAULT_PARAMS[t.category]?.lambda || 168;
    const nextSeverity = t.severity === 'low' ? 'medium' : (t.severity === 'medium' ? 'high' : 'critical');
    const score = computePriority({
      severity: nextSeverity,
      reportCount: (t.child_reports?.length || 0) + 1,
      verificationUp: t.verification_up || 0, verificationDown: t.verification_down || 0,
      elapsedHours, slaHours, category: t.category,
    });
    await db.collection('tickets').doc(ticket_id).update({
      status: 'in_progress', severity: nextSeverity, priority_score: score, updated_at: new Date().toISOString(),
    });
    broadcast('ticket_updated', { ticket_id, event: 'escalated', reason, priority_score: score });
    return { ticket_id, escalated: true, reason, priority_score: score };
  },

  async notify_reporters({ ticket_id, status }) {
    broadcast('ticket_updated', { ticket_id, status, timestamp: new Date().toISOString() });
    return { ticket_id, notified: true };
  },

  async flag_for_review({ ticket_id, reason }) {
    await db.collection('tickets').doc(ticket_id).update({
      status: 'needs_review', updated_at: new Date().toISOString(),
    });
    broadcast('ticket_updated', { ticket_id, event: 'flagged', reason });
    return { ticket_id, flagged: true, reason };
  },

  async query_recurrence_risk({ ward, category }) {
    const ticketsSnap = await db.collection('tickets').get();
    const resolved = [];
    ticketsSnap.forEach(doc => {
      const t = doc.data();
      if (t.status === 'resolved' && t.resolved_at && t.ward === ward && t.category === category) {
        resolved.push({ resolved_at: t.resolved_at?.toDate?.() ?? new Date(t.resolved_at), category: t.category, ward: t.ward });
      }
    });
    if (resolved.length < 2) {
      const params = DEFAULT_PARAMS[category] || DEFAULT_PARAMS.other;
      return { ward, category, probability: 0.5, lambda: params.lambda, k: params.k, data_points: resolved.length, recommendation: 'Insufficient data — using defaults' };
    }
    const risks = computeRecurrenceRisk(resolved, 14);
    const match = risks.find(r => r.ward === ward && r.category === category);
    return match || { ward, category, probability: 0.3, recommendation: 'Low risk' };
  },

  async query_ward_historical_stats({ ward, category }) {
    const snap = await db.collection('tickets')
      .where('ward', '==', ward)
      .where('category', '==', category)
      .get();
    
    const scores = [];
    let resolvedCount = 0;
    let totalDurations = 0;

    snap.forEach(doc => {
      const t = doc.data();
      if (t.priority_score !== undefined) scores.push(t.priority_score);
      if (t.status === 'resolved' && t.resolved_at && t.created_at) {
        resolvedCount++;
        const resTs = t.resolved_at?.toDate?.() ?? new Date(t.resolved_at);
        const creTs = t.created_at?.toDate?.() ?? new Date(t.created_at);
        totalDurations += (resTs.getTime() - creTs.getTime()) / 3600000;
      }
    });

    const count = snap.size;
    if (count === 0) {
      return { ward, category, count: 0, mean_priority: 50, stdev_priority: 0, avg_resolution_hours: 0 };
    }

    const sum = scores.reduce((a, b) => a + b, 0);
    const mean = sum / (scores.length || 1);
    const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / (scores.length || 1);
    const stdev = Math.sqrt(variance);

    return {
      ward,
      category,
      count,
      mean_priority: Math.round(mean * 10) / 10,
      stdev_priority: Math.round(stdev * 10) / 10,
      avg_resolution_hours: resolvedCount > 0 ? Math.round(totalDurations / resolvedCount) : null
    };
  },

  async audit_ticket_details({ ticket_id }) {
    const doc = await db.collection('tickets').doc(ticket_id).get();
    if (!doc.exists) return { error: 'Ticket not found' };
    return doc.data();
  },
};
