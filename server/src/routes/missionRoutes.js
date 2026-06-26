import { Router } from 'express';
import { getMissions } from '../services/missionService.js';
const router = Router();

router.get('/', async (req, res) => {
  try {
    const missions = await getMissions();
    res.json(missions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
