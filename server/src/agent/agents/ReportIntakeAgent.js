import { enrichReasoning } from '../enricher.js';
import { toolHandlers } from '../toolHandlers.js';
import { getLLMClient } from '../../llm/index.js';
import { runAgentLoop, createToolExecutor } from '../agentLoop.js';
import { getToolsForContext } from '../tools.js';
import { buildTriageAgentPrompt } from '../prompts.js';

/**
 * ReportIntakeAgent
 *
 * This is the genuine agentic entry point. A ReAct (Reason + Act) loop lets
 * the LLM autonomously investigate each incoming report — classify it,
 * resolve its location, check for duplicate clusters, and audit ward history
 * — deciding for itself which tools to call and in what order.
 *
 * The agent's job is to REASON and DECIDE how to route the report. The atomic
 * ticket create/merge happens later in the orchestrator's transaction, using
 * the decision and data the agent produced.
 *
 * Resilience: if the LLM is unavailable or does not engage tools (e.g. offline,
 * unit-test stubs), the agent transparently falls back to a deterministic
 * classify → geo → cluster sequence so correct behavior is always guaranteed.
 */

// Lucknow bounding box — reports outside are rejected.
const MIN_LAT = 26.75, MAX_LAT = 26.95, MIN_LNG = 80.85, MAX_LNG = 81.05;

/**
 * Parse the agent's final routing decision from its last text answer.
 * Tolerant: scans for the decision JSON; defaults to create_ticket.
 *
 * @param {string} text
 * @returns {{ decision: string, reasoning: string }}
 */
function parseDecision(text) {
  const fallback = { decision: 'create_ticket', reasoning: 'Defaulting to new ticket creation.' };
  if (!text) return fallback;
  try {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = cleaned.lastIndexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || start >= end) return fallback;
    const parsed = JSON.parse(cleaned.substring(start, end + 1));
    const decision = ['create_ticket', 'merge_duplicate', 'needs_review'].includes(parsed.decision)
      ? parsed.decision
      : 'create_ticket';
    return { decision, reasoning: parsed.reasoning || fallback.reasoning };
  } catch {
    return fallback;
  }
}

/**
 * Run the deterministic fallback investigation path. Used when the LLM is
 * unavailable or does not drive the loop. Produces the same ctx fields the
 * rest of the pipeline depends on.
 */
async function runDeterministicIntake(ctx) {
  const { reportData, trace } = ctx;

  // Classification (reuse upstream result if the route already classified media)
  let classificationResult = ctx.classificationResult;
  if (!classificationResult) {
    const completeClassify = trace.startStep('classify_issue', { text: reportData.text });
    classificationResult = await toolHandlers.classify_issue(
      { text: reportData.text, has_media: !!ctx.mediaUrls.length },
      ctx,
    );
    ctx.classificationResult = classificationResult;
    completeClassify(classificationResult, await enrichReasoning('classify_issue', classificationResult)
      || `Categorized as [${classificationResult.category}] with severity [${classificationResult.severity}] (confidence: ${classificationResult.confidence}).`);
  }

  // Geo resolve
  const completeGeo = trace.startStep('geo_resolve', { lat: ctx.latitude, lng: ctx.longitude });
  const geoResult = await toolHandlers.geo_resolve({ lat: ctx.latitude, lng: ctx.longitude });
  ctx.geoResult = geoResult;
  completeGeo(geoResult, await enrichReasoning('geo_resolve', geoResult)
    || `Geospatial match resolved location coordinates to ward [${geoResult.ward}].`);
}

