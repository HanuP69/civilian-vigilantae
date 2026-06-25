import { getLLMClient } from '../llm/index.js';
import { getToolsForContext } from './tools.js';
import { toolHandlers } from './toolHandlers.js';
import { createTraceLogger } from './traceLogger.js';

const MAX_TOOL_ROUNDS = 6;

const SYSTEM_PROMPT = `You are SENTINEL-CIVIC, an AI agent that processes citizen reports about community issues in Lucknow, India. You autonomously classify, deduplicate, prioritize, and route civic issue reports.

When processing a new report:
1. First classify the issue using classify_issue
2. Resolve the geographic location using geo_resolve
3. Check for duplicates using find_cluster
4. If duplicate found, merge using merge_into_ticket
5. If new issue, create a ticket using create_ticket
6. Compute priority using compute_priority
7. Notify reporters using notify_reporters

When checking SLA status:
1. Check each ticket's SLA using check_sla_status
2. If breached, escalate using escalate_ticket
3. Recompute priority using compute_priority

Always provide clear reasoning for your decisions. Be decisive and efficient.`;

export async function processReport(reportData, onStep) {
  const llm = getLLMClient();
  const trace = createTraceLogger(reportData.id || 'new', onStep);
  const tools = getToolsForContext('report');
  const ctx = {
    userId: reportData.reporter_id,
    userName: reportData.reporter_name,
    mediaUrls: reportData.media_urls || [],
    mediaType: reportData.media_type || 'image',
    mediaBase64: reportData.mediaBase64 || null,
    mediaMimeType: reportData.mediaMimeType || null,
    classificationResult: reportData.classificationResult || null,
    cloudVisionResult: reportData.cloudVisionResult || null,
    classificationAgreement: reportData.classificationAgreement ?? true,
    trace,
  };

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildReportPrompt(reportData) },
  ];

  let result = { ticketId: null, merged: false, trace: [] };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const complete = trace.startStep('llm_reasoning', { round });
    let response;
    try {
      response = await llm.chat(messages, tools);
      complete({ toolCalls: response.toolCalls.map(t => t.name), text: response.text?.substring(0, 100) }, 'Agent reasoning');
    } catch (err) {
      complete({ error: err.message }, 'LLM call failed', 'error');
      break;
    }

    if (response.toolCalls.length === 0) {
      if (response.text) trace.logStep('agent_response', {}, { text: response.text });
      break;
    }

    messages.push({ role: 'assistant', content: '', toolCalls: response.toolCalls });

    for (const toolCall of response.toolCalls) {
      const completeStep = trace.startStep(toolCall.name, toolCall.args);
      try {
        const handler = toolHandlers[toolCall.name];
        if (!handler) throw new Error(`Unknown tool: ${toolCall.name}`);
        const toolResult = await handler(toolCall.args, ctx);
        completeStep(toolResult, `Executed ${toolCall.name}`);

        if (toolCall.name === 'create_ticket' && toolResult.ticket_id) {
          result.ticketId = toolResult.ticket_id;
          result.merged = false;
        }
        if (toolCall.name === 'merge_into_ticket' && toolResult.ticket_id) {
          result.ticketId = toolResult.ticket_id;
          result.merged = true;
        }
        if (toolCall.name === 'classify_issue') {
          ctx.classificationResult = toolResult;
        }

        messages.push({ role: 'tool', name: toolCall.name, content: JSON.stringify(toolResult) });
      } catch (err) {
        completeStep({ error: err.message }, `Error in ${toolCall.name}`, 'error');
        messages.push({ role: 'tool', name: toolCall.name, content: JSON.stringify({ error: err.message }) });
      }
    }
  }

  result.trace = trace.getSteps();
  return result;
}

export async function processSchedulerTick(onStep) {
  const { db } = await import('../config/firebase.js');
  const llm = getLLMClient();
  const tools = getToolsForContext('scheduler');
  const trace = createTraceLogger('scheduler-tick', onStep);

  const ticketsSnap = await db.collection('tickets').get();
  const openTickets = [];
  ticketsSnap.forEach(doc => {
    const t = doc.data();
    if (['reported', 'verified', 'in_progress'].includes(t.status)) openTickets.push(t);
  });

  if (openTickets.length === 0) return { processed: 0, trace: trace.getSteps() };

  let processedCount = 0;
  
  for (let i = 0; i < openTickets.length; i += 20) {
    const chunk = openTickets.slice(i, i + 20);
    const ticketSummaries = chunk.map(t => ({
      id: t.id, category: t.category, severity: t.severity, status: t.status,
      created_at: t.created_at, ward: t.ward,
      elapsed_hours: Math.round((Date.now() - new Date(t.created_at).getTime()) / 3600000),
    }));

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Scheduler tick: Review these ${chunk.length} open tickets for SLA breaches and priority updates. Check SLA status for the most critical ones and escalate if needed.\n\nTickets:\n${JSON.stringify(ticketSummaries, null, 2)}` },
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await llm.chat(messages, tools);
      if (response.toolCalls.length === 0) break;

      for (const toolCall of response.toolCalls) {
        const completeStep = trace.startStep(toolCall.name, toolCall.args);
        try {
          const handler = toolHandlers[toolCall.name];
          const toolResult = await handler(toolCall.args, { trace });
          completeStep(toolResult, `Scheduler: ${toolCall.name}`);
          messages.push({ role: 'assistant', content: '', toolCalls: [toolCall] });
          messages.push({ role: 'tool', name: toolCall.name, content: JSON.stringify(toolResult) });
        } catch (err) {
          completeStep({ error: err.message }, '', 'error');
          messages.push({ role: 'tool', name: toolCall.name, content: JSON.stringify({ error: err.message }) });
        }
      }
    }
    processedCount += chunk.length;
  }

  return { processed: processedCount, trace: trace.getSteps() };
}

function buildReportPrompt(data) {
  let prompt = `New citizen report received:\n`;
  if (data.text) prompt += `Description: "${data.text}"\n`;
  if (data.lat && data.lng) prompt += `Location: (${data.lat}, ${data.lng})\n`;
  if (data.media_urls?.length) prompt += `Media: ${data.media_urls.length} ${data.media_type || 'image'}(s) attached\n`;
  if (data.classificationResult) {
    prompt += `AI Classification (pre-computed): ${JSON.stringify(data.classificationResult)}\n`;
  }
  prompt += `\nProcess this report: classify it, resolve location, check for duplicates, create or merge ticket, compute priority, and notify.`;
  return prompt;
}
