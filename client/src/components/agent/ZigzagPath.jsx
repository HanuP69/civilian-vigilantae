import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SentinelSprite from './SentinelSprite.jsx';

const ClassifyNodeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
    <rect x="3" y="3" width="11" height="11" fill="rgba(255, 193, 7, 0.2)" stroke="#ffc107" strokeWidth="2.5" />
    <circle cx="8.5" cy="8.5" r="1.5" fill="#ffc107" />
    <circle cx="16" cy="16" r="4.5" fill="rgba(0, 229, 255, 0.15)" stroke="#00e5ff" strokeWidth="2.5" />
    <line x1="19.5" y1="19.5" x2="22.5" y2="22.5" stroke="#00e5ff" strokeWidth="3.5" />
  </svg>
);

const DedupNodeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
    <rect x="3" y="8" width="10" height="12" fill="rgba(255, 23, 68, 0.15)" stroke="#ff1744" strokeWidth="2" />
    <rect x="9" y="4" width="10" height="12" fill="rgba(255, 145, 0, 0.2)" stroke="#ff9100" strokeWidth="2" />
    <path d="M13 10h2v2h-2z" fill="#00e5ff" />
    <line x1="6" y1="12" x2="10" y2="12" stroke="#ff1744" strokeWidth="1.5" />
    <line x1="12" y1="8" x2="16" y2="8" stroke="#ff9100" strokeWidth="1.5" />
  </svg>
);

const EarthNodeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
    <circle cx="12" cy="12" r="9.5" fill="#2979ff" stroke="#2979ff" strokeWidth="1" />
    <path d="M7 10c0-1.5 1-2 2-1.5s2 .5 1.5 2-1 2.5-2.5 1.5S7 11.5 7 10z" fill="#00e676" />
    <path d="M13 14c0-1 1-1.5 2-1s1.5 .5 1 2-1 1.5-2 1-1-1-1-1z" fill="#00e676" />
    <path d="M15 8c0-.8.8-1.2 1.5-.8s1 .4.8 1.2-.8.8-1.5.8-1-.4-1-.8z" fill="#00e676" />
    <circle cx="12" cy="12" r="9.5" stroke="#ffffff" strokeWidth="2" />
  </svg>
);

const PriorityNodeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
    <path d="M12 2l10 18H2L12 2z" fill="rgba(255, 23, 68, 0.15)" stroke="#ff1744" strokeWidth="2.5" />
    <line x1="12" y1="8" x2="12" y2="14" stroke="#ffea00" strokeWidth="3" />
    <circle cx="12" cy="17.5" r="1.5" fill="#ffea00" stroke="#ffea00" />
  </svg>
);

const TicketNodeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
    <rect x="3" y="6" width="18" height="12" rx="1.5" fill="rgba(255, 215, 0, 0.15)" stroke="#ffd700" strokeWidth="2.5" />
    <path d="M3 10.5a1.5 1.5 0 0 1 0 3M21 10.5a1.5 1.5 0 0 0 0 3" stroke="#d500f9" strokeWidth="2.5" fill="#d500f9" />
    <line x1="8" y1="10" x2="16" y2="10" stroke="#ffd700" strokeWidth="1.5" />
    <line x1="8" y1="14" x2="16" y2="14" stroke="#ffd700" strokeWidth="1.5" />
  </svg>
);

const NotifyNodeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
    <path d="M12 17v4M9 21h6M6 13l6-9 6 9" stroke="#ffffff" strokeWidth="2.5" />
    <circle cx="12" cy="4" r="2" fill="#00e676" stroke="#00e676" />
    <path d="M8 7.5a5.5 5.5 0 0 1 8 0M5 4.5a9.5 9.5 0 0 1 14 0" stroke="#00e5ff" strokeWidth="2" opacity="0.8" />
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
      width: '600px',
      height: '300px',
      margin: '0 auto var(--space-6) auto',
      position: 'relative',
      background: 'linear-gradient(180deg, #4d822b 0%, #3e6d20 100%)', // grass green pasture
      border: '4px solid #284414', // dark forest green border
      boxShadow: 'inset 0 4px 0 rgba(255,255,255,0.15), 0 8px 0 rgba(0,0,0,0.5), inset 2px 2px 10px rgba(0,0,0,0.4)'
    }}>
      {/* Maze Grid lines & paths in background */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {/* Decorative Grass & Flower clusters */}
        <g opacity="0.4" strokeWidth="0">
          {/* Yellow/White Flowers */}
          <rect x="130" y="110" width="4" height="4" fill="#fff" />
          <rect x="134" y="114" width="4" height="4" fill="#ffd54f" />
          <rect x="370" y="130" width="4" height="4" fill="#fff" />
          <rect x="366" y="134" width="4" height="4" fill="#ffd54f" />
          {/* Grass details */}
          <line x1="180" y1="110" x2="182" y2="102" stroke="#223a11" strokeWidth="2" />
          <line x1="184" y1="110" x2="188" y2="104" stroke="#223a11" strokeWidth="2" />
          <line x1="290" y1="150" x2="292" y2="142" stroke="#223a11" strokeWidth="2" />
          <line x1="294" y1="150" x2="298" y2="144" stroke="#223a11" strokeWidth="2" />
          <line x1="80" y1="160" x2="82" y2="152" stroke="#223a11" strokeWidth="2" />
          <line x1="84" y1="160" x2="88" y2="154" stroke="#223a11" strokeWidth="2" />
        </g>

        {/* Inactive connection path (gray/dirt track) */}
        <path
          d="M 520 65 L 300 65 L 80 65 L 80 205 L 300 205 L 520 205"
          fill="none"
          stroke="#251a0e" // dark dirt border
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 520 65 L 300 65 L 80 65 L 80 205 L 300 205 L 520 205"
          fill="none"
          stroke="#684e2a" // lighter dirt core
          strokeWidth="10"
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
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.3"
              style={{ filter: 'blur(3px)' }}
            />
            <path
              d={activePathD}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="5"
              strokeDasharray="8 8" // stepping stone effect
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

          if (state === 'done') {
            nodeFill = 'rgba(28, 59, 28, 0.9)';
            nodeStroke = 'var(--success)';
          } else if (state === 'active') {
            nodeFill = 'rgba(61, 51, 24, 0.9)';
            nodeStroke = 'var(--accent)';
          } else if (state === 'error') {
            nodeFill = 'rgba(59, 28, 28, 0.9)';
            nodeStroke = 'var(--error)';
          }

          return (
            <g key={m.key}>
              {/* Outer square box - Enlarged to 64x64 */}
              <rect
                x={coord.x - 32}
                y={coord.y - 32}
                width="64"
                height="64"
                rx="8" // rounded pixel corners
                fill={nodeFill}
                stroke={nodeStroke}
                strokeWidth={isActive ? '3.5' : '2'}
                style={{
                  filter: isActive ? 'drop-shadow(0px 0px 8px var(--accent))' : 'none',
                  transition: 'all 0.3s ease'
                }}
              />

              {/* Sub-label under the node */}
              <text
                x={coord.x}
                y={coord.y + 46}
                textAnchor="middle"
                fill={state === 'idle' ? 'rgba(255,255,255,0.45)' : '#fff'}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
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

      {/* Dynamic SVG Node Icons Overlay - Enlarged and colored */}
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
          scale={2.0} // Enlarged robot mascot
          flip={currentIdx >= 3} // Face left when walking on the bottom row (right-to-left)
          celebrating={isComplete}
        />
      </motion.div>
    </div>
  );
}

export default ZigzagPath;
