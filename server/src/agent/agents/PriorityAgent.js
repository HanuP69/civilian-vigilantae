import { enrichReasoning } from '../enricher.js';
import { toolHandlers } from '../toolHandlers.js';

export const PriorityAgent = {
  async execute(ctx) {
    const { trace, ticketId } = ctx;
    const completePriority = trace.startStep('compute_priority', { ticket_id: ticketId });

    const priorityResult = await toolHandlers.compute_priority({ ticket_id: ticketId });

    ctx.priorityResult = priorityResult;

    const reasoning = await enrichReasoning('compute_priority', priorityResult) || `Priority score calculated as ${priorityResult.priority_score}.`;
    completePriority(priorityResult, reasoning);
  }
};
