import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STEP_ICONS = {
  llm_reasoning: 'LLM',
  classify_issue: 'CLS',
  geo_resolve: 'GEO',
  find_cluster: 'FND',
  compute_priority: 'PRI',
  create_ticket: 'TKT',
  merge_into_ticket: 'MRG',
  record_verification: 'VRF',
  check_sla_status: 'SLA',
  escalate_ticket: 'ESC',
  notify_reporters: 'NOT',
  flag_for_review: 'FLG',
  query_recurrence_risk: 'RSK',
  agent_response: 'RES'
};

const STEP_COLORS = {
  llm_reasoning: 'var(--accent-muted)',
  classify_issue: 'var(--accent)',
  geo_resolve: 'var(--accent)',
  find_cluster: 'var(--accent)',
  compute_priority: 'var(--warning)',
  create_ticket: 'var(--success)',
  merge_into_ticket: 'var(--warning)',
  record_verification: 'var(--success)',
  check_sla_status: 'var(--accent-muted)',
  escalate_ticket: 'var(--error)',
  notify_reporters: 'var(--success)',
  flag_for_review: 'var(--error)',
  query_recurrence_risk: 'var(--warning)'
};

function AgentTrace({ trace = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedRunIndex, setSelectedRunIndex] = useState(0);
  const [isDetailOpen, setIsDetailOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  if (!trace || trace.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-muted">
        <span>No agent trace logs available</span>
      </div>
    );
  }

  // Deduplicate trace to find the latest run of each step type
  const latestSteps = [];
  const seenSteps = new Set();
  for (let i = trace.length - 1; i >= 0; i--) {
    const step = trace[i];
    const stepName = step.step || step.name;
    if (stepName && !seenSteps.has(stepName)) {
      seenSteps.add(stepName);
      latestSteps.unshift(step);
    }
  }

  // Group full history trace steps into "Runs" based on timestamp proximity (threshold: 15 seconds)
  const groupStepsIntoRuns = (steps) => {
    if (!steps || steps.length === 0) return [];
    // Sort chronologically just in case
    const sorted = [...steps].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
    
    const runsList = [];
    let currentRun = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      const prevTime = new Date(sorted[i - 1].timestamp || 0).getTime();
      const currTime = new Date(sorted[i].timestamp || 0).getTime();
      
      if (Math.abs(currTime - prevTime) < 15000) {
        currentRun.push(sorted[i]);
      } else {
        runsList.push(currentRun);
        currentRun = [sorted[i]];
      }
    }
    runsList.push(currentRun);
    return runsList;
  };

  const runs = groupStepsIntoRuns(trace);
  const hasDuplicates = trace.length !== latestSteps.length;

  const stepsToRender = showHistory && runs.length > 0 ? (runs[selectedRunIndex] || []) : latestSteps;

  // Reset index if it goes out of bounds when switching modes
  useEffect(() => {
    if (currentIndex >= stepsToRender.length) {
      setCurrentIndex(0);
    }
  }, [stepsToRender.length, currentIndex]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : stepsToRender.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < stepsToRender.length - 1 ? prev + 1 : 0));
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsDetailOpen(!isDetailOpen);
    }
  };

  const getRunLabel = (run, idx) => {
    if (idx === 0) return `RUN 1: INTAKE PIPELINE`;
    const stepNames = run.map(s => s.step || s.name);
    if (stepNames.includes('escalate_ticket')) return `RUN ${idx + 1}: ESCALATION ALERT`;
    if (stepNames.includes('compute_priority')) return `RUN ${idx + 1}: PRIORITY UPDATE`;
    return `RUN ${idx + 1}: SYSTEM UPDATE`;
  };

  const step = stepsToRender[currentIndex];
  if (!step) return null;

  const stepName = step.step || step.name;
  const icon = STEP_ICONS[stepName] || 'SYS';
  const color = STEP_COLORS[stepName] || 'var(--ink-muted)';
  const isError = step.status === 'error';
  const isPending = step.status === 'pending';
  const outputText = step.text || step.output?.text;
  const outputWithoutText = step.output && typeof step.output === 'object'
    ? Object.fromEntries(Object.entries(step.output).filter(([k]) => k !== 'text'))
    : step.output;
  const hasDetail = (step.input && Object.keys(step.input).length > 0) || 
                    (outputWithoutText && Object.keys(outputWithoutText).length > 0) || 
                    step.error || 
                    outputText;

  return (
    <div className="flex flex-col gap-3" style={{ fontFamily: 'var(--font-mono)', maxWidth: '720px', width: '100%' }}>
      {/* Navigation controls header */}
      <div className="flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', marginBottom: '8px' }}>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="font-pixel"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--accent)',
              fontSize: '8px',
              padding: '4px 10px',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            ◀ PREV
          </button>
          <span className="font-pixel" style={{ fontSize: '9px', color: 'var(--ink-secondary)', minWidth: '70px', textAlign: 'center' }}>
            {currentIndex + 1} / {stepsToRender.length}
          </span>
          <button
            onClick={handleNext}
            className="font-pixel"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--accent)',
              fontSize: '8px',
              padding: '4px 10px',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            NEXT ▶
          </button>
        </div>
        
        {hasDuplicates && (
          <button
            onClick={() => {
              setShowHistory(!showHistory);
              setSelectedRunIndex(0);
              setCurrentIndex(0);
            }}
            className="font-pixel"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--accent)',
              fontSize: '8px',
              padding: '4px 8px',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            {showHistory ? '[ 📑 CURRENT PIPELINE ]' : '[ 🕒 AUDIT HISTORY ]'}
          </button>
        )}
      </div>

      {/* Grouped Run Selector buttons (Only shown in Audit History mode) */}
      {showHistory && runs.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px', borderBottom: '1px dashed var(--border-subtle)', paddingBottom: '8px' }}>
          {runs.map((run, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSelectedRunIndex(idx);
                setCurrentIndex(0);
              }}
              className="font-pixel"
              style={{
                padding: '4px 8px',
                fontSize: '8px',
                border: '1px solid var(--border)',
                borderRadius: 0,
                background: selectedRunIndex === idx ? 'var(--accent)' : 'var(--bg-surface)',
                color: selectedRunIndex === idx ? '#000' : 'var(--ink-secondary)',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              {getRunLabel(run, idx)}
            </button>
          ))}
        </div>
      )}

      {/* Render Single Active Step Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentIndex}-${stepName}-${showHistory}-${selectedRunIndex}`}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.15 }}
          className="card card-compact"
          style={{
            border: `1px solid ${isError ? 'var(--error)' : 'var(--border)'}`,
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--bg-secondary)',
            borderRadius: 0,
          }}
        >
          <div 
            className="flex items-center justify-between"
            onClick={() => setIsDetailOpen(!isDetailOpen)}
            onKeyDown={handleKey}
            role="button"
            tabIndex={0}
            aria-expanded={isDetailOpen}
            aria-label={`${stepName} step${step.reasoning ? ': ' + step.reasoning : ''}`}
            style={{ cursor: 'pointer', width: '100%', userSelect: 'none' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ background: color, color: '#111', padding: '2px 6px', fontWeight: 700, borderRadius: '2px' }}>
                {icon}
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ color: 'var(--ink-primary)', fontSize: '0.95rem', fontWeight: 600 }}>
                    {stepName || 'system_process'}
                  </span>
                  {stepName === 'record_verification' && step.output?.verification_score !== undefined && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--success)', border: '1px solid var(--success)', padding: '1px 4px', fontFamily: 'var(--font-mono)' }}>
                      SCORE: {Math.round(step.output.verification_score)}%
                    </span>
                  )}
                  {stepName === 'compute_priority' && step.output?.priority_score !== undefined && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--warning)', border: '1px solid var(--warning)', padding: '1px 4px', fontFamily: 'var(--font-mono)' }}>
                      PRIORITY: {Math.round(step.output.priority_score)}
                    </span>
                  )}
                  {stepName === 'check_sla_status' && step.output?.probability !== undefined && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--error)', border: '1px solid var(--error)', padding: '1px 4px', fontFamily: 'var(--font-mono)' }}>
                      BREACH RISK: {Math.round(step.output.probability * 100)}%
                    </span>
                  )}
                  {stepName === 'classify_issue' && step.output?.confidence !== undefined && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--accent)', border: '1px solid var(--accent)', padding: '1px 4px', fontFamily: 'var(--font-mono)' }}>
                      CONFIDENCE: {Math.round(step.output.confidence * 100)}%
                    </span>
                  )}
                </div>
                <span style={{ color: 'var(--ink-muted)', wordBreak: 'break-word', display: 'block', fontSize: '0.85rem', marginTop: '2px' }}>
                  {step.reasoning || step.detail || step.result || 'Executing...'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {step.duration_ms != null && (
                <span style={{ color: 'var(--accent)', opacity: 0.8, fontSize: '0.8rem' }}>{step.duration_ms}ms</span>
              )}
              {hasDetail && (
                <span aria-hidden="true" style={{ color: 'var(--ink-muted)', fontSize: '0.75rem' }}>
                  {isDetailOpen ? '▾' : '▸'}
                </span>
              )}
              <span
                style={{
                  color: isError ? 'var(--error)' : isPending ? 'var(--warning)' : 'var(--success)',
                  fontSize: '0.85rem',
                  fontWeight: 700
                }}
              >
                {isError ? '[FAIL]' : isPending ? '[WAIT]' : '[ OK ]'}
              </span>
            </div>
          </div>

          <AnimatePresence>
            {isDetailOpen && hasDetail && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <div
                  className="flex flex-col gap-3 rpg-scrollbar"
                  style={{
                    background: 'var(--bg-primary)',
                    padding: 'var(--space-3)',
                    borderRadius: 0,
                    marginTop: 'var(--space-3)',
                    border: '1px solid var(--border)',
                    maxHeight: '220px',
                    overflowY: 'auto'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {outputText && (
                    <div>
                      <span className="font-semibold block mb-1" style={{ color: 'var(--accent)' }}>&gt; OUTPUT_LOG</span>
                      <p style={{ whiteSpace: 'pre-wrap', color: 'var(--ink-secondary)' }}>{outputText}</p>
                    </div>
                  )}
                  {step.input && Object.keys(step.input).length > 0 && (
                    <div>
                      <span className="font-semibold block mb-1" style={{ color: 'var(--accent)' }}>&gt; PAYLOAD_IN</span>
                      <pre className="rpg-scrollbar" style={{ overflowX: 'auto', background: 'var(--bg-primary)', color: 'var(--ink-muted)', maxHeight: 200, overflowY: 'auto', fontSize: '0.8rem', padding: '10px', border: '1px solid var(--border)', borderRadius: '2px' }}>
                        {JSON.stringify(step.input, null, 2)}
                      </pre>
                    </div>
                  )}
                  {outputWithoutText && Object.keys(outputWithoutText).length > 0 && (
                    <div>
                      <span className="font-semibold block mb-1" style={{ color: 'var(--accent)' }}>&gt; PAYLOAD_OUT</span>
                      <pre className="rpg-scrollbar" style={{ overflowX: 'auto', background: 'var(--bg-primary)', color: 'var(--ink-muted)', maxHeight: 200, overflowY: 'auto', fontSize: '0.8rem', padding: '10px', border: '1px solid var(--border)', borderRadius: '2px' }}>
                        {JSON.stringify(outputWithoutText, null, 2)}
                      </pre>
                    </div>
                  )}
                  {step.error && (
                    <div>
                      <span className="font-semibold block mb-1" style={{ color: 'var(--error)' }}>&gt; STDERR</span>
                      <pre className="rpg-scrollbar" style={{ color: 'var(--error)', overflowX: 'auto', background: 'var(--bg-primary)', padding: '10px', border: '1px solid var(--error)', borderRadius: '2px', maxHeight: 150, overflowY: 'auto', fontSize: '0.8rem' }}>
                        {step.error}
                      </pre>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default AgentTrace;
