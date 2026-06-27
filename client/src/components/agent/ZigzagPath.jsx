import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SentinelSprite from './SentinelSprite.jsx';

/**
 * Pipeline milestone definitions in walk order.
 */
const MILESTONES = [
  {
    key: 'classify_issue',
    label: 'CLS',
    fullLabel: 'Classify',
    getSpeech: (out) => out
      ? `Consensus: ${out.category || '?'} · ${out.severity || '?'}${out.confidence != null ? ` (${Math.round(out.confidence * 100)}%)` : ''}`
      : 'Scanning report for categories…',
  },
  {
    key: 'find_cluster',
    label: 'FND',
    fullLabel: 'Dedup',
    getSpeech: (out) => {
      if (!out) return 'Searching databases for duplicates…';
      return out.found
        ? `Duplicate detected! Merging ${out.cluster_size} reports.`
        : '✨ Unique report. No duplicates found.';
    },
  },
  {
    key: 'geo_resolve',
    label: 'GEO',
    fullLabel: 'Locate',
    getSpeech: (out) => out?.ward
      ? `Located in Ward: ${out.ward}`
      : 'Resolving geolocation telemetry…',
  },
  {
    key: 'compute_priority',
    label: 'PRI',
    fullLabel: 'Priority',
    getSpeech: (out) => out?.priority_score != null
      ? `Threat priority computed: ${Math.round(out.priority_score)}/100`
      : 'Calculating SLA threat index…',
  },
  {
    key: 'create_ticket',
    label: 'TKT',
    fullLabel: 'Create',
    alt: 'merge_into_ticket',
    getSpeech: (out, stepName) => {
      const id = out?.ticket_id;
      if (!id) return 'Generating registry ticket…';
      return stepName === 'merge_into_ticket' ? `Merged into Ticket: ${id}` : `Created Ticket: ${id}`;
    },
  },
  {
    key: 'notify_reporters',
    label: 'NOT',
    fullLabel: 'Notify',
    getSpeech: () => 'SLA alerts dispatched to Guild Wards ✓',
  },
];

const WALK_ORDER = MILESTONES.map(m => m.key);

const NODE_COORDS = [
  { x: 450, y: 55 },  // CLS (Classify)
  { x: 260, y: 55 },  // FND (Dedup)
  { x: 70, y: 55 },   // GEO (Locate)
  { x: 70, y: 165 },  // PRI (Priority)
  { x: 260, y: 165 }, // TKT (Create)
  { x: 450, y: 165 }, // NOT (Notify)
];

function milestoneState(steps = [], key, alt) {
  if (!Array.isArray(steps)) return 'idle';
  const match = steps.find(s => s && (s.step === key || (alt && s.step === alt)));
  if (match?.status === 'error') return 'error';
  if (match?.status === 'success') return 'done';
  if (match?.status === 'pending') return 'active';
  return 'idle';
}

function stepOutput(steps = [], key, alt) {
  if (!Array.isArray(steps)) return null;
  return steps.find(s => s && (s.step === key || (alt && s.step === alt)) && s.status === 'success')?.output || null;
}

function stepActualName(steps = [], key, alt) {
  if (!Array.isArray(steps)) return key;
  return steps.find(s => s && (s.step === key || (alt && s.step === alt)))?.step || key;
}

