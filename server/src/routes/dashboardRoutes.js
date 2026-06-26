import { Router } from 'express';
import { getDashboardStats } from '../services/ticketService.js';
import { computeRecurrenceRisk } from '../math/recurrence.js';
import { db } from '../config/firebase.js';
const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/recurrence', async (req, res) => {
  try {
    const snap = await db.collection('tickets').get();
    const resolved = [];
    snap.forEach(doc => {
      const t = doc.data();
      if (t.status === 'resolved' && t.resolved_at) {
        resolved.push({ 
          resolved_at: t.resolved_at?.toDate?.() ?? new Date(t.resolved_at), 
          category: t.category, 
          ward: t.ward,
          verification_score: t.verification_score
        });
      }
    });
    const risks = computeRecurrenceRisk(resolved, 14);
    res.json({ risks, total: risks.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/assets', async (req, res) => {
  try {
    const snap = await db.collection('assets').get();
    const assets = [];
    snap.forEach(doc => {
      assets.push(doc.data());
    });
    res.json(assets);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
