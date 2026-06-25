import { db } from '../config/firebase.js';

export async function getAllTickets(filters = {}) {
  let query = db.collection('tickets');
  const snap = await query.get();
  let tickets = [];
  snap.forEach(doc => tickets.push(doc.data()));

  if (filters.status) tickets = tickets.filter(t => t.status === filters.status);
  if (filters.category) tickets = tickets.filter(t => t.category === filters.category);
  if (filters.ward) tickets = tickets.filter(t => t.ward === filters.ward);
  if (filters.severity) tickets = tickets.filter(t => t.severity === filters.severity);

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
  const resolvedThisWeek = resolved.filter(t => new Date(t.resolved_at) > weekAgo);
  const activeReporters = new Set(tickets.filter(t => new Date(t.created_at) > weekAgo).map(t => t.reporter_id));

  const avgResolution = resolved.length > 0
    ? resolved.reduce((s, t) => s + (new Date(t.resolved_at) - new Date(t.created_at)) / 3600000, 0) / resolved.length
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
      byDept[t.department].totalTime += (new Date(t.resolved_at) - new Date(t.created_at)) / 3600000;
    }
  }

  const deptLeaderboard = Object.entries(byDept).map(([name, d]) => ({
    name, total: d.total, resolved: d.resolved,
    resolution_rate: d.total > 0 ? Math.round(d.resolved / d.total * 100) : 0,
    avg_hours: d.resolved > 0 ? Math.round(d.totalTime / d.resolved) : 0,
  })).sort((a, b) => b.resolution_rate - a.resolution_rate);

  return {
    total: tickets.length, resolved: resolved.length,
    resolvedThisWeek: resolvedThisWeek.length,
    activeReporters: activeReporters.size,
    avgResolutionHours: Math.round(avgResolution),
    byCategory, byWard, byStatus, deptLeaderboard,
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

    for (const ticket of data.tickets) await db.collection('tickets').doc(ticket.id).set(ticket);
    for (const user of data.users) await db.collection('users').doc(user.uid).set(user);
    for (const dept of data.departments) await db.collection('departments').doc(dept.id).set(dept);

    console.log(`[Seed] Loaded ${data.tickets.length} tickets, ${data.users.length} users, ${data.departments.length} departments`);
    return data;
  } catch (err) {
    console.warn('[Seed] Could not load seed data:', err.message);
    return null;
  }
}
