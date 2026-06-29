/**
 * @module agent/agentLoop
 * @description Generic ReAct (Reason + Act) agent loop engine.
 *
 * This is the genuine agentic core: an LLM is given tool schemas, reasons about
 * the task, calls tools of its own choosing, observes the results, and adapts
 * its plan before deciding on a final outcome. The loop runs until the model
 * emits a final answer (text with no further tool calls) or the iteration cap
 * is reached.
 *
 * Unlike a fixed pipeline, the LLM itself decides:
 *   - which tools to call
 *   - in what order
 *   - whether to investigate further (e.g. audit historical ward stats) or stop
 *
 * Every reasoning step and tool invocation is captured in the trace so the
 * UI's reasoning trace reflects the model's actual decision process.
 */

import { getLLMClient } from '../llm/index.js';
import { retryWithBackoff } from '../utils/retryHelper.js';

/**
 * Default maximum reasoning iterations before the loop forces a stop.
 * Each iteration = one LLM call + any tool calls it requests.
 */
const DEFAULT_MAX_ITERATIONS = 8;

/**
 * Serialize a value to a compact string for tool-result messages.
 * Keeps message history small while remaining readable to the model.
 *
 * @param {*} value
 * @returns {string}
 */
function serializeToolResult(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Run a ReAct agent loop.
 *
 * The agent reasons and acts iteratively:
 *   1. Send the conversation (with tools) to the LLM.
 *   2. Capture the model's reasoning text as a trace step.
 *   3. If the model requested tool calls, execute them, append results, repeat.
 *   4. If the model emitted a final text answer (no tool calls), the loop ends.
 *
 * @param {Object} params
 * @param {Object}   params.client            — LLM client instance (from getLLMClient())
 * @param {string}   params.systemPrompt      — system instruction framing the agent's role & goal
 * @param {string}   params.userMessage       — the initial task / user request
 * @param {Object[]} params.tools             — tool definitions (LLMClient.ToolDefinition[])
 * @param {Object}   params.toolExecutor      — { async execute(toolName, args) => result }
 * @param {Object}   params.trace             — trace logger instance (createTraceLogger)
 * @param {string}   [params.agentName]       — human label for trace steps (default: 'ReAct Agent')
 * @param {number}   [params.maxIterations]   — safety cap on LLM turns (default: 8)
 * @param {Object}   [params.initialHistory]  — pre-seeded conversation context (e.g. media)
 * @returns {Promise<{ answer: string, iterations: number, finalText: string }>}
 */
export async function runAgentLoop({
  client,
  systemPrompt,
  userMessage,
  tools,
  toolExecutor,
  trace,
  agentName = 'ReAct Agent',
  maxIterations = DEFAULT_MAX_ITERATIONS,
  initialHistory = null,
}) {
  // ── Seed conversation ────────────────────────────────────────────────
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  // Allow callers to pre-seed multimodal context (e.g. the report's media)
  if (initialHistory && Array.isArray(initialHistory)) {
    messages.push(...initialHistory);
  }

  messages.push({
    role: 'user',
    content: userMessage,
    ...(initialHistory?.media ? { media: initialHistory.media } : {}),
  });

  let iterations = 0;
  let finalText = '';

  while (iterations < maxIterations) {
    iterations += 1;

    // ── 1. Ask the LLM what to do next ────────────────────────────────
    let response;
    const startMs = Date.now();
    try {
      response = await retryWithBackoff(() => client.chat(messages, tools));
    } catch (err) {
      // LLM call failed irrecoverably — record and abort the loop.
      // Callers are expected to fall back to a deterministic path.
      try {
        await trace.logStep(
          'llm_reasoning',
          { iteration: iterations, error: err.message },
          { error: err.message },
          `${agentName} could not reach the reasoning model: ${err.message}`,
          Date.now() - startMs,
        );
      } catch { /* trace failures must never break the agent */ }
      return { answer: '', iterations, finalText: '', failed: true, error: err.message };
    }

    const { toolCalls = [], text = '' } = response;

    // ── 2. Capture the model's reasoning for this turn ───────────────
    // The reasoning step shows what the model was thinking + which tools it
    // chose to invoke. This is what makes the trace a true decision record.
    const reasoningSummary = text && text.trim().length > 0
      ? text.trim()
      : (toolCalls.length > 0
        ? `Decided to call: ${toolCalls.map(t => t.name).join(', ')}`
        : 'No further action required.');

    const reasoningInput = {
      iteration: iterations,
      tools_available: tools.map(t => t.name),
      tools_chosen: toolCalls.map(t => t.name),
    };
    const reasoningOutput = {
      thought: text || null,
      actions: toolCalls.map(t => ({ tool: t.name, args: t.args })),
    };

    try {
      await trace.logStep(
        'llm_reasoning',
        reasoningInput,
        reasoningOutput,
        reasoningSummary,
        Date.now() - startMs,
      );
    } catch { /* non-fatal */ }

    // Append the model's turn to the conversation history so the next
    // iteration includes its own prior reasoning + tool calls.
    messages.push({
      role: 'assistant',
      content: text || '',
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
    });

    // ── 3. If no tool calls, the model has produced a final answer ────
    if (toolCalls.length === 0) {
      finalText = text;
      break;
    }

    // ── 4. Execute each requested tool and feed results back ─────────
    for (const call of toolCalls) {
      const toolName = call.name;
      const toolArgs = call.args || {};
      const toolStart = Date.now();

      let result;
      let status = 'success';
      let error = null;
      try {
        result = await toolExecutor.execute(toolName, toolArgs);
      } catch (err) {
        status = 'error';
        error = err.message;
        result = { error: err.message };
      }

      const resultStr = serializeToolResult(result);

      // Record the tool invocation in the trace (visible in the UI).
      try {
        const completeTool = trace.startStep(toolName, toolArgs);
        await completeTool(
          status === 'error' ? { error } : result,
          status === 'error'
            ? `Tool '${toolName}' failed: ${error}`
            : `Executed '${toolName}'.`,
          status,
        );
      } catch { /* non-fatal */ }

      // Feed the tool result back to the model as a function response.
      messages.push({
        role: 'tool',
        name: toolName,
        content: resultStr,
      });
    }
  }

  return {
    answer: finalText,
    iterations,
    finalText,
    failed: false,
  };
}

/**
 * Build a tool executor that dispatches to a handler map with context.
 *
 * Each handler receives (args, ctx). Unknown tools resolve to an explicit
 * error so the model learns the tool is unavailable.
 *
 * @param {Record<string, (args: Object, ctx: Object) => Promise<*>>} handlers
 * @param {Object} ctx — shared context passed to every handler
 * @returns {{ execute: (name: string, args: Object) => Promise<*> }}
 */
export function createToolExecutor(handlers, ctx) {
  return {
    async execute(name, args) {
      const handler = handlers[name];
      if (!handler) {
        throw new Error(`Unknown tool: '${name}'. Available: ${Object.keys(handlers).join(', ')}`);
      }
      return handler(args, ctx);
    },
  };
}
