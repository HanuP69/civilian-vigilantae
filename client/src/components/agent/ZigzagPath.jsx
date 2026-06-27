import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SentinelSprite from './SentinelSprite.jsx';

const ClassifyNodeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
    <rect x="3" y="3" width="10" height="10" stroke="currentColor" strokeWidth="2" />
    <line x1="8" y1="6" x2="12" y2="6" stroke="currentColor" />
    <line x1="8" y1="10" x2="11" y2="10" stroke="currentColor" />
    <circle cx="16" cy="16" r="4" stroke="currentColor" strokeWidth="2" />
    <line x1="19" y1="19" x2="22" y2="22" stroke="currentColor" strokeWidth="3" />
  </svg>
);

const DedupNodeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
    <rect x="3" y="7" width="10" height="12" stroke="currentColor" strokeWidth="2" />
    <rect x="9" y="4" width="10" height="12" stroke="currentColor" strokeWidth="2" fill="rgba(0,0,0,0.25)" />
    <path d="M6 10h4M6 14h4M12 7h4M12 11h4" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const EarthNodeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="9" fill="rgba(34, 197, 94, 0.15)" />
    <path d="M8 8c1 0 2 1 1 2s-2 1-1 3" stroke="currentColor" strokeWidth="2" />
    <path d="M14 10c2-1 3 1 2 2s-1 2-2 1" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const PriorityNodeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
    <path d="M12 3l9 16H3L12 3z" stroke="currentColor" strokeWidth="2" />
    <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="16.5" r="1.2" fill="currentColor" stroke="currentColor" />
  </svg>
);

const TicketNodeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
    <rect x="4" y="6" width="16" height="12" rx="1" stroke="currentColor" strokeWidth="2" />
    <path d="M4 11a2 2 0 0 1 0 2M20 11a2 2 0 0 0 0 2" stroke="currentColor" strokeWidth="2" />
    <line x1="9" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="1.5" />
    <line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="1.5" />
    <line x1="9" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const NotifyNodeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
    <path d="M12 18v3M10 21h4M7 14l5-9 5 9" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="currentColor" />
    <path d="M8 8a6 6 0 0 1 8 0M5 5a10 10 0 0 1 14 0" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
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
      background: 'linear-gradient(180deg, #4d822b 0%, #3e6d20 100%)', // grass green pasture
      border: '4px solid #284414', // dark forest green border
      boxShadow: 'inset 0 4px 0 rgba(255,255,255,0.15), 0 8px 0 rgba(0,0,0,0.5), inset 2px 2px 10px rgba(0,0,0,0.4)',
      overflow: 'hidden'
    }}>
      {/* Maze Grid lines & paths in background */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {/* Decorative Grass & Flower clusters */}
        <g opacity="0.4" strokeWidth="0">
          {/* Yellow/White Flowers */}
          <rect x="130" y="80" width="4" height="4" fill="#fff" />
          <rect x="134" y="84" width="4" height="4" fill="#ffd54f" />
          <rect x="370" y="110" width="4" height="4" fill="#fff" />
          <rect x="366" y="114" width="4" height="4" fill="#ffd54f" />
          {/* Grass details */}
          <line x1="180" y1="80" x2="182" y2="72" stroke="#223a11" strokeWidth="2" />
          <line x1="184" y1="80" x2="188" y2="74" stroke="#223a11" strokeWidth="2" />
          <line x1="290" y1="120" x2="292" y2="112" stroke="#223a11" strokeWidth="2" />
          <line x1="294" y1="120" x2="298" y2="114" stroke="#223a11" strokeWidth="2" />
          <line x1="80" y1="130" x2="82" y2="122" stroke="#223a11" strokeWidth="2" />
          <line x1="84" y1="130" x2="88" y2="124" stroke="#223a11" strokeWidth="2" />
        </g>

        {/* Inactive connection path (gray/dirt track) */}
        <path
          d="M 450 55 L 260 55 L 70 55 L 70 165 L 260 165 L 450 165"
          fill="none"
          stroke="#251a0e" // dark dirt border
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 450 55 L 260 55 L 70 55 L 70 165 L 260 165 L 450 165"
          fill="none"
          stroke="#684e2a" // lighter dirt core
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Active connection path (glowing gold stepping stones) */}
        {activePathD && (
          <>
            <path
              d={activePathD}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.3"
              style={{ filter: 'blur(3px)' }}
            />
            <path
              d={activePathD}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="4"
              strokeDasharray="6 6" // stepping stone effect
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

          let nodeFill = '#1c2217'; // dark biome glass
          let nodeStroke = '#3d5231';
          let textColor = 'var(--ink-muted)';

          if (state === 'done') {
            nodeFill = 'rgba(28, 59, 28, 0.9)';
            nodeStroke = 'var(--success)';
            textColor = 'var(--success)';
          } else if (state === 'active') {
            nodeFill = 'rgba(61, 51, 24, 0.9)';
            nodeStroke = 'var(--accent)';
            textColor = 'var(--accent)';
          } else if (state === 'error') {
            nodeFill = 'rgba(59, 28, 28, 0.9)';
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
                rx="6" // slightly rounded pixel corners
                fill={nodeFill}
                stroke={nodeStroke}
                strokeWidth={isActive ? '3' : '2'}
                style={{
                  filter: isActive ? 'drop-shadow(0px 0px 6px var(--accent))' : 'none',
                  transition: 'all 0.3s ease'
                }}
              />

              {/* Sub-label under the node */}
              <text
                x={coord.x}
                y={coord.y + 36}
                textAnchor="middle"
                fill={state === 'idle' ? 'rgba(255,255,255,0.4)' : '#fff'}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  fontWeight: state === 'active' ? 'bold' : 'normal',
                  filter: 'drop-shadow(1px 1px 0px rgba(0,0,0,0.8))'
                }}
              >
                {m.fullLabel}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Dynamic SVG Node Icons Overlay */}
      {MILESTONES.map((m, idx) => {
        const coord = NODE_COORDS[idx];
        const state = milestoneState(steps, m.key, m.alt);
        const isActive = idx === currentIdx;

        let iconColor = 'rgba(255, 255, 255, 0.4)'; // idle
        if (state === 'done') iconColor = 'var(--success)';
        else if (state === 'active') iconColor = 'var(--accent)';
        else if (state === 'error') iconColor = 'var(--error)';

        return (
          <div
            key={m.key}
            style={{
              position: 'absolute',
              left: `${coord.x - 12}px`,
              top: `${coord.y - 12}px`,
              width: '24px',
              height: '24px',
              color: iconColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 5,
              pointerEvents: 'none',
              transition: 'all 0.3s ease',
              transform: isActive ? 'scale(1.2)' : 'scale(1)'
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
