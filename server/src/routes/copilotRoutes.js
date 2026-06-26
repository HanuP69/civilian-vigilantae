import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getLLMClient } from '../llm/index.js';
import { db } from '../config/firebase.js';
import { getDashboardStats } from '../services/ticketService.js';
import { computeRecurrenceRisk } from '../math/recurrence.js';

const router = Router();

router.post('/chat', requireAuth, async (req, res) => {
  try {
    const { message, chatHistory } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    // 1. Gather database stats and tickets context
    const stats = await getDashboardStats();
    
    const ticketsSnap = await db.collection('tickets').get();
    const activeTickets = [];
    const resolvedTickets = [];
    
    ticketsSnap.forEach(doc => {
      const t = doc.data();
      const ticketData = {
        id: doc.id,
        title: t.title || t.ai_title || 'Untitled Anomaly',
        category: t.category,
        ward: t.ward,
        status: t.status,
        priority_score: t.priority_score || 10,
        severity: t.severity,
        estimated_cost: t.estimated_cost || 4000,
        root_cause: t.root_cause
      };
      if (t.status === 'resolved') {
        resolvedTickets.push({
          ...ticketData,
          resolved_at: t.resolved_at?.toDate?.() ?? new Date(t.resolved_at)
        });
      } else {
        activeTickets.push(ticketData);
      }
    });

    // 2. Compute Recurrence Risk
    const risks = computeRecurrenceRisk(resolvedTickets, 14);

    // 3. Compile context summaries
    const activeSummary = activeTickets.map((t, idx) => 
      `- [Quest #${t.id}] Title: "${t.title}", Ward: ${t.ward}, Category: ${t.category}, Priority: ${t.priority_score}, Severity: ${t.severity}, Cost: ₹${t.estimated_cost}${t.root_cause ? `, Root Cause: ${t.root_cause.cause} (${t.root_cause.confidence}% confidence)` : ''}`
    ).join('\n');

    const recurrenceSummary = risks.filter(r => r.probability > 0.4).map(r => 
      `- Ward: ${r.ward}, Category: ${r.category}, Recurrence Risk: ${Math.round(r.probability * 100)}%, Recommended Action: ${r.recommendedAction || r.recommendation}`
    ).join('\n');

    const systemPrompt = `You are the Lucknow Guild Sentinel Copilot, a municipal executive advisor AI console.
You assist the Guild Marshall in managing the treasury, analyzing ward health, prioritizing quests, and allocating dispatch teams.
You have real-time access to the municipal ledger, recurrence hazard risks, and active threat swarms.

Use the following real-time database context to ground your advice. Quote exact wards, categories, ticket counts, and costs.
Answer in clear, engaging Markdown. Maintain a professional, premium, RPG guild-dispatch command aesthetic (e.g. "Marshall", "Guild Treasury", "Citizen Sensors", "Swarms").

---
[REAL-TIME CONTEXT: ACTIVE QUESTS]
Total Active Quests: ${activeTickets.length}
Quests list:
${activeSummary || 'No active quests currently.'}

[REAL-TIME CONTEXT: RECURRENCE RISK HAZARDS]
${recurrenceSummary || 'No high-risk recurrence hotspots forecasted at this time.'}

[REAL-TIME CONTEXT: METRICS]
Active Ward Health stats: ${JSON.stringify(stats?.byWard || {})}
Assigned Guild distribution: ${JSON.stringify(stats?.byDepartment || {})}
---`;

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Inject history if present
    if (Array.isArray(chatHistory)) {
      chatHistory.forEach(h => {
        messages.push({ role: h.role === 'user' ? 'user' : 'model', content: h.content });
      });
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    // 4. Query LLM
    const client = getLLMClient();
    const response = await client.chat(messages);

    res.json({ text: response.text });
  } catch (err) {
    console.error('[CopilotRoute] Chat failed:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