export const ReportIntakeAgent = {
  async execute(ctx) {
    const { reportData, trace } = ctx;

    // ── 1. Intake: record the incoming report ─────────────────────────
    const intakeResult = {
      report_id: reportData.id || 'new',
      text: reportData.text,
      lat: reportData.lat,
      lng: reportData.lng,
      reporter_id: reportData.reporter_id || 'anonymous',
      reporter_name: reportData.reporter_name || 'Anonymous',
      address: reportData.address || null,
      media_urls: reportData.media_urls || [],
    };

    const completeIntake = trace.startStep('intake', { reportData: intakeResult });

    // Validate coordinates (restrict to Lucknow bounding box)
    const latitude = parseFloat(reportData.lat);
    const longitude = parseFloat(reportData.lng);
    if (Number.isNaN(latitude) || Number.isNaN(longitude) ||
        latitude < MIN_LAT || latitude > MAX_LAT ||
        longitude < MIN_LNG || longitude > MAX_LNG) {
      trace.logStep('validation_error', { lat: reportData.lat, lng: reportData.lng },
        { error: 'Invalid coordinates' },
        'Coordinates are outside Lucknow city boundaries.', 0);
      throw new Error('Invalid coordinates: Out of Lucknow boundaries');
    }

    ctx.intakeResult = intakeResult;
    ctx.latitude = latitude;
    ctx.longitude = longitude;
    completeIntake(intakeResult, await enrichReasoning('intake', intakeResult)
      || 'Citizen report successfully received and logged.');

    // ── 2. Run the agentic ReAct investigation loop ───────────────────
    // The LLM autonomously reasons about the report and calls investigation
    // tools (classify, geo, find_cluster, ward-history audit) in its chosen
    // order. If it cannot engage (offline / stubbed), we fall back.
    const agenticOutcome = await ReportIntakeAgent.runAgenticInvestigation(ctx);

    // ── 3. Guarantee the ctx fields the transaction depends on ────────
    // The agent may or may not have called every tool; ensure classification
    // and geo are always populated so the downstream transaction is safe.
    if (!ctx.classificationResult || !ctx.geoResult) {
      await runDeterministicIntake(ctx);
    }

    // ── 4. Dispatch to the message bus for downstream agents ──────────
    ctx.messageBus?.sendMessage('ReportIntakeAgent', 'ClusteringAgent', 'intake_processed', {
      category: ctx.classificationResult.category,
      ward: ctx.geoResult.ward,
      lat: latitude,
      lng: longitude,
    });

    ctx.agentDecision = agenticOutcome;
  },

  /**
   * Drive the LLM ReAct loop to investigate the report. Returns the parsed
   * routing decision + raw reasoning text. On any failure, returns a safe
   * default so the pipeline continues deterministically.
   *
   * Exposed on the agent object for testability.
   */
  async runAgenticInvestigation(ctx) {
    const { reportData, trace } = ctx;
    const hasMedia = !!(ctx.mediaUrls?.length || ctx.mediaBase64);

    // Investigation tools the agent may call. These READ state and compute
    // classifications — they do NOT mutate tickets (that stays atomic later).
    const investigationHandlers = {
      classify_issue: async (args) => {
        // Reuse an upstream classification if present (media was pre-classified)
        if (ctx.classificationResult) return ctx.classificationResult;
        const result = await toolHandlers.classify_issue(
          { text: args.text ?? reportData.text, has_media: hasMedia },
          ctx,
        );
        ctx.classificationResult = result;
        return result;
      },
      geo_resolve: async (args) => {
        const result = await toolHandlers.geo_resolve({
          lat: args.lat ?? ctx.latitude,
          lng: args.lng ?? ctx.longitude,
        });
        ctx.geoResult = result;
        return result;
      },
      find_cluster: async (args) => {
        const category = args.category || ctx.classificationResult?.category || 'other';
        const result = await toolHandlers.find_cluster({
          lat: args.lat ?? ctx.latitude,
          lng: args.lng ?? ctx.longitude,
          category,
          timestamp: args.timestamp || new Date().toISOString(),
          text: args.text ?? reportData.text,
        });
        // Cache the cluster result so the transaction can reuse it
        ctx.clusterResult = result;
        return result;
      },
      query_ward_historical_stats: async (args) => {
        const ward = args.ward || ctx.geoResult?.ward;
        const category = args.category || ctx.classificationResult?.category || 'other';
        if (!ward) return { error: 'Ward not resolved yet — call geo_resolve first.' };
        return toolHandlers.query_ward_historical_stats({ ward, category });
      },
      audit_ticket_details: async (args) => toolHandlers.audit_ticket_details({ ticket_id: args.ticket_id }),
    };

    const toolExecutor = createToolExecutor(investigationHandlers, ctx);
    const tools = getToolsForContext('report').filter(t =>
      ['classify_issue', 'geo_resolve', 'find_cluster', 'query_ward_historical_stats', 'audit_ticket_details'].includes(t.name),
    );

    const systemPrompt = buildTriageAgentPrompt({
      reporterName: reportData.reporter_name,
      hasMedia,
    });

    const userMessage = `New citizen report received.
Text: "${reportData.text || '(no text description)'}"
Coordinates: ${ctx.latitude}, ${ctx.longitude}
${reportData.address ? `Stated address: ${reportData.address}` : ''}
${hasMedia ? 'Media evidence is attached.' : 'No media attached.'}

Investigate this report and decide how to route it.`;

    let client;
    try {
      client = getLLMClient();
    } catch {
      return parseDecision(null); // no LLM available → deterministic fallback handles it
    }

    // Pre-seed multimodal context so the agent can see the reported media.
    let initialHistory = null;
    if (ctx.mediaBase64 && ctx.mediaMimeType) {
      initialHistory = [{
        role: 'user',
        content: 'Attached is the evidence media for this report.',
        media: { mimeType: ctx.mediaMimeType, data: ctx.mediaBase64 },
      }];
    }

    let result;
    try {
      result = await runAgentLoop({
        client,
        systemPrompt,
        userMessage,
        tools,
        toolExecutor,
        trace,
        agentName: 'Report Triage Agent',
        maxIterations: 6,
        initialHistory,
      });
    } catch (err) {
      console.warn('[ReportIntakeAgent] Agentic loop errored, falling back to deterministic intake:', err.message);
      return parseDecision(null);
    }

    if (result.failed) {
      console.warn('[ReportIntakeAgent] LLM unavailable, using deterministic intake path.');
      return parseDecision(null);
    }

    const decision = parseDecision(result.finalText);

    // Record the final routing decision in the trace.
    try {
      await trace.logStep(
        'triage_decision',
        { iterations: result.iterations, tools_used: tools.map(t => t.name) },
        decision,
        `Triage decision: ${decision.decision} — ${decision.reasoning} (after ${result.iterations} reasoning turn(s)).`,
        0,
      );
    } catch { /* non-fatal */ }

    return decision;
  },
};
