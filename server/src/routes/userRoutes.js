import { Router } from 'express';
import { getUser, getLeaderboard } from '../services/userService.js';
const router = Router();

router.get('/me', async (req, res) => {
  try {
    const uid = req.query.uid || req.headers['x-user-id'];
    if (!uid) return res.status(400).json({ error: 'uid required' });
    const user = await getUser(uid);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const leaderboard = await getLeaderboard(limit);
    res.json({ leaderboard });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
