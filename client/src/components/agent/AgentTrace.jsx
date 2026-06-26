import { useState } from 'react';
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
  const [expandedIndex, setExpandedIndex] = useState(null);

  if (!trace || trace.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-muted">
        <span>No agent trace logs available</span>
      </div>
    );
  }

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleKey = (e, index) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpand(index);
    }
  };

  return (
    <div className="flex flex-col gap-3" style={{ fontFamily: 'var(--font-mono)' }}>
      <AnimatePresence>
        {trace.map((step, idx) => {
          const isExpanded = expandedIndex === idx;
          const stepName = step.step || step.name;
          const icon = STEP_ICONS[stepName] || 'SYS';
          const color = STEP_COLORS[stepName] || 'var(--ink-muted)';
          const isError = step.status === 'error';
          const isPending = step.status === 'pending';
          const hasDetail = step.input || step.output || step.error || step.text || step.reasoning;
          const outputText = step.text || step.output?.text || step.reasoning;
          const outputWithoutText = step.output && typeof step.output === 'object'
            ? Object.fromEntries(Object.entries(step.output).filter(([k]) => k !== 'text'))
            : step.output;

          return (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              key={`${idx}-${stepName}`}
              className="card card-compact"
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
              aria-label={`${stepName} step${step.reasoning ? ': ' + step.reasoning : ''}`}
              onClick={() => toggleExpand(idx)}
              onKeyDown={(e) => handleKey(e, idx)}
              style={{
                border: `1px solid ${isError ? 'var(--error)' : 'var(--border)'}`,
                padding: 'var(--space-3) var(--space-4)',
                cursor: 'pointer',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ background: color, color: '#111', padding: '2px 6px', fontWeight: 700, borderRadius: '2px' }}>
                    {icon}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold" style={{ color: 'var(--ink-primary)' }}>
                      {stepName || 'system_process'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                      {step.reasoning || step.detail || step.result || 'Executing...'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {step.duration_ms != null && (
                    <span className="text-xs" style={{ color: 'var(--accent)', opacity: 0.8 }}>{step.duration_ms}ms</span>
                  )}
                  <span aria-hidden="true" style={{ color: 'var(--ink-muted)', fontSize: '0.7rem' }}>
                    {isExpanded ? '▾' : '▸'}
                  </span>
                  <span
                    style={{
                      color: isError ? 'var(--error)' : isPending ? 'var(--warning)' : 'var(--success)',
                      fontSize: '0.8rem',
                      fontWeight: 700
                    }}
                  >
                    {isError ? '[FAIL]' : isPending ? '[WAIT]' : '[ OK ]'}
                  </span>
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && hasDetail && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div
                      className="text-xs flex flex-col gap-2"
                      style={{
                        background: 'var(--bg-primary)',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-sm)',
                        marginTop: 'var(--space-3)',
                        border: '1px solid var(--border)'
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
                          <pre style={{ overflowX: 'auto', background: 'transparent', color: 'var(--ink-muted)', maxHeight: 300, overflowY: 'auto' }}>
                            {JSON.stringify(step.input, null, 2)}
                          </pre>
                        </div>
                      )}
                      {outputWithoutText && Object.keys(outputWithoutText).length > 0 && (
                        <div>
                          <span className="font-semibold block mb-1" style={{ color: 'var(--accent)' }}>&gt; PAYLOAD_OUT</span>
                          <pre style={{ overflowX: 'auto', background: 'transparent', color: 'var(--ink-muted)', maxHeight: 300, overflowY: 'auto' }}>
                            {JSON.stringify(outputWithoutText, null, 2)}
                          </pre>
                        </div>
                      )}
                      {step.error && (
                        <div>
                          <span className="font-semibold block mb-1" style={{ color: 'var(--error)' }}>&gt; STDERR</span>
                          <pre style={{ color: 'var(--error)', overflowX: 'auto', background: 'transparent' }}>
                            {step.error}
                          </pre>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default AgentTrace;
