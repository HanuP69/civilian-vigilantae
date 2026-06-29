import test from 'node:test';
import assert from 'node:assert/strict';
import { runAgentLoop, createToolExecutor } from '../agentLoop.js';

/**
 * Minimal in-memory trace logger for unit testing the loop in isolation.
 * Mirrors the shape of createTraceLogger() so agentLoop doesn't need Firebase.
 */
function createMemoryTrace() {
  const steps = [];
  const trace = {
    startStep(name, input) {
      const step = { step: name, input, output: null, reasoning: '', status: 'pending', duration_ms: 0 };
      steps.push(step);
      return async (output, reasoning = '', status = 'success') => {
        step.output = output;
        step.reasoning = reasoning;
        step.status = status;
      };
    },
    async logStep(name, input, output, reasoning = '', durationMs = 0) {
      steps.push({ step: name, input, output, reasoning, status: 'success', duration_ms: durationMs });
    },
    getSteps: () => steps,
  };
  return trace;
}

// A fake LLM whose responses are driven by a scripted array of {text, toolCalls}.
function createScriptedLlm(responses) {
  let i = 0;
  return {
    async chat() {
      if (i >= responses.length) return { toolCalls: [], text: 'STOP' };
      return responses[i++];
    },
  };
}

test('runAgentLoop runs a multi-turn ReAct loop: reason → act → observe → decide', async () => {
  // Script: reason+classify → reason+lookup → final answer
  const client = createScriptedLlm([
    { toolCalls: [{ name: 'classify_issue', args: { text: 'pothole' } }], text: 'Classifying the report.' },
    { toolCalls: [{ name: 'geo_resolve', args: {} }], text: 'Resolved classification, now locating.' },
    { toolCalls: [], text: '{"decision":"create_ticket"}' },
  ]);
  const seen = [];
  const executor = {
    async execute(name, args) {
      seen.push({ name, args });
      return { ok: true, tool: name };
    },
  };
  const trace = createMemoryTrace();

  const res = await runAgentLoop({
    client,
    systemPrompt: 'You are a triage agent.',
    userMessage: 'Investigate this report.',
    tools: [{ name: 'classify_issue' }, { name: 'geo_resolve' }],
    toolExecutor: executor,
    trace,
  });

  assert.equal(res.failed, false);
  assert.equal(res.iterations, 3);
  assert.equal(res.finalText, '{"decision":"create_ticket"}');
  // Both tools were actually invoked by the loop
  assert.deepEqual(seen.map(s => s.name), ['classify_issue', 'geo_resolve']);
  // Reasoning steps captured for every turn
  const reasoning = trace.getSteps().filter(s => s.step === 'llm_reasoning');
  assert.equal(reasoning.length, 3);
  assert.equal(reasoning[0].output.thought, 'Classifying the report.');
  assert.equal(reasoning[0].output.actions.length, 1);
  assert.equal(reasoning[2].output.actions.length, 0); // final turn: no tools
});

test('runAgentLoop terminates on a no-tool-call response even if scripted to continue', async () => {
  // First response has no tool calls → loop ends immediately
  const client = createScriptedLlm([{ toolCalls: [], text: 'Done immediately.' }]);
  const executor = { async execute() { assert.fail('should not execute any tool'); } };
  const trace = createMemoryTrace();

  const res = await runAgentLoop({
    client,
    systemPrompt: 'sys',
    userMessage: 'go',
    tools: [],
    toolExecutor: executor,
    trace,
  });

  assert.equal(res.iterations, 1);
  assert.equal(res.finalText, 'Done immediately.');
});

test('runAgentLoop respects the iteration cap as a safety stop', async () => {
  // Agent never stops requesting tools → must be capped
  const client = createScriptedLlm(
    Array.from({ length: 50 }, () => ({ toolCalls: [{ name: 'classify_issue', args: {} }], text: 'again' })),
  );
  const executor = { async execute() { return { v: 1 }; } };
  const trace = createMemoryTrace();

  const res = await runAgentLoop({
    client,
    systemPrompt: 'sys',
    userMessage: 'go',
    tools: [{ name: 'classify_issue' }],
    toolExecutor: executor,
    trace,
    maxIterations: 3,
  });

  assert.equal(res.iterations, 3);
  assert.equal(res.finalText, ''); // never reached a final answer
});