function ZigzagPath({ steps = [], isComplete }) {
  const [visualIdx, setVisualIdx] = useState(0);

  // Find target step index based on actual database updates
  const targetIdx = useMemo(() => {
    let lastDone = -1;
    for (let i = 0; i < WALK_ORDER.length; i++) {
      const m = MILESTONES[i];
      const state = milestoneState(steps, m.key, m.alt);
      if (state === 'active') return i;
      if (state === 'done') lastDone = i;
    }
    return lastDone >= 0 ? lastDone : 0;
  }, [steps]);

  // Pace the visual walk index behind targetIdx by 2000ms per step
  useEffect(() => {
    if (visualIdx < targetIdx) {
      const timer = setTimeout(() => {
        setVisualIdx(prev => prev + 1);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [visualIdx, targetIdx]);

  // Reset visual index if target index falls (new report intakes)
  useEffect(() => {
    if (targetIdx < visualIdx) {
      setVisualIdx(targetIdx);
    }
  }, [targetIdx]);

  const currentIdx = Math.max(0, Math.min(visualIdx, NODE_COORDS.length - 1));
  const activeCoord = NODE_COORDS[currentIdx] || NODE_COORDS[0];
  const speechMs = MILESTONES[currentIdx] || MILESTONES[0];

  // Compute SVG active path up to current visual index
  const activePathD = useMemo(() => {
    if (currentIdx <= 0) return '';
    const points = NODE_COORDS.slice(0, currentIdx + 1);
    return 'M ' + points.map(p => `${p.x} ${p.y}`).join(' L ');
  }, [currentIdx]);

  return (
    <div style={{
      width: '100%',
      maxWidth: '520px',
      height: '240px',
      margin: '0 auto var(--space-6) auto',
      position: 'relative',
      background: 'rgba(0, 0, 0, 0.25)',
      border: '2px solid var(--border)',
      boxShadow: 'inset 2px 2px 8px rgba(0,0,0,0.5)',
      overflow: 'hidden'
    }}>
      {/* Maze Grid lines in background */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <defs>
          <pattern id="maze-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#maze-grid)" />

        {/* Inactive connection path (gray track) */}
        <path
          d="M 450 55 L 260 55 L 70 55 L 70 165 L 260 165 L 450 165"
          fill="none"
          stroke="oklch(0.2 0.01 260)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Active connection path (glowing blue-gold energy pipe) */}
        {activePathD && (
          <>
            <path
              d={activePathD}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.35"
              style={{ filter: 'blur(4px)' }}
            />
            <path
              d={activePathD}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {/* Nodes */}
        {MILESTONES.map((m, idx) => {
          const coord = NODE_COORDS[idx];
          const state = milestoneState(steps, m.key, m.alt);
          const isActive = idx === currentIdx;

          let nodeFill = 'oklch(0.18 0.01 260)';
          let nodeStroke = 'var(--border)';
          let textColor = 'var(--ink-muted)';

          if (state === 'done') {
            nodeFill = 'oklch(0.25 0.05 155 / 0.8)';
            nodeStroke = 'var(--success)';
            textColor = 'var(--success)';
          } else if (state === 'active') {
            nodeFill = 'oklch(0.32 0.05 85 / 0.8)';
            nodeStroke = 'var(--accent)';
            textColor = 'var(--accent)';
          } else if (state === 'error') {
            nodeFill = 'oklch(0.25 0.05 25 / 0.8)';
            nodeStroke = 'var(--error)';
            textColor = 'var(--error)';
          }

          return (
            <g key={m.key}>
              {/* Outer square box */}
              <rect
                x={coord.x - 24}
                y={coord.y - 24}
                width="48"
                height="48"
                fill={nodeFill}
                stroke={nodeStroke}
                strokeWidth={isActive ? '3' : '2'}
                style={{
                  filter: isActive ? 'drop-shadow(0px 0px 6px var(--accent))' : 'none',
                  transition: 'all 0.3s ease'
                }}
              />

              {/* Node Icon / Check */}
              <text
                x={coord.x}
                y={coord.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={textColor}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}
              >
                {state === 'done' ? '✓' : m.label}
              </text>

              {/* Sub-label under the node */}
              <text
                x={coord.x}
                y={coord.y + 36}
                textAnchor="middle"
                fill={state === 'idle' ? 'var(--ink-muted)' : 'var(--ink-secondary)'}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  fontWeight: state === 'active' ? 'bold' : 'normal'
                }}
              >
                {m.fullLabel}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Mascot sprite with speech bubble */}
      <motion.div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none'
        }}
        animate={{
          x: activeCoord.x - 32,
          y: activeCoord.y - 4
        }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      >
        <AnimatePresence mode="wait">
          {speechMs && (
            <motion.div
              key={speechMs.key}
              className="rpg-dialog-bubble"
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {speechMs.getSpeech(
                stepOutput(steps, speechMs.key, speechMs.alt),
                stepActualName(steps, speechMs.key, speechMs.alt)
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <SentinelSprite
          scale={1.5}
          flip={currentIdx < 3} // Face left when walking on the top row (right-to-left)
          celebrating={isComplete}
        />
      </motion.div>
    </div>
  );
}

export default ZigzagPath;
