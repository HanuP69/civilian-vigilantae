import { Router } from 'express';
import { getUser, getLeaderboard, registerUser, loginUser, claimQuestReward, buyShopItem, equipAvatar } from '../services/userService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, display_name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await registerUser(email, password, display_name);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await loginUser(email, password);
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/me', async (req, res) => {
  try {
    const uid = req.query.uid || req.headers['x-user-id'] || req.query.userId;
    if (!uid) return res.status(400).json({ error: 'uid required' });
    const user = await getUser(uid);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/quests/claim', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id;
    const { quest_id } = req.body;
    if (!quest_id) return res.status(400).json({ error: 'quest_id required' });
    const user = await claimQuestReward(uid, quest_id);
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/shop/buy', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id;
    const { item_id } = req.body;
    if (!item_id) return res.status(400).json({ error: 'item_id required' });
    const user = await buyShopItem(uid, item_id);
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/shop/equip', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id;
    const { avatar_value } = req.body;
    if (avatar_value === undefined) return res.status(400).json({ error: 'avatar_value required' });
    const user = await equipAvatar(uid, avatar_value);
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const leaderboard = await getLeaderboard(limit);
    res.json({ leaderboard });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