test('runAgentLoop handles multiple tool calls in a single turn', async () => {
  const client = createScriptedLlm([
    { toolCalls: [{ name: 'classify_issue', args: {} }, { name: 'geo_resolve', args: {} }], text: 'Both at once.' },
    { toolCalls: [], text: 'done' },
  ]);
  const executed = [];
  const executor = {
    async execute(name) {
      executed.push(name);
      return { tool: name };
    },
  };
  const trace = createMemoryTrace();

  await runAgentLoop({
    client, systemPrompt: 's', userMessage: 'u',
    tools: [{ name: 'classify_issue' }, { name: 'geo_resolve' }],
    toolExecutor: executor, trace,
  });

  assert.deepEqual(executed, ['classify_issue', 'geo_resolve']);
  // One reasoning step for the turn, two tool steps
  const toolSteps = trace.getSteps().filter(s => ['classify_issue', 'geo_resolve'].includes(s.step));
  assert.equal(toolSteps.length, 2);
});

test('runAgentLoop records tool failures without crashing and feeds error back to the model', async () => {
  const client = createScriptedLlm([
    { toolCalls: [{ name: 'broken_tool', args: {} }], text: 'trying' },
    { toolCalls: [], text: 'recovered' },
  ]);
  const executor = {
    async execute() { throw new Error('boom'); },
  };
  const trace = createMemoryTrace();

  const res = await runAgentLoop({
    client, systemPrompt: 's', userMessage: 'u',
    tools: [{ name: 'broken_tool' }],
    toolExecutor: executor, trace,
  });

  assert.equal(res.finalText, 'recovered');
  const failed = trace.getSteps().find(s => s.step === 'broken_tool');
  assert.equal(failed.status, 'error');
  assert.equal(failed.output.error, 'boom');
});

test('runAgentLoop returns failed:true when the LLM itself throws', async () => {
  const client = {
    async chat() { throw new Error('network down'); },
  };
  const executor = { async execute() { return {}; } };
  const trace = createMemoryTrace();

  const res = await runAgentLoop({
    client, systemPrompt: 's', userMessage: 'u',
    tools: [], toolExecutor: executor, trace,
  });

  assert.equal(res.failed, true);
  assert.match(res.error, /network down/);
  assert.equal(res.finalText, '');
});

test('createToolExecutor dispatches to the named handler with context and rejects unknown tools', async () => {
  const ctx = { requestId: 'r1' };
  const handlers = {
    add: async (args, c) => ({ sum: args.a + args.b, ctx: c.requestId }),
  };
  const executor = createToolExecutor(handlers, ctx);

  const result = await executor.execute('add', { a: 2, b: 3 });
  assert.equal(result.sum, 5);
  assert.equal(result.ctx, 'r1');

  await assert.rejects(() => executor.execute('nope', {}), /Unknown tool/);
});

test('runAgentLoop pre-seeds conversation with initialHistory (multimodal context)', async () => {
  const capturedMessages = [];
  const client = {
    async chat(messages) {
      capturedMessages.push(messages);
      return { toolCalls: [], text: 'seen the media' };
    },
  };
  const trace = createMemoryTrace();

  await runAgentLoop({
    client,
    systemPrompt: 'sys',
    userMessage: 'investigate',
    tools: [],
    toolExecutor: { async execute() {} },
    trace,
    initialHistory: [{ role: 'user', content: 'media here', media: { mimeType: 'image/jpeg', data: 'AAA' } }],
  });

  const firstCall = capturedMessages[0];
  // system + seeded media + user message
  assert.equal(firstCall[0].role, 'system');
  assert.equal(firstCall[1].role, 'user');
  assert.equal(firstCall[1].content, 'media here');
  assert.ok(firstCall[1].media);
  assert.equal(firstCall[2].role, 'user');
  assert.equal(firstCall[2].content, 'investigate');
});
