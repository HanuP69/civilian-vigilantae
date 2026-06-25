import { Router } from 'express';
import { toolHandlers } from '../agent/toolHandlers.js';
import { awardXP } from '../services/userService.js';
const router = Router();

router.post('/:id', async (req, res) => {
  try {
    const { vote_type, user_id } = req.body;
    if (!['still_issue', 'looks_resolved'].includes(vote_type)) {
      return res.status(400).json({ error: 'Invalid vote_type' });
    }
    const result = await toolHandlers.record_verification(
      { ticket_id: req.params.id, vote_type },
      { userId: user_id }
    );
    if (user_id && !result.error) await awardXP(user_id, 'vote');
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
