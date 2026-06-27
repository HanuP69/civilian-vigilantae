import { db, setDb, createMockFirestore } from '../config/firebase.js';
import { computeRecurrenceRisk } from '../math/recurrence.js';

export async function writeSeedDoc(collectionName, id, data) {
  try {
    await db.collection(collectionName).doc(id).set(data);
    return true;
  } catch (err) {
    console.error(`[Seed] Firestore write failed for ${collectionName}/${id}:`, err?.code, err?.message);
    throw err;
  }
}

export async function getAllTickets(filters = {}) {
  let query = db.collection('tickets');
  
  if (filters.status) query = query.where('status', '==', filters.status);
  if (filters.category) query = query.where('category', '==', filters.category);
  if (filters.ward) query = query.where('ward', '==', filters.ward);
  if (filters.severity) query = query.where('severity', '==', filters.severity);

  const snap = await query.get();
  let tickets = [];
  snap.forEach(doc => tickets.push({ ...doc.data(), id: doc.id }));

  tickets.sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));
  return tickets;
}

export async function getTicketById(id) {
  const doc = await db.collection('tickets').doc(id).get();
  return doc.exists ? doc.data() : null;
}

export async function updateTicket(id, data) {
  data.updated_at = new Date().toISOString();
  await db.collection('tickets').doc(id).update(data);
  return { id, ...data };
}

export async function getDashboardStats() {
  const tickets = await getAllTickets();
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const resolved = tickets.filter(t => t.status === 'resolved');
  const activeTickets = tickets.filter(t => t.status !== 'resolved');
  const resolvedThisWeek = resolved.filter(t => {
    const resTs = t.resolved_at?.toDate?.() ?? new Date(t.resolved_at);
    return resTs > weekAgo;
  });
  const activeReporters = new Set(
    tickets
      .filter(t => {
        const creTs = t.created_at?.toDate?.() ?? new Date(t.created_at);
        return creTs > weekAgo;
      })
      .map(t => t.reporter_id)
  );

  const avgResolution = resolved.length > 0
    ? resolved.reduce((s, t) => {
        const resTs = t.resolved_at?.toDate?.() ?? new Date(t.resolved_at);
        const creTs = t.created_at?.toDate?.() ?? new Date(t.created_at);
        return s + (resTs - creTs) / 3600000;
      }, 0) / resolved.length
    : 0;

  const byCategory = {};
  const byWard = {};
  const byStatus = {};
  const byDept = {};

  for (const t of tickets) {
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    byWard[t.ward] = (byWard[t.ward] || 0) + 1;
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    if (!byDept[t.department]) byDept[t.department] = { total: 0, resolved: 0, totalTime: 0 };
    byDept[t.department].total++;
    if (t.status === 'resolved') {
      byDept[t.department].resolved++;
      const resTs = t.resolved_at?.toDate?.() ?? new Date(t.resolved_at);
      const creTs = t.created_at?.toDate?.() ?? new Date(t.created_at);
      byDept[t.department].totalTime += (resTs - creTs) / 3600000;
    }
  }

  // Phase 5: Urban Intelligence Agent calculations
  const WARDS = ['Hazratganj', 'Aminabad', 'Aliganj', 'Gomti Nagar', 'Indira Nagar', 'Alambagh', 'Chowk', 'Rajajipuram'];
  const wardHealthScores = {};

  for (const w of WARDS) {
    const activeInWard = activeTickets.filter(t => t.ward === w);
    if (activeInWard.length > 0) {
      const avgPriority = activeInWard.reduce((s, t) => s + (t.priority_score || 0), 0) / activeInWard.length;
      const activeCount = activeInWard.length;
      const verifiedCount = activeInWard.filter(t => t.status === 'verified').length;
      const recurrenceCount = activeInWard.filter(t => t.cluster_id !== null || (t.child_reports && t.child_reports.length > 0)).length;
      
      const deduction = (avgPriority * 0.5) + (activeCount * 2) + (verifiedCount * 1.5) + (recurrenceCount * 2);
      wardHealthScores[w] = Math.max(0, Math.min(100, Math.round(100 - deduction)));
    } else {
      wardHealthScores[w] = 100;
    }
  }

  const deptLeaderboard = Object.entries(byDept).map(([name, d]) => ({
    name, total: d.total, resolved: d.resolved,
    resolution_rate: d.total > 0 ? Math.round(d.resolved / d.total * 100) : 0,
    avg_hours: d.resolved > 0 ? Math.round(d.totalTime / d.resolved) : 0,
  })).sort((a, b) => b.resolution_rate - a.resolution_rate);

  // Department risks (average priority of active tickets)
  const departmentRisks = {};
  const DEPTS = ['Roads & Infrastructure', 'Water Supply', 'Electrical & Lighting', 'Sanitation & Waste Management', 'General Maintenance', 'Drainage & Sewerage'];
  for (const d of DEPTS) {
    const activeInDept = activeTickets.filter(t => t.department === d);
    if (activeInDept.length > 0) {
      const avgPriority = activeInDept.reduce((s, t) => s + (t.priority_score || 0), 0) / activeInDept.length;
      departmentRisks[d] = Math.round(avgPriority);
    } else {
      departmentRisks[d] = 0;
    }
  }

  // Recurrence risk details
  const resolvedForRecurrence = resolved.map(t => ({
    resolved_at: t.resolved_at,
    category: t.category,
    ward: t.ward,
  }));
  const recurrenceForecasts = computeRecurrenceRisk(resolvedForRecurrence, 14);

  return {
    total: tickets.length, resolved: resolved.length,
    resolvedThisWeek: resolvedThisWeek.length,
    activeReporters: activeReporters.size,
    avgResolutionHours: Math.round(avgResolution),
    byCategory, byWard, byStatus, deptLeaderboard,
    wardHealthScores,
    departmentRisks,
    recurrenceForecasts,
  };
}

export async function loadSeedData() {
  try {
    const { readFileSync } = await import('fs');
    const { fileURLToPath } = await import('url');
    const { dirname, join } = await import('path');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const seedPath = join(__dirname, '..', 'seed', 'seedOutput.json');
    const data = JSON.parse(readFileSync(seedPath, 'utf-8'));

    try {
      for (const ticket of data.tickets) await writeSeedDoc('tickets', ticket.id, ticket);
      for (const user of data.users) await writeSeedDoc('users', user.uid, user);
      for (const dept of data.departments) await writeSeedDoc('departments', dept.id, dept);

      console.log(`[Seed] Loaded ${data.tickets.length} tickets, ${data.users.length} users, ${data.departments.length} departments`);
      return data;
    } catch (dbErr) {
      console.warn(`[Seed] Firestore write failed during boot: ${dbErr.message}`);
      console.warn('[Firebase] 🔴 Falling back to clean IN-MEMORY Mock Firestore to guarantee continuous application startup!');
      const mockDb = createMockFirestore();
      setDb(mockDb);

      for (const ticket of data.tickets) {
        await mockDb.collection('tickets').doc(ticket.id).set(ticket);
      }
      for (const user of data.users) {
        await mockDb.collection('users').doc(user.uid).set(user);
      }
      for (const dept of data.departments) {
        await mockDb.collection('departments').doc(dept.id).set(dept);
      }
      console.log(`[Seed] Successfully seeded in-memory database with ${data.tickets.length} tickets, ${data.users.length} users, ${data.departments.length} departments`);
      return data;
    }
  } catch (err) {
    console.warn('[Seed] Could not load seed data:', err.message);
    return null;
  }
}
