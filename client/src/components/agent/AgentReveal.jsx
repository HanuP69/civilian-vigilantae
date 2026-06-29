import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AgentTrace from './AgentTrace.jsx';
import ZigzagPath from './ZigzagPath.jsx';

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
        className="agent-reveal-panel rpg-panel-sandstone rpg-scrollbar"
        initial={{ scale: 0.96, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 24 }}
        transition={{ duration: 0.5, ease }}
        style={{ borderRadius: 0, padding: '8px', maxWidth: '660px', width: '92%' }}
      >
        <div className="card pixel-border animate-fade-up" style={{ background: '#fcf8ee', border: '2px solid #85613c', padding: '20px 24px', color: '#291d12', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="agent-reveal-header" style={{ borderBottom: '2px solid #85613c', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
            <div className="flex items-center gap-3">
              <motion.span
                className="agent-reveal-pulse"
                animate={isComplete ? {} : { scale: [1, 1.35, 1], opacity: [1, 0.5, 1] }}
                transition={isComplete ? {} : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                style={{ background: isComplete ? '#16803d' : '#b45309', borderRadius: 0, width: '8px', height: '8px', display: 'inline-block' }}
              />
              <span className="font-pixel" style={{ fontSize: '10px', color: '#291d12', letterSpacing: '0.1em' }}>
                🤖 SENTINEL AGENT AUTOPILOT
              </span>
            </div>
            <span className="font-pixel text-muted" style={{ fontSize: '8px', color: '#6b5139' }}>
              {isComplete ? `DONE IN ${elapsedSec}S` : `${elapsedSec}S`}
            </span>
          </div>

          <ZigzagPath steps={steps} isComplete={isComplete} />

          <div className="agent-insight-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <AnimatePresence mode="popLayout">
              {classResult && (
                <motion.div className="card pixel-border" key="cls" style={{ background: '#fffbeb', border: '1px solid #85613c', padding: '8px 12px', display: 'flex', flexDirection: 'column', flex: 1, minWidth: '120px' }}>
                  <span className="font-pixel" style={{ fontSize: '7px', color: '#6b5139' }}>CLASSIFICATION</span>
                  <span className="font-pixel" style={{ fontSize: '9px', color: '#291d12', marginTop: '2px', fontWeight: 600 }}>{classResult.category.toUpperCase()} · {classResult.severity.toUpperCase()}</span>
                  {classResult.confidence != null && (
                    <span className="font-mono text-muted" style={{ fontSize: '7.5px', marginTop: '2px' }}>conf {(classResult.confidence * 100).toFixed(0)}%</span>
                  )}
                </motion.div>
              )}
              {geoResult && (
                <motion.div className="card pixel-border" key="geo" style={{ background: '#fffbeb', border: '1px solid #85613c', padding: '8px 12px', display: 'flex', flexDirection: 'column', flex: 1, minWidth: '120px' }}>
                  <span className="font-pixel" style={{ fontSize: '7px', color: '#6b5139' }}>WARD dispatch</span>
                  <span className="font-pixel" style={{ fontSize: '9px', color: '#291d12', marginTop: '2px', fontWeight: 600 }}>{geoResult.ward.toUpperCase()}</span>
                </motion.div>
              )}
              {clusterResult && (
                <motion.div className="card pixel-border" key="clu" style={{ background: '#fffbeb', border: '1px solid #85613c', padding: '8px 12px', display: 'flex', flexDirection: 'column', flex: 1, minWidth: '120px' }}>
                  <span className="font-pixel" style={{ fontSize: '7px', color: '#6b5139' }}>DEDUP SCAN</span>
                  <span className="font-pixel" style={{ fontSize: '9px', color: '#291d12', marginTop: '2px', fontWeight: 600 }}>{clusterResult.found ? `MERGED (${clusterResult.cluster_size} rpts)` : 'UNIQUE'}</span>
                </motion.div>
              )}
              {priorityResult && (
                <motion.div className="card pixel-border" key="pri" style={{ background: '#fffbeb', border: '1px solid #85613c', padding: '8px 12px', display: 'flex', flexDirection: 'column', flex: 1, minWidth: '120px' }}>
                  <span className="font-pixel" style={{ fontSize: '7px', color: '#6b5139' }}>THREAT LEVEL</span>
                  <span className="font-pixel" style={{ fontSize: '9px', color: priorityResult.priority_score > 70 ? '#b91c1c' : '#b45309', marginTop: '2px', fontWeight: 'bold' }}>
                    {Math.round(priorityResult.priority_score)}/100
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="agent-live-log" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="font-pixel text-muted" style={{ fontSize: '8px', color: '#6b5139' }}>LIVE REASONING TRACE</div>
            <AgentTrace trace={steps.filter(Boolean)} />
          </div>

          <AnimatePresence>
            {isComplete && (
              <motion.div
                className="card pixel-border animate-fade-up"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease, delay: 0.1 }}
                style={{ 
                  borderRadius: 0, 
                  border: '2px solid #16803d', 
                  background: '#ecfdf5', 
                  padding: '16px',
                  marginTop: '4px'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div style={{ width: 32, height: 32, borderRadius: 0, background: '#16803d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600 }}>✓</div>
                    <div className="flex flex-col">
                      <span className="font-pixel" style={{ fontSize: '12px', color: '#291d12' }}>
                        {merged ? 'MERGED INTO EXISTING QUEST' : 'QUEST DISPATCHED TO BOARD'}
                      </span>
                      {finalTicketId && (
                        <span className="font-mono text-muted text-xs" style={{ color: '#047857', fontSize: '9px' }}>Quest ID: {finalTicketId}</span>
                      )}
                    </div>
                  </div>
                  {finalScore != null && (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '1.75rem', fontWeight: 800, color: finalScore > 70 ? '#b91c1c' : '#b45309', fontFamily: 'var(--font-mono)' }}>
                        {Math.round(finalScore)}
                      </span>
                      <div className="font-pixel text-muted" style={{ fontSize: '7px', color: '#6b5139' }}>PRIORITY</div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3" style={{ marginTop: '14px' }}>
                  {finalTicketId && (
                    <button className="font-pixel" style={{ padding: '8px 14px', background: '#b45309', border: '1px solid #513a23', color: '#fff', cursor: 'pointer', fontSize: '9px' }} onClick={() => navigate(`/ticket/${finalTicketId}`)}>VIEW QUEST</button>
                  )}
                  <button className="font-pixel" style={{ padding: '8px 14px', background: '#fffbeb', border: '1px solid #85613c', color: '#b45309', cursor: 'pointer', fontSize: '9px' }} onClick={onClose}>REPORT ANOTHER</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default AgentReveal;
