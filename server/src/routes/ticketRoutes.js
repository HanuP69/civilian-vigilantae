import { Router } from 'express';
import { getAllTickets, getTicketById, updateTicket, getDashboardStats } from '../services/ticketService.js';
const router = Router();

router.get('/', async (req, res) => {
  try {
    const tickets = await getAllTickets(req.query);
    res.json({ tickets, total: tickets.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const ticket = await getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Not found' });
    res.json(ticket);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized: Missing user ID' });
    
    const result = await updateTicket(req.params.id, req.body);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
