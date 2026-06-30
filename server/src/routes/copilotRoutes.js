import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getLLMClient } from '../llm/index.js';
import { db } from '../config/firebase.js';
import { getDashboardStats } from '../services/ticketService.js';
import { computeRecurrenceRisk } from '../math/recurrence.js';
import { getLeaderboard } from '../services/userService.js';

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
    const allAssetsSummary = assetsList.map(a => 
      `- Asset: "${a.name}" (Type: ${a.type.toUpperCase()}), Ward: ${a.ward}, Health Index: ${a.health}%, Open Issues: ${a.open_issues_count || 0}`
    ).join('\n');

    // 3. Compute Recurrence Risk
    const risks = computeRecurrenceRisk(resolvedTickets, 14);

    // Fetch Leaderboard data
    const leaderboard = await getLeaderboard(10);
    
    // Find the current logged-in user's stats
    const currentUserUid = req.user?.uid;
    let currentUserStats = null;
    if (currentUserUid) {
      currentUserStats = leaderboard.find(u => u.uid === currentUserUid);
      // If not in top 10, fetch directly
      if (!currentUserStats) {
        try {
          const userDoc = await db.collection('users').doc(currentUserUid).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            const level = userData.level || Math.floor(Math.sqrt((userData.xp || 0) / 50)) + 1;
            const verifications = userData.verifications_made || 0;
            const accurate = userData.accurate_verifications || 0;
            currentUserStats = {
              uid: currentUserUid,
              display_name: userData.display_name || 'Administrator',
              level,
              xp: userData.xp || 0,
              gold: userData.gold || 0,
              trust_score: userData.trust_score !== undefined ? userData.trust_score : 0.5,
              contribution_score: userData.contribution_score || 0,
              reports_submitted: userData.reports_submitted || 0,
              verifications_made: verifications,
              accurate_verifications: accurate,
              accuracy: verifications > 0 ? Math.round((accurate / verifications) * 100) : 100
            };
          }
        } catch (err) {
          console.warn('[Copilot] Could not fetch current user stats:', err.message);
        }
      }
    }
    
    const leaderboardSummary = leaderboard.map((u, i) => {
      const level = u.level || Math.floor(Math.sqrt((u.xp || 0) / 50)) + 1;
      const verifications = u.verifications_made || 0;
      const accurate = u.accurate_verifications || 0;
      const reports = u.reports_submitted || u.reports || 0;
      const trustScore = u.trust_score !== undefined ? u.trust_score : 0.5;
      const contributionScore = u.contribution_score !== undefined ? u.contribution_score : 0;
      const accuracy = verifications > 0 ? Math.round((accurate / verifications) * 100) : 100;
      
      return `${i + 1}. User: "${u.display_name || 'Anonymous'}" (Level: ${level}, XP: ${u.xp || 0}, Gold: ${u.gold || 0}, Reputation Trust: ${trustScore.toFixed(2)}, Contribution Score: ${contributionScore}, Reports: ${reports}, Votes: ${verifications}, Accurate: ${accurate}, Accuracy: ${accuracy}%)`;
    }).join('\n');

    // Compile summaries
    const activeSummary = activeTickets.map((t) => 
      `- [Mission #${t.id}] Title: "${t.title}", Ward: ${t.ward}, Category: ${t.category}, Priority: ${t.priority_score}, Severity: ${t.severity}${t.root_cause ? `, Root Cause: ${t.root_cause.cause} (${t.root_cause.confidence}% confidence)` : ''}`
    ).join('\n');

    const recurrenceSummary = risks.filter(r => r.probability > 0.4).map(r => 
      `- Ward: ${r.ward}, Category: ${r.category}, Recurrence Risk: ${Math.round(r.probability * 100)}%, Recommended Action: ${r.recommendedAction || r.recommendation}`
    ).join('\n');

    const systemPrompt = `You are the Lucknow Citizen Vigilantae Copilot, a community management and analytics assistant.
You help citizens and administrators track community issues, analyze ward health, understand priority reports, and monitor civic engagement.
You have real-time access to the community database, citizen contributions, ward statistics, and infrastructure health metrics.

**IMPORTANT: When the user asks about "my gold", "my XP", "my level", "my stats", or "my profile", they are asking about THEIR PERSONAL CITIZEN ACCOUNT stats from the Community Leaderboard!**

**HOW TO HANDLE PERSONAL QUERIES:**
- If user says "my gold" or "show me my gold" → Show their Gold amount from CURRENT USER PERSONAL STATS
- If user says "my XP" or "my level" → Show their XP and Level from CURRENT USER PERSONAL STATS
- If user says "my stats" or "my profile" → Show their full stats: Level, XP, Gold, Reports, Votes, Accuracy, Trust Score
- The logged-in user is: "${req.user?.display_name || 'Citizen'}" (UID: ${req.user?.uid || 'unknown'})

${currentUserStats ? `
[CURRENT USER PERSONAL STATS]
User: ${currentUserStats.display_name || 'Citizen'}
Level: ${currentUserStats.level || 1}
XP: ${currentUserStats.xp || 0}
Gold: ${currentUserStats.gold || 0}
Trust Score: ${(currentUserStats.trust_score || 0.5).toFixed(2)}
Contribution Score: ${currentUserStats.contribution_score || 0}
Reports Submitted: ${currentUserStats.reports_submitted || 0}
Verifications Made: ${currentUserStats.verifications_made || 0}
Accurate Verifications: ${currentUserStats.accurate_verifications || 0}
Verification Accuracy: ${currentUserStats.accuracy || 100}%

