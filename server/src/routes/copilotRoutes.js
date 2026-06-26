import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getLLMClient } from '../llm/index.js';
import { db } from '../config/firebase.js';
import { getDashboardStats } from '../services/ticketService.js';
import { computeRecurrenceRisk } from '../math/recurrence.js';

const router = Router();

function parseBudget(msg) {
  const text = msg.toLowerCase();
  const lakhMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lacs?)/);
  if (lakhMatch) {
    return parseFloat(lakhMatch[1]) * 100000;
  }
  const numericMatch = text.match(/(?:₹|rs\.?)\s*(\d+(?:,\d+)*)\s*(?:thousand|k)?/i) || text.match(/\b(\d{4,9})\b/);
  if (numericMatch) {
    let val = parseFloat(numericMatch[1].replace(/,/g, ''));
    if (text.includes('thousand') || text.includes(' k')) val *= 1000;
    return val;
  }
  return null;
}

const solveKnapsack = (items, capacity) => {
  if (!items || items.length === 0 || capacity <= 0) {
    return { selected: [], totalCost: 0, totalValue: 0 };
  }
  const scale = 100;
  const W = Math.floor(capacity / scale);
  const n = items.length;
  const K = Array(n + 1).fill(0).map(() => Array(W + 1).fill(0));
  
  for (let i = 1; i <= n; i++) {
    const item = items[i - 1];
    const w = Math.max(1, Math.floor(item.cost / scale));
    const v = item.value;
    for (let j = 0; j <= W; j++) {
      if (w <= j) {
        K[i][j] = Math.max(K[i - 1][j], K[i - 1][j - w] + v);
      } else {
        K[i][j] = K[i - 1][j];
      }
    }
  }
  
  const selected = [];
  let j = W;
  for (let i = n; i > 0; i--) {
    const item = items[i - 1];
    const w = Math.max(1, Math.floor(item.cost / scale));
    if (K[i][j] !== K[i - 1][j]) {
      selected.push(item.original);
      j -= w;
    }
  }
  return {
    selected,
    totalCost: selected.reduce((sum, item) => sum + item.estimated_cost, 0),
    totalValue: selected.reduce((sum, item) => sum + item.priority_score, 0)
  };
};

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
          resolved_at: t.resolved_at?.toDate?.() ?? new Date(t.resolved_at),
          verification_score: t.verification_score || 70
        });
      } else {
        activeTickets.push(ticketData);
      }
    });

    // 2. Fetch Assets and Sort by Health ascending (failing first)
    const assetsSnap = await db.collection('assets').get();
    const assetsList = [];
    assetsSnap.forEach(doc => {
      assetsList.push(doc.data());
    });
    assetsList.sort((a, b) => (a.health || 100) - (b.health || 100));
    const failingAssetsSummary = assetsList.filter(a => a.health < 100).map(a => 
      `- Asset: "${a.name}" (Type: ${a.type.toUpperCase()}), Ward: ${a.ward}, Health Index: ${a.health}%, Open Issues: ${a.open_issues_count || 0}`
    ).join('\n');

    // 3. Compute Recurrence Risk
    const risks = computeRecurrenceRisk(resolvedTickets, 14);

    // 4. Check for Budget/Knapsack Queries
    const detectedBudget = parseBudget(message);
    let knapsackOutput = '';
    if (detectedBudget !== null) {
      const itemsForKnapsack = activeTickets.map(t => ({
        id: t.id,
        cost: t.estimated_cost || 4000,
        value: t.priority_score || 10,
        original: t
      }));
      const optimal = solveKnapsack(itemsForKnapsack, detectedBudget);
      knapsackOutput = `
[KNAPSACK SOLVER EXECUTION RESULT]
Target Budget Capacity: ₹${detectedBudget.toLocaleString()}
Optimal Selected Quests: ${optimal.selected.length} resolved
Optimal Selection list:
${optimal.selected.map(t => `- [Quest #${t.id}] Title: "${t.title}", Ward: ${t.ward}, Cost: ₹${(t.estimated_cost || 4000).toLocaleString()}, Priority Score: ${t.priority_score}`).join('\n')}
Total Optimal Cost: ₹${optimal.totalCost.toLocaleString()}
Total Priority Utility gained: +${optimal.totalValue} points
`;
    }

    // 5. Compile summaries
    const activeSummary = activeTickets.map((t) => 
      `- [Quest #${t.id}] Title: "${t.title}", Ward: ${t.ward}, Category: ${t.category}, Priority: ${t.priority_score}, Severity: ${t.severity}, Cost: ₹${t.estimated_cost}${t.root_cause ? `, Root Cause: ${t.root_cause.cause} (${t.root_cause.confidence}% confidence)` : ''}`
    ).join('\n');

    const recurrenceSummary = risks.filter(r => r.probability > 0.4).map(r => 
      `- Ward: ${r.ward}, Category: ${r.category}, Recurrence Risk: ${Math.round(r.probability * 100)}%, Recommended Action: ${r.recommendedAction || r.recommendation}`
    ).join('\n');

    const systemPrompt = `You are the Lucknow Guild Sentinel Copilot, a municipal executive commander AI decision-support system.
You assist the Guild Marshall in managing the treasury, analyzing ward health, prioritizing quests, and allocating dispatch teams.
You have real-time access to the municipal ledger, recurrence hazard risks, active threat swarms, and physical infrastructure assets.

Ground your advice on the following real-time database context. Quote exact assets, wards, category counts, and costs.
Answer in clear, engaging Markdown. Maintain a professional, premium, RPG guild-dispatch command aesthetic (e.g. "Marshall", "Guild Treasury", "Citizen Sensors", "Swarms").

---
[REAL-TIME CONTEXT: MUNICIPAL DEGRADING ASSETS]
${failingAssetsSummary || 'All infrastructure assets verify at 100% health index.'}

[REAL-TIME CONTEXT: ACTIVE QUESTS]
Total Active Quests: ${activeTickets.length}
Quests list:
${activeSummary || 'No active quests currently.'}

[REAL-TIME CONTEXT: RECURRENCE RISK HAZARDS]
${recurrenceSummary || 'No high-risk recurrence hotspots forecasted at this time.'}

[REAL-TIME CONTEXT: METRICS]
Active Ward Health stats: ${JSON.stringify(stats?.byWard || {})}
Assigned Guild distribution: ${JSON.stringify(stats?.byDepartment || {})}
Department Ledger: ${JSON.stringify(stats?.deptLeaderboard || [])}
${knapsackOutput ? `\n${knapsackOutput}\nUse this Knapsack Solver result to tell the Marshall exactly how to spend their budget to maximize utility!` : ''}
---`;

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    if (Array.isArray(chatHistory)) {
      chatHistory.forEach(h => {
        messages.push({ role: h.role === 'user' ? 'user' : 'model', content: h.content });
      });
    }

    messages.push({ role: 'user', content: message });

    const client = getLLMClient();
    const response = await client.chat(messages);

    res.json({ text: response.text });
  } catch (err) {
    console.error('[CopilotRoute] Chat failed:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
