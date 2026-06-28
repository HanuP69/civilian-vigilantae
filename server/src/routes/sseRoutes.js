import { Router } from 'express';
import { addClient } from '../services/sseService.js';
const router = Router();

router.get('/', (req, res) => {
  let token = null;

  // Check auth header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // Fallback to query parameter (needed for browser EventSource client setup)
  if (!token) {
    token = req.query.token || req.query.uid;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing connection token' });
  }

  const userId = token;
  addClient(userId, res);
});

export default router;
