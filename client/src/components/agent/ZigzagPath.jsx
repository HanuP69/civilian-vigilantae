import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SentinelSprite from './SentinelSprite.jsx';

const ClassifyNodeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#291d12" strokeWidth="2" strokeLinecap="square">
    <rect x="3" y="3" width="11" height="11" fill="rgba(180, 83, 9, 0.15)" stroke="#b45309" strokeWidth="2.5" />
    <circle cx="8.5" cy="8.5" r="1.5" fill="#b45309" />
    <circle cx="16" cy="16" r="4.5" fill="rgba(2, 132, 199, 0.15)" stroke="#0284c7" strokeWidth="2.5" />
    <line x1="19.5" y1="19.5" x2="22.5" y2="22.5" stroke="#0284c7" strokeWidth="3.5" />
  </svg>
);

const DedupNodeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#291d12" strokeWidth="2" strokeLinecap="square">
    <rect x="3" y="8" width="10" height="12" fill="rgba(185, 28, 28, 0.15)" stroke="#b91c1c" strokeWidth="2" />
    <rect x="9" y="4" width="10" height="12" fill="rgba(217, 119, 6, 0.2)" stroke="#d97706" strokeWidth="2" />
    <path d="M13 10h2v2h-2z" fill="#0284c7" />
    <line x1="6" y1="12" x2="10" y2="12" stroke="#b91c1c" strokeWidth="1.5" />
    <line x1="12" y1="8" x2="16" y2="8" stroke="#d97706" strokeWidth="1.5" />
  </svg>
);

const EarthNodeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#291d12" strokeWidth="2" strokeLinecap="square">
    <circle cx="12" cy="12" r="9.5" fill="rgba(2, 132, 199, 0.2)" stroke="#0284c7" strokeWidth="2" />
    <path d="M7 10c0-1.5 1-2 2-1.5s2 .5 1.5 2-1 2.5-2.5 1.5S7 11.5 7 10z" fill="#16a34a" />
    <path d="M13 14c0-1 1-1.5 2-1s1.5 .5 1 2-1 1.5-2 1-1-1-1-1z" fill="#16a34a" />
    <path d="M15 8c0-.8.8-1.2 1.5-.8s1 .4.8 1.2-.8.8-1.5.8-1-.4-1-.8z" fill="#16a34a" />
  </svg>
);

const PriorityNodeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#291d12" strokeWidth="2" strokeLinecap="square">
    <path d="M12 2l10 18H2L12 2z" fill="rgba(185, 28, 28, 0.15)" stroke="#b91c1c" strokeWidth="2.5" />
    <line x1="12" y1="8" x2="12" y2="14" stroke="#d97706" strokeWidth="3" />
    <circle cx="12" cy="17.5" r="1.5" fill="#d97706" stroke="#d97706" />
  </svg>
);

const TicketNodeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#291d12" strokeWidth="2" strokeLinecap="square">
    <rect x="3" y="6" width="18" height="12" rx="1.5" fill="rgba(217, 119, 6, 0.15)" stroke="#d97706" strokeWidth="2.5" />
    <path d="M3 10.5a1.5 1.5 0 0 1 0 3M21 10.5a1.5 1.5 0 0 0 0 3" stroke="#b91c1c" strokeWidth="2.5" fill="#b91c1c" />
    <line x1="8" y1="10" x2="16" y2="10" stroke="#d97706" strokeWidth="1.5" />
    <line x1="8" y1="14" x2="16" y2="14" stroke="#d97706" strokeWidth="1.5" />
  </svg>
);

const NotifyNodeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#291d12" strokeWidth="2" strokeLinecap="square">
    <path d="M12 17v4M9 21h6M6 13l6-9 6 9" stroke="#16a34a" strokeWidth="2.5" />
    <circle cx="12" cy="4" r="2" fill="#16a34a" stroke="#16a34a" />
    <path d="M8 7.5a5.5 5.5 0 0 1 8 0M5 4.5a9.5 9.5 0 0 1 14 0" stroke="#0284c7" strokeWidth="2" opacity="0.8" />
  </svg>
);

/**
 * Pipeline milestone definitions in walk order.
 */
const MILESTONES = [
  {
    key: 'classify_issue',
    icon: <ClassifyNodeIcon />,
    label: 'CLS',
    fullLabel: 'Classify',
    getSpeech: (out) => out
      ? `Consensus: ${out.category || '?'} · ${out.severity || '?'}${out.confidence != null ? ` (${Math.round(out.confidence * 100)}%)` : ''}`
      : 'Scanning report for categories…',
  },
  {
    key: 'find_cluster',
    icon: <DedupNodeIcon />,
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
    icon: <EarthNodeIcon />,
    label: 'GEO',
    fullLabel: 'Locate',
    getSpeech: (out) => out?.ward
      ? `Located in Ward: ${out.ward}`
      : 'Resolving geolocation telemetry…',
  },
  {
    key: 'compute_priority',
    icon: <PriorityNodeIcon />,
    label: 'PRI',
    fullLabel: 'Priority',
    getSpeech: (out) => out?.priority_score != null
      ? `Threat priority computed: ${Math.round(out.priority_score)}/100`
      : 'Calculating SLA threat index…',
  },
  {
    key: 'create_ticket',
    icon: <TicketNodeIcon />,
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
    icon: <NotifyNodeIcon />,
    label: 'NOT',
    fullLabel: 'Notify',
    getSpeech: () => 'SLA alerts dispatched to Guild Wards ✓',
  },
];

