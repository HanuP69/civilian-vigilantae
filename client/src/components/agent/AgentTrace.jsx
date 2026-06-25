import { useState } from 'react';

const STEP_ICONS = {
  llm_reasoning: '🧠',
  classify_issue: '🏷️',
  geo_resolve: '📍',
  find_cluster: '🔍',
  compute_priority: '⚡',
  create_ticket: '🎫',
  merge_into_ticket: '🔀',
  record_verification: '✅',
  check_sla_status: '⏱️',
  escalate_ticket: '⚠️',
  notify_reporters: '📢',
  flag_for_review: '🚩',
  query_recurrence_risk: '📈',
  agent_response: '💬'
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

  return (
    <div className="trace-timeline flex flex-col gap-3">
      {trace.map((step, idx) => {
        const isExpanded = expandedIndex === idx;
        const icon = STEP_ICONS[step.step] || STEP_ICONS[step.name] || '⚙️';
        const color = STEP_COLORS[step.step] || STEP_COLORS[step.name] || 'var(--ink-muted)';
        const isError = step.status === 'error';
        const isPending = step.status === 'pending';

        return (
          <div
            key={idx}
            className={`trace-step card card-compact card-interactive flex flex-col gap-2 ${isExpanded ? 'expanded' : ''}`}
            onClick={() => toggleExpand(idx)}
            style={{
              animationDelay: `${idx * 150}ms`,
              borderLeft: `4px solid ${isError ? 'var(--error)' : color}`,
              padding: 'var(--space-3) var(--space-4)',
              cursor: 'pointer'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold" style={{ color: 'var(--ink-primary)' }}>
                    {step.step || step.name || 'System Step'}
                  </span>
                  <span className="text-xs text-muted">
                    {step.detail || step.result || step.reasoning || 'Executed step'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {step.duration_ms && (
                  <span className="text-xs text-mono text-muted">{step.duration_ms}ms</span>
                )}
                <span
                  style={{
                    color: isError ? 'var(--error)' : isPending ? 'var(--warning)' : 'var(--success)',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                >
                  {isError ? '✗' : isPending ? '…' : '✓'}
                </span>
              </div>
            </div>

            {isExpanded && (step.input || step.output || step.error || step.text) && (
              <div
                className="trace-details text-xs flex flex-col gap-2"
                style={{
                  background: 'var(--bg-surface)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  marginTop: 'var(--space-2)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {step.text && (
                  <div>
                    <span className="font-semibold text-muted block mb-1">Message:</span>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{step.text}</p>
                  </div>
                )}
                {step.input && Object.keys(step.input).length > 0 && (
                  <div>
                    <span className="font-semibold text-muted block mb-1">Input Arguments:</span>
                    <pre className="text-mono" style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.2)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)' }}>
                      {JSON.stringify(step.input, null, 2)}
                    </pre>
                  </div>
                )}
                {step.output && Object.keys(step.output).length > 0 && (
                  <div>
                    <span className="font-semibold text-muted block mb-1">Returned Output:</span>
                    <pre className="text-mono" style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.2)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)' }}>
                      {JSON.stringify(step.output, null, 2)}
                    </pre>
                  </div>
                )}
                {step.error && (
                  <div>
                    <span className="font-semibold text-muted block mb-1" style={{ color: 'var(--error)' }}>Error details:</span>
                    <pre className="text-mono" style={{ color: 'var(--error)', overflowX: 'auto', background: 'rgba(0,0,0,0.2)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)' }}>
                      {step.error}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default AgentTrace;
