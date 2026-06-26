import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

const COMPLETE_STEPS = ['create_ticket', 'merge_into_ticket', 'agent_response'];

function normalizeTrace(steps) {
  return steps.map((s, idx) => ({ ...s, index: idx }));
}

/**
 * Hook that manages agent pipeline step state.
 *
 * When `initialSteps` arrive (from the HTTP response trace), they are
 * replayed one-by-one with a short delay so the mascot can walk
 * the zigzag path in real time instead of appearing all at once.
 */
export function useAgentStream(reportId, initialSteps = []) {
  const [steps, setSteps] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const startedAt = useRef(null);
  const completeRef = useRef(false);
  const replayTimerRef = useRef(null);

  // Derive startedAt reactively from the first step's timestamp
  const startedAtMs = useMemo(() => {
    if (steps.length > 0 && steps[0].timestamp) {
      return new Date(steps[0].timestamp).getTime();
    }
    return null;
  }, [steps.length > 0 ? steps[0]?.timestamp : null]);

  // Replay initial steps one by one with a stagger delay
  const replaySteps = useCallback((trace) => {
    const normalized = normalizeTrace(trace);
    if (normalized.length === 0) return;

    // Set startedAt from the first step
    if (!startedAt.current && normalized[0].timestamp) {
      startedAt.current = new Date(normalized[0].timestamp).getTime();
    }

    // Find the actual pipeline steps (skip llm_reasoning duplicates)
    const pipelineSteps = [];
    const seen = new Set();
    for (const s of normalized) {
      // Deduplicate: only keep the 'success' status version of each step name
      const key = s.step;
      if (!seen.has(key)) {
        seen.add(key);
        pipelineSteps.push(s.status === 'pending' ? s : s);
      } else if (s.status === 'success') {
        // Replace the pending version with the success version
        const idx = pipelineSteps.findIndex(ps => ps.step === key);
        if (idx !== -1) pipelineSteps[idx] = s;
      }
    }

    // Replay with staggered timing
    let i = 0;
    const replayNext = () => {
      if (i >= pipelineSteps.length) {
        // Check if complete
        if (!completeRef.current && pipelineSteps.some(s => COMPLETE_STEPS.includes(s.step) && s.status === 'success')) {
          completeRef.current = true;
          setIsComplete(true);
        }
        return;
      }

      setSteps(prev => {
        const next = [...prev];
        const s = pipelineSteps[i];
        const idx = s.index;
        if (idx != null) next[idx] = s;
        // Check completion
        if (!completeRef.current && COMPLETE_STEPS.includes(s.step) && s.status === 'success') {
          completeRef.current = true;
          setIsComplete(true);
        }
        return next;
      });

      i++;
      // Shorter delay for quick visual pacing — 600ms per step
      replayTimerRef.current = setTimeout(replayNext, 600);
    };

    // Start replay after a brief pause to let the overlay animate in
    replayTimerRef.current = setTimeout(replayNext, 400);
  }, []);

  // Seed initialSteps when they arrive
  const prevInitialRef = useRef(initialSteps);
  useEffect(() => {
    if (initialSteps.length > 0 && initialSteps !== prevInitialRef.current) {
      prevInitialRef.current = initialSteps;
      // Clear any existing replay
      if (replayTimerRef.current) clearTimeout(replayTimerRef.current);
      completeRef.current = false;
      setIsComplete(false);
      setSteps([]);
      replaySteps(initialSteps);
    }
  }, [initialSteps, replaySteps]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (replayTimerRef.current) clearTimeout(replayTimerRef.current);
    };
  }, []);

  // SSE fallback — listen for live events if reportId is set
  useEffect(() => {
    if (!reportId) return;

    const es = new EventSource('/api/events');

    const onStep = (e) => {
      try {
        const step = JSON.parse(e.data);
        if (step.reportId !== reportId) return;

        setSteps(prev => {
          const idx = step.index;
          if (idx == null) return prev;
          const next = [...prev];
          next[idx] = step;
          if (!completeRef.current && COMPLETE_STEPS.includes(step.step) && step.status === 'success') {
            completeRef.current = true;
            setIsComplete(true);
          }
          return next;
        });
      } catch {}
    };

    es.addEventListener('agent_step', onStep);
    return () => es.close();
  }, [reportId]);

  const currentStepName = steps.find(s => s && s.status === 'pending')?.step || null;

  return { steps, isComplete, currentStepName, startedAt: startedAtMs };
}
