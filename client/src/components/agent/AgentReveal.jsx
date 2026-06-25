import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AgentTrace from './AgentTrace.jsx';

const STAGE = [
  { key: 'classify_issue', label: 'Classify', icon: 'CLS' },
  { key: 'geo_resolve', label: 'Locate', icon: 'GEO' },
  { key: 'find_cluster', label: 'Dedup', icon: 'FND' },
  { key: 'create_ticket', label: 'Create', icon: 'TKT', alt: 'merge_into_ticket' },
  { key: 'compute_priority', label: 'Priority', icon: 'PRI' },
  { key: 'notify_reporters', label: 'Notify', icon: 'NOT' },
];

const resultOf = (steps, name) => steps.find(s => s && s.step === name && s.status === 'success')?.output;

const ease = [0.16, 1, 0.3, 1];

function AgentReveal({ steps, isComplete, result, startedAt, onClose }) {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (isComplete) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [isComplete]);

  const elapsedMs = startedAt ? now - startedAt : 0;
  const elapsedSec = (elapsedMs / 1000).toFixed(1);

  const stageState = (key, alt) => {
    const done = steps.some(s => s && (s.step === key || (alt && s.step === alt)) && s.status === 'success');
    const active = steps.some(s => s && (s.step === key || (alt && s.step === alt)) && s.status === 'pending');
    const failed = steps.some(s => s && (s.step === key || (alt && s.step === alt)) && s.status === 'error');
    if (failed) return 'error';
    if (done) return 'done';
    if (active) return 'active';
    return 'idle';
  };

  const classResult = resultOf(steps, 'classify_issue');
  const geoResult = resultOf(steps, 'geo_resolve');
  const clusterResult = resultOf(steps, 'find_cluster');
  const priorityResult = resultOf(steps, 'compute_priority');
  const ticketResult = resultOf(steps, 'create_ticket') || resultOf(steps, 'merge_into_ticket');
  const merged = steps.some(s => s && s.step === 'merge_into_ticket' && s.status === 'success');

  const finalTicketId = result?.ticket_id || ticketResult?.ticket_id;
  const finalScore = priorityResult?.priority_score;

  return (
    <motion.div
      className="agent-reveal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="agent-reveal-panel"
        initial={{ scale: 0.96, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 24 }}
        transition={{ duration: 0.5, ease }}
      >
        <div className="agent-reveal-header">
          <div className="flex items-center gap-3">
            <motion.span
              className="agent-reveal-pulse"
              animate={isComplete ? {} : { scale: [1, 1.35, 1], opacity: [1, 0.5, 1] }}
              transition={isComplete ? {} : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ background: isComplete ? 'var(--success)' : 'var(--accent)' }}
            />
            <span className="font-mono" style={{ letterSpacing: '0.2em', fontSize: '0.8rem', color: 'var(--ink-secondary)' }}>
              SENTINEL AGENT
            </span>
          </div>
          <span className="font-mono text-xs text-muted">
            {isComplete ? `done in ${elapsedSec}s` : `${elapsedSec}s`}
          </span>
        </div>

        <div className="agent-stage-rail">
          {STAGE.map((stage, i) => {
            const state = stageState(stage.key, stage.alt);
            return (
              <div className="agent-stage-item" key={stage.key}>
                <motion.div
                  className={`agent-stage-node agent-stage-${state}`}
                  initial={false}
                  animate={state === 'active' ? { boxShadow: `0 0 0 0 ${stage.key === 'compute_priority' ? 'var(--warning)' : 'var(--accent)'}` } : {}}
                  transition={state === 'active' ? { duration: 1.4, repeat: Infinity } : {}}
                >
                  <span className="agent-stage-icon">{stage.icon}</span>
                </motion.div>
                <span className={`agent-stage-label ${state === 'idle' ? 'text-muted' : ''}`}>{stage.label}</span>
                {i < STAGE.length - 1 && <div className={`agent-stage-connector ${stageState(STAGE[i + 1].key, STAGE[i + 1].alt) !== 'idle' ? 'filled' : ''}`} />}
              </div>
            );
          })}
        </div>

        <div className="agent-insight-row">
          <AnimatePresence mode="popLayout">
            {classResult && (
              <motion.div className="agent-insight-chip" key="cls" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="agent-insight-key">Classification</span>
                <span className="agent-insight-val">{classResult.category} · {classResult.severity}</span>
                {classResult.confidence != null && (
                  <span className="agent-insight-meta">conf {(classResult.confidence * 100).toFixed(0)}%</span>
                )}
              </motion.div>
            )}
            {geoResult && (
              <motion.div className="agent-insight-chip" key="geo" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="agent-insight-key">Ward</span>
                <span className="agent-insight-val">{geoResult.ward}</span>
              </motion.div>
            )}
            {clusterResult && (
              <motion.div className="agent-insight-chip" key="clu" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="agent-insight-key">Dedup</span>
                <span className="agent-insight-val">{clusterResult.found ? `merged · ${clusterResult.cluster_size} reports` : 'unique'}</span>
              </motion.div>
            )}
            {priorityResult && (
              <motion.div className="agent-insight-chip" key="pri" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="agent-insight-key">Priority</span>
                <span className="agent-insight-val" style={{ color: priorityResult.priority_score > 70 ? 'var(--error)' : 'var(--accent)' }}>
                  {Math.round(priorityResult.priority_score)}/100
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="agent-live-log">
          <div className="agent-live-log-header font-mono text-xs text-muted">live reasoning trace</div>
          <AgentTrace trace={steps.filter(Boolean)} />
        </div>

        <AnimatePresence>
          {isComplete && (
            <motion.div
              className="agent-result-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease, delay: 0.1 }}
            >
              <div className="flex items-center gap-3">
                <div className="agent-result-badge">✓</div>
                <div className="flex flex-col">
                  <span className="font-serif" style={{ fontSize: '1.5rem', color: 'var(--ink-primary)' }}>
                    {merged ? 'Merged into existing report' : 'Report dispatched'}
                  </span>
                  {finalTicketId && (
                    <span className="text-muted text-sm font-mono">ticket {finalTicketId}</span>
                  )}
                </div>
                {finalScore != null && (
                  <div className="agent-result-priority">
                    <span style={{ fontSize: '2rem', fontWeight: 700, color: finalScore > 70 ? 'var(--error)' : 'var(--accent)' }}>
                      {Math.round(finalScore)}
                    </span>
                    <span className="text-xs text-muted">priority</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3" style={{ marginTop: 'var(--space-5)' }}>
                {finalTicketId && (
                  <button className="btn btn-primary" onClick={() => navigate(`/ticket/${finalTicketId}`)}>View Ticket</button>
                )}
                <button className="btn btn-secondary" onClick={onClose}>Report Another</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default AgentReveal;
