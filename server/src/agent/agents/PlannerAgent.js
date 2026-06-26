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

    const planResult = {
      department: dept,
      crew_size: crew,
      materials,
      estimated_cost: cost,
      eta,
      explanation: `Automated dispatch plan formulated for ${dept} team.`,
    };

    ctx.planResult = planResult;

    const reasoning = await enrichReasoning('planning', planResult) || `Dispatch planning generated resource recommendation for ${dept}.`;
    completePlan(planResult, reasoning);
  }
};
