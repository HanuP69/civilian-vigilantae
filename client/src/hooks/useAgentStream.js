import { useEffect, useMemo, useRef, useState } from 'react';

const COMPLETE_STEPS = ['create_ticket', 'merge_into_ticket', 'agent_response'];

function normalizeTrace(steps) {
  return steps.map((s, idx) => ({ ...s, index: idx }));
}

export function useAgentStream(reportId, initialSteps = []) {
  const normalized = normalizeTrace(initialSteps);
  const [steps, setSteps] = useState(normalized);
  const [isComplete, setIsComplete] = useState(() => {
    return normalized.some(s => COMPLETE_STEPS.includes(s.step) && s.status === 'success');
  });

  // Derive startedAt reactively from the first step's timestamp
  const startedAt = useMemo(() => {
    if (steps.length > 0 && steps[0].timestamp) {
      return new Date(steps[0].timestamp).getTime();
    }
    return null;
  }, [steps.length > 0 ? steps[0]?.timestamp : null]);

  const completeRef = useRef(false);
  const seededRef = useRef(false);

  // When initialSteps arrive (after HTTP response), seed them into state
  useEffect(() => {
    if (initialSteps.length > 0 && !seededRef.current) {
      seededRef.current = true;
      const normalized = normalizeTrace(initialSteps);
      setSteps(normalized);
      if (normalized.some(s => COMPLETE_STEPS.includes(s.step) && s.status === 'success')) {
        completeRef.current = true;
        setIsComplete(true);
      }
    }
  }, [initialSteps]);

  useEffect(() => {
    if (!reportId) return;
    if (completeRef.current) return;

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

  return { steps, isComplete, currentStepName, startedAt };
}
