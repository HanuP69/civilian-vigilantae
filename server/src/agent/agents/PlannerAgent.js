import { enrichReasoning } from '../enricher.js';

export const PlannerAgent = {
  async execute(ctx) {
    const { trace, ticketId, classificationResult } = ctx;
    const completePlan = trace.startStep('planning', { ticket_id: ticketId });

    const depts = {
      pothole: 'Roads & Infrastructure', water_leak: 'Water Supply', streetlight: 'Electrical & Lighting',
      waste: 'Sanitation & Waste Management', road_damage: 'Roads & Infrastructure',
      drainage: 'Drainage & Sewerage', other: 'General Maintenance',
    };
    const severityCrew = { critical: 4, high: 3, medium: 2, low: 1 };
    const severityCost = { critical: 15000, high: 8000, medium: 4000, low: 1500 };
    const severityEta = { critical: '12h', high: '24h', medium: '48h', low: '72h' };

    const dept = depts[classificationResult.category] || depts.other;
    const crew = severityCrew[classificationResult.severity] || 2;
    const cost = severityCost[classificationResult.severity] || 4000;
    const eta = severityEta[classificationResult.severity] || '48h';
    const materials = classificationResult.category === 'pothole' || classificationResult.category === 'road_damage'
      ? ['asphalt', 'roller', 'compactor']
      : classificationResult.category === 'water_leak'
        ? ['pipe patching clamps', 'valves']
        : ['tools'];

    const fallbackPlan = {
      department: dept,
      crew_size: crew,
      materials,
      estimated_cost: cost,
      eta,
      explanation: `Automated dispatch plan formulated for ${dept} team (fallback).`,
    };

    let planResult;
    try {
      const { getLLMClient } = await import('../../llm/index.js');
      const { retryWithBackoff } = await import('../../utils/retryHelper.js');
      const client = getLLMClient();
      
      const prompt = `You are a Lucknow Municipal Planner Agent. Formulate an optimized dispatch resource plan for a civic issue in Lucknow.
Issue Category: "${classificationResult.category}"
Issue Severity: "${classificationResult.severity}"
Reasoning: "${classificationResult.reasoning || ''}"

Return a JSON object matching this structure:
{
  "department": "department name e.g. Roads & Infrastructure",
  "crew_size": number of personnel (1-10),
  "materials": ["list of materials needed"],
  "estimated_cost": estimated cost in INR (number),
  "eta": "ETA string e.g. 12h, 24h, 36h",
  "explanation": "brief optimization reasoning focusing on cost/personnel/ETA tradeoffs"
}`;

      const response = await retryWithBackoff(() => client.chat([{ role: 'user', content: prompt }], []));
      const responseText = response.text || '';
      let cleanText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const startIdx = cleanText.indexOf('{');
      const endIdx = cleanText.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
        cleanText = cleanText.substring(startIdx, endIdx + 1);
        const parsed = JSON.parse(cleanText);
        planResult = {
          department: parsed.department || fallbackPlan.department,
          crew_size: typeof parsed.crew_size === 'number' ? parsed.crew_size : fallbackPlan.crew_size,
          materials: Array.isArray(parsed.materials) ? parsed.materials : fallbackPlan.materials,
          estimated_cost: typeof parsed.estimated_cost === 'number' ? parsed.estimated_cost : fallbackPlan.estimated_cost,
          eta: parsed.eta || fallbackPlan.eta,
          explanation: parsed.explanation || `Optimized dispatch plan formulated for ${parsed.department || dept} team.`,
        };
      } else {
        throw new Error('Invalid JSON format');
      }
    } catch (err) {
      console.warn('[PlannerAgent] LLM resource planning failed, using fallback:', err.message);
      planResult = fallbackPlan;
    }

    ctx.planResult = planResult;

    const reasoning = await enrichReasoning('planning', planResult) || `Dispatch planning generated resource recommendation for ${planResult.department}.`;
    completePlan(planResult, reasoning);

    // Dispatch message to GovernanceAgent
    ctx.messageBus?.sendMessage('PlannerAgent', 'GovernanceAgent', 'plan_processed', {
      department: planResult.department,
      crew_size: planResult.crew_size,
      estimated_cost: planResult.estimated_cost,
      eta: planResult.eta
    });
  }
};