**USE THESE STATS when the user asks about "my" personal data!**
` : ''}

You understand the technical systems behind the Citizen Vigilantae platform:
1. **Bayesian Consensus Verification**: Citizen votes are weighted by reputation trust and combined with AI classification confidence.
2. **Weibull Recurrence Risk**: Historical data is analyzed to predict future issue recurrence probability.
3. **DBSCAN Geospatial Clustering**: Duplicate reports within 50 meters are automatically grouped.
4. **Dynamic Priority Index**: Priorities are calculated from severity, ward density, and historical patterns.
5. **Multi-Agent Processing**: Reports are processed by specialized AI agents for classification and routing.

**RESPONSE GUIDELINES**:
- Ground answers in the real-time database context provided below
- Focus on priority, severity, ward, and category metrics
- Use clear, engaging Markdown with bold highlights and structured lists
- Reference specific reports using [Report #ticket_id] format
- Help users understand trends, patterns, and actionable insights

---
[REAL-TIME CONTEXT: MUNICIPAL INFRASTRUCTURE ASSETS]
${allAssetsSummary || 'No infrastructure assets registered in the database.'}

[REAL-TIME CONTEXT: ACTIVE REPORTS]
Total Active Reports: ${activeTickets.length}
Reports list:
${activeSummary || 'No active reports currently.'}

[REAL-TIME CONTEXT: RECURRENCE RISK HAZARDS]
${recurrenceSummary || 'No high-risk recurrence hotspots forecasted at this time.'}

[REAL-TIME CONTEXT: COMMUNITY LEADERBOARD (TOP CITIZENS)]
${leaderboardSummary || 'No citizen data registered in the ledger.'}

[REAL-TIME CONTEXT: WARD HEALTH ANALYTICS]
${stats?.wardHealthScores ? Object.entries(stats.wardHealthScores).map(([ward, score]) => 
  `Ward: ${ward}, Health Index: ${score}%${score < 50 ? ' ⚠️ CRITICAL' : score < 75 ? ' ⚠️ WARNING' : ''}`
).join('\n') : 'No ward health data available.'}

[REAL-TIME CONTEXT: DEPARTMENT RISK ASSESSMENT]
${stats?.departmentRisks ? Object.entries(stats.departmentRisks).map(([dept, risk]) => 
  `Department: ${dept}, Avg Priority Risk: ${risk}${risk > 70 ? ' ⚠️ HIGH' : risk > 40 ? ' ⚠️ MODERATE' : ''}`
).join('\n') : 'No department risk data available.'}

[REAL-TIME CONTEXT: METRICS]
Active Ward Health stats: ${JSON.stringify(stats?.byWard || {})}
Department Ledger: ${JSON.stringify(stats?.deptLeaderboard || [])}
Average Resolution Time: ${stats?.avgResolutionHours ? Math.round(stats.avgResolutionHours) + ' hours' : 'N/A'}
Active Reporters (Last 7 days): ${stats?.activeReporters || 0}
Total Issues Resolved This Week: ${stats?.resolvedThisWeek || 0}
---`;

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    if (Array.isArray(chatHistory)) {
      chatHistory.forEach(h => {
        messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content });
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
