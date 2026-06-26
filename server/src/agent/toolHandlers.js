import { db } from '../config/firebase.js';
import { dbscan, compositeDistance } from '../math/dbscan.js';
import { computePriority } from '../math/priority.js';
import { weibullCDF, DEFAULT_PARAMS } from '../math/weibull.js';
import { computeRecurrenceRisk } from '../math/recurrence.js';
import { haversine } from '../math/haversine.js';
import { v4 as uuidv4 } from 'uuid';
import { broadcast } from '../services/sseService.js';
import { classifyWithGemini } from '../services/classificationService.js';

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

export const toolHandlers = {
  async classify_issue({ text, has_media }, ctx) {
    if (ctx.classificationResult) {
      return ctx.classificationResult;
    }

    if (has_media && ctx?.mediaBase64 && ctx?.mediaMimeType) {
      const result = await classifyWithGemini(ctx.mediaBase64, ctx.mediaMimeType, text);
      return result;
    }

    if (text) {
      const result = await classifyWithGemini(null, 'text/plain', text);
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
    const now = new Date(timestamp);
    const windowMs = 72 * 60 * 60 * 1000;

    ticketsSnap.forEach(doc => {
      const t = doc.data();
      if (t.status === 'resolved') return;
      const created = new Date(t.created_at);
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
        if (existingId) return { found: true, ticket_id: existingId, cluster_size: cluster.length };
      }
    }
    return { found: false };
  },

  async compute_priority({ ticket_id }) {
    const doc = await db.collection('tickets').doc(ticket_id).get();
    if (!doc.exists) return { error: 'Ticket not found' };
    const t = doc.data();
    const elapsedHours = (Date.now() - new Date(t.created_at).getTime()) / 3600000;
    const slaHours = DEFAULT_PARAMS[t.category]?.lambda || 168;
    const score = computePriority({
      severity: t.severity, reportCount: (t.child_reports?.length || 0) + 1,
      verificationUp: t.verification_up || 0, verificationDown: t.verification_down || 0,
      elapsedHours, slaHours, category: t.category,
    });
    await db.collection('tickets').doc(ticket_id).update({ priority_score: score });
    broadcast('ticket_updated', { ticket_id, event: 'priority_computed', priority_score: score });
    return { ticket_id, priority_score: score };
  },

  async create_ticket({ title, description, category, severity, lat, lng, address, ward, department }, ctx) {
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
      id, title, description, category, severity, status: 'reported',
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
    const verifiedBy = t.verified_by || [];
    if (ctx?.userId && verifiedBy.includes(ctx.userId)) return { error: 'Already voted' };

    const newUp = (t.verification_up || 0) + (vote_type === 'still_issue' ? 1 : 0);
    const newDown = (t.verification_down || 0) + (vote_type === 'looks_resolved' ? 1 : 0);

    const update = {
      updated_at: new Date().toISOString(),
      verification_up: newUp,
      verification_down: newDown,
    };
    if (ctx?.userId) { verifiedBy.push(ctx.userId); update.verified_by = verifiedBy; }

    const status = t.status;
    if (newUp >= 5 && status === 'resolved') update.status = 'reopened';
    else if (newDown >= 5 && status !== 'resolved') update.status = 'resolved';
    else if (newUp >= 3 && status === 'reported') update.status = 'verified';

    await db.collection('tickets').doc(ticket_id).update(update);
    broadcast('verification_recorded', { ticket_id, vote_type, up: newUp, down: newDown });
    return { ticket_id, verification_up: newUp, verification_down: newDown };
  },

  async check_sla_status({ ticket_id }) {
    const doc = await db.collection('tickets').doc(ticket_id).get();
    if (!doc.exists) return { error: 'Ticket not found' };
    const t = doc.data();
    const elapsedHours = (Date.now() - new Date(t.created_at).getTime()) / 3600000;
    const params = DEFAULT_PARAMS[t.category] || DEFAULT_PARAMS.other;
    const slaDeadline = t.sla_deadline ? new Date(t.sla_deadline) : null;
    const slaHours = slaDeadline
      ? (slaDeadline.getTime() - new Date(t.created_at).getTime()) / 3600000
      : params.lambda;
    const probability = weibullCDF(slaHours, params.lambda, params.k);
    const breached = slaDeadline ? Date.now() > slaDeadline.getTime() : elapsedHours > slaHours;
    await db.collection('tickets').doc(ticket_id).update({ sla_probability: probability });
    return { ticket_id, elapsed_hours: Math.round(elapsedHours), sla_hours: Math.round(slaHours), probability: Math.round(probability * 100) / 100, breached };
  },

  async escalate_ticket({ ticket_id, reason }) {
    const doc = await db.collection('tickets').doc(ticket_id).get();
    if (!doc.exists) return { error: 'Ticket not found' };
    const t = doc.data();
    const elapsedHours = (Date.now() - new Date(t.created_at).getTime()) / 3600000;
    const slaHours = DEFAULT_PARAMS[t.category]?.lambda || 168;
    const score = computePriority({
      severity: t.severity === 'low' ? 'medium' : (t.severity === 'medium' ? 'high' : 'critical'),
      reportCount: (t.child_reports?.length || 0) + 1,
      verificationUp: t.verification_up || 0, verificationDown: t.verification_down || 0,
      elapsedHours, slaHours, category: t.category,
    });
    await db.collection('tickets').doc(ticket_id).update({
      status: 'in_progress', priority_score: score, updated_at: new Date().toISOString(),
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
        resolved.push({ resolved_at: new Date(t.resolved_at), category: t.category, ward: t.ward });
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
};
