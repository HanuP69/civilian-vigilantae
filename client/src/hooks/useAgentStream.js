import { useEffect, useRef, useState } from 'react';
import { mergeAgentTrace } from './agentStreamUtils.js';

const COMPLETE_STEPS = ['create_ticket', 'merge_into_ticket', 'agent_response', 'notify_reporters'];

export function useAgentStream(reportId, initialSteps = []) {
  const [steps, setSteps] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const startedAtRef = useRef(null);
  const completeRef = useRef(false);
  const sawLiveRef = useRef(false);
  const prevInitialRef = useRef([]);
  const esRef = useRef(null);

  useEffect(() => {
    if (!reportId) {
      setSteps([]);
      setIsComplete(false);
      completeRef.current = false;
      startedAtRef.current = null;
      sawLiveRef.current = false;
      prevInitialRef.current = [];
      return;
    }

    if (initialSteps.length > 0 && initialSteps !== prevInitialRef.current) {
      prevInitialRef.current = initialSteps;
      setSteps(prev => {
        const next = mergeAgentTrace(prev, initialSteps);
        const hasComplete = next.some(step => step && COMPLETE_STEPS.includes(step.step) && step.status === 'success');
        if (hasComplete && !completeRef.current) {
          completeRef.current = true;
          setIsComplete(true);
        }
        return next;
      });
    }
  }, [reportId, initialSteps]);

  useEffect(() => {
    if (!reportId) return;

    // Reset state & refs on reportId change to prevent contamination from previous reports
    setSteps([]);
    setIsComplete(false);
    completeRef.current = false;
    startedAtRef.current = null;
    sawLiveRef.current = false;
    prevInitialRef.current = [];

    // Close previous connection before opening new one
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const token = localStorage.getItem('userId') || 'anonymous';
    const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
    esRef.current = es;

    const onStep = (event) => {
      try {
        const step = JSON.parse(event.data);
        if (step.reportId !== reportId) return;

        sawLiveRef.current = true;
        if (!startedAtRef.current && step.timestamp) {
          startedAtRef.current = new Date(step.timestamp).getTime();
        }

        setSteps(prev => {
          const next = mergeAgentTrace(prev, [step]);
          if (!completeRef.current && COMPLETE_STEPS.includes(step.step) && step.status === 'success') {
            completeRef.current = true;
            setIsComplete(true);
          }
          return next;
        });
      } catch {}
    };

    es.addEventListener('agent_step', onStep);
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [reportId]);

  const currentStepName = steps.find((s) => s && s.status === 'pending')?.step || null;
  const startedAt = startedAtRef.current;

  return { steps, isComplete, currentStepName, startedAt };
}