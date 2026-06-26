import { enrichReasoning } from '../enricher.js';
import { toolHandlers } from '../toolHandlers.js';

export const GovernanceAgent = {
  async executeNotify(ctx) {
    const { trace, ticketId } = ctx;
    const completeNotify = trace.startStep('notify_reporters', { ticket_id: ticketId, status: 'reported' });

    const notifyResult = await toolHandlers.notify_reporters({ ticket_id: ticketId, status: 'reported' });

    ctx.notifyResult = notifyResult;

    const reasoning = await enrichReasoning('notify_reporters', notifyResult) || 'Dispatched push notification alerts to regional sentinels.';
    completeNotify(notifyResult, reasoning);
  },

  async executeEscalate(ticket, trace) {
    const completeEscalate = trace.startStep('escalate_ticket', { ticket_id: ticket.id, reason: 'High SLA breach probability forecasted' });
    const escalateResult = await toolHandlers.escalate_ticket({ ticket_id: ticket.id, reason: 'High SLA breach probability forecasted' });
    completeEscalate(escalateResult, 'Ticket escalated.');
    return escalateResult;
  }
};
