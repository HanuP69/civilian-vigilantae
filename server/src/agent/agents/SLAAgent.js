import { enrichReasoning } from '../enricher.js';
import { toolHandlers } from '../toolHandlers.js';

export const SLAAgent = {
  async execute(ctx) {
    const { trace, ticketId } = ctx;
    const completeSLA = trace.startStep('check_sla_status', { ticket_id: ticketId });

    const slaResult = await toolHandlers.check_sla_status({ ticket_id: ticketId });

    ctx.slaResult = slaResult;

    const reasoning = await enrichReasoning('check_sla_status', slaResult) || `Weibull forecast resolves breach probability at ${Math.round((slaResult.probability || 0) * 100)}%.`;
    completeSLA(slaResult, reasoning);

    // Dispatch message to PlannerAgent
    ctx.messageBus?.sendMessage('SLAAgent', 'PlannerAgent', 'sla_processed', {
      probability: slaResult.probability || 0,
      is_breached: !!slaResult.is_breached
    });
  }
};
