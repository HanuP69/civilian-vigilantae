/**
 * @module agent/traceLogger
 * @description Captures every agent decision as a structured step for the
 * animated reasoning trace UI.
 *
 * Each step is stored in the ticket's agent_trace array and streamed
 * to connected clients via SSE.
 */

/**
 * @typedef {Object} AgentStep
 * @property {string} step       — tool/action name
 * @property {string} timestamp  — ISO 8601 timestamp
 * @property {Object} input      — summarized input data
 * @property {Object} output     — summarized output data
 * @property {string} reasoning  — human-readable explanation
 * @property {number} duration_ms — execution time in milliseconds
 * @property {'pending'|'success'|'error'} status
 */

/**
 * Create a new trace logger for a specific report/ticket processing run.
 *
 * @param {string} reportId — the report or ticket ID being processed
 * @param {Function} [onStep] — optional callback invoked on each step (for SSE streaming)
 * @returns {Object} trace logger instance
 */
export function createTraceLogger(reportId, onStep) {
  /** @type {AgentStep[]} */
  const steps = [];

  return {
    /**
     * Log the start of a step. Returns a function to call when the step completes.
     *
     * @param {string} stepName — tool or action name
     * @param {Object} input    — input data summary
     * @returns {Function} complete(output, reasoning, status) — call to finalize the step
     */
    startStep(stepName, input) {
      const startTime = Date.now();
      const step = {
        step: stepName,
        timestamp: new Date().toISOString(),
        input,
        output: null,
        reasoning: '',
        duration_ms: 0,
        status: 'pending',
      };

      steps.push(step);

      // Notify listener that step started
      if (onStep) {
        onStep({ ...step, reportId, index: steps.length - 1 });
      }

      // Persist pending step
      (async () => {
        try {
          const { db } = await import('../config/firebase.js');
          const ticketRef = db.collection('tickets').doc(reportId);
          const ticketDoc = await ticketRef.get();
          if (ticketDoc.exists) {
            await ticketRef.update({ agent_trace: [...steps] });
          } else {
            const reportRef = db.collection('reports').doc(reportId);
            const reportDoc = await reportRef.get();
            if (reportDoc.exists) {
              await reportRef.update({ agent_trace: [...steps] });
            }
          }
        } catch {}
      })();

      return async (output, reasoning = '', status = 'success') => {
        step.output = output;
        step.reasoning = reasoning;
        step.status = status;
        step.duration_ms = Date.now() - startTime;

        // Notify listener that step completed
        if (onStep) {
          onStep({ ...step, reportId, index: steps.length - 1 });
        }

        // Persist completed step
        try {
          const { db } = await import('../config/firebase.js');
          const ticketRef = db.collection('tickets').doc(reportId);
          const ticketDoc = await ticketRef.get();
          if (ticketDoc.exists) {
            await ticketRef.update({ agent_trace: [...steps] });
          } else {
            const reportRef = db.collection('reports').doc(reportId);
            const reportDoc = await reportRef.get();
            if (reportDoc.exists) {
              await reportRef.update({ agent_trace: [...steps] });
            }
          }
        } catch (err) {
          console.warn('[TraceLogger] Failed to persist step completion:', err.message);
        }
      };
    },

    /**
     * Log a quick single-shot step (start + complete in one call).
     *
     * @param {string} stepName
     * @param {Object} input
     * @param {Object} output
     * @param {string} [reasoning]
     * @param {number} [durationMs]
     */
    async logStep(stepName, input, output, reasoning = '', durationMs = 0) {
      const step = {
        step: stepName,
        timestamp: new Date().toISOString(),
        input,
        output,
        reasoning,
        duration_ms: durationMs,
        status: 'success',
      };

      steps.push(step);

      if (onStep) {
        onStep({ ...step, reportId, index: steps.length - 1 });
      }

      // Persist logged step
      try {
        const { db } = await import('../config/firebase.js');
        const ticketRef = db.collection('tickets').doc(reportId);
        const ticketDoc = await ticketRef.get();
        if (ticketDoc.exists) {
          await ticketRef.update({ agent_trace: [...steps] });
        } else {
          const reportRef = db.collection('reports').doc(reportId);
          const reportDoc = await reportRef.get();
          if (reportDoc.exists) {
            await reportRef.update({ agent_trace: [...steps] });
          }
        }
      } catch (err) {
        console.warn('[TraceLogger] Failed to persist logStep:', err.message);
      }
    },

    /**
     * Get all recorded steps.
     * @returns {AgentStep[]}
     */
    getSteps() {
      return [...steps];
    },

    /**
     * Get the report ID this logger is tracking.
     * @returns {string}
     */
    getReportId() {
      return reportId;
    },
  };
}
