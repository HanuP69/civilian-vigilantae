import { Router } from 'express';
import { addClient } from '../services/sseService.js';
const router = Router();

router.get('/', (req, res) => {
  const userId = req.query.uid || 'anonymous';
  addClient(userId, res);
});

export default router;