const WALK_ORDER = MILESTONES.map(m => m.key);

const NODE_COORDS = [
  { x: 520, y: 65 },  // CLS (Classify)
  { x: 300, y: 65 },  // FND (Dedup)
  { x: 80, y: 65 },   // GEO (Locate)
  { x: 80, y: 205 },  // PRI (Priority)
  { x: 300, y: 205 }, // TKT (Create)
  { x: 520, y: 205 }, // NOT (Notify)
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

  useEffect(() => {
    if (visualIdx < targetIdx) {
      const timer = setTimeout(() => {
        setVisualIdx(prev => prev + 1);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [visualIdx, targetIdx]);

  useEffect(() => {
    if (targetIdx < visualIdx) {
      setVisualIdx(targetIdx);
    }
  }, [targetIdx]);

  const currentIdx = Math.max(0, Math.min(visualIdx, NODE_COORDS.length - 1));
  const activeCoord = NODE_COORDS[currentIdx] || NODE_COORDS[0];
  const speechMs = MILESTONES[currentIdx] || MILESTONES[0];

  const activePathD = useMemo(() => {
    if (currentIdx <= 0) return '';
    const points = NODE_COORDS.slice(0, currentIdx + 1);
    return 'M ' + points.map(p => `${p.x} ${p.y}`).join(' L ');
  }, [currentIdx]);

  return (
    <div className="zigzag-path-wrapper" style={{
      width: '100%',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '270px'
    }}>
      <div 
        className="zigzag-path-container"
        style={{
          width: '600px',
          height: '270px',
          position: 'relative',
          background: '#f3e5c8', // premium parchment tan map backing
          border: '3px solid #85613c', // brown leather/wood border
          outline: '2.5px solid #d8a96d', // gold inlay
          outlineOffset: '-5px',
          boxShadow: 'inset 0 0 12px rgba(133, 97, 60, 0.3), 0 4px 12px rgba(0,0,0,0.15)',
          flexShrink: 0
        }}
      >
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <g opacity="0.15" strokeWidth="0">
            <circle cx="300" cy="135" r="30" fill="none" stroke="#85613c" strokeWidth="1.5" />
            <line x1="300" y1="95" x2="300" y2="175" stroke="#85613c" strokeWidth="1.5" />
            <line x1="260" y1="135" x2="340" y2="135" stroke="#85613c" strokeWidth="1.5" />
          </g>

        <path
          d="M 520 65 L 300 65 L 80 65 L 80 205 L 300 205 L 520 205"
          fill="none"
          stroke="#ebdcb9" // light lane background
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 520 65 L 300 65 L 80 65 L 80 205 L 300 205 L 520 205"
          fill="none"
          stroke="#a17c55" // brown dashed track
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="4 4"
        />

        {activePathD && (
          <path
            d={activePathD}
            fill="none"
            stroke="#b45309"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.8"
          />
        )}

        {MILESTONES.map((m, idx) => {
          const coord = NODE_COORDS[idx];
          const state = milestoneState(steps, m.key, m.alt);
          const isActive = idx === currentIdx;

          let nodeFill = '#fcf8ee'; // parchment ivory base
          let nodeStroke = '#85613c';

          if (state === 'done') {
            nodeFill = '#ecfdf5'; // light emerald success
            nodeStroke = '#10b981';
          } else if (state === 'active') {
            nodeFill = '#fffbeb';
            nodeStroke = '#b45309';
          } else if (state === 'error') {
            nodeFill = '#fef2f2';
            nodeStroke = '#ef4444';
          }

          return (
            <g key={m.key}>
              <rect
                x={coord.x - 28}
                y={coord.y - 28}
                width="56"
                height="56"
                fill={nodeFill}
                stroke={nodeStroke}
                strokeWidth={isActive ? '3.5' : '2'}
                style={{
                  filter: isActive ? 'drop-shadow(0px 0px 6px rgba(180, 83, 9, 0.6))' : 'none',
                  transition: 'all 0.3s ease'
                }}
              />
              <text
                x={coord.x}
                y={coord.y + 44}
                textAnchor="middle"
                fill={state === 'idle' ? '#a17c55' : '#291d12'}
                style={{
                  fontFamily: 'var(--font-pixel)',
                  fontSize: '8px',
                  fontWeight: state === 'active' ? 'bold' : 'normal',
                }}
              >
                {m.fullLabel.toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>

      {MILESTONES.map((m, idx) => {
        const coord = NODE_COORDS[idx];
        const state = milestoneState(steps, m.key, m.alt);
        const isActive = idx === currentIdx;

        // Keep icons colored/bright to see them clearly
        const opacity = state === 'idle' ? '0.45' : '1';

        return (
          <div
            key={m.key}
            style={{
              position: 'absolute',
              left: `${coord.x - 16}px`,
              top: `${coord.y - 16}px`,
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 5,
              pointerEvents: 'none',
              transition: 'all 0.3s ease',
              opacity: opacity,
              transform: isActive ? 'scale(1.25)' : 'scale(1)'
            }}
          >
            {m.icon}
          </div>
        );
      })}

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
          x: activeCoord.x - 12,
          y: activeCoord.y - 20
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
          scale={2.5} // Enlarged cat mascot
          flip={currentIdx >= 1 && currentIdx <= 2} // Face left on top row (right→left: CLS→FND→GEO), face right on bottom row (left→right: PRI→TKT→NOT)
          celebrating={isComplete}
        />
      </motion.div>
    </div>
  </div>
  );
}

export default ZigzagPath;