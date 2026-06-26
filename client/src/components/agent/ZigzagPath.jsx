import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SentinelSprite from './SentinelSprite.jsx';

/**
 * Pipeline milestone definitions in walk order.
 * Each maps to a column (0 = left, 1 = right) and row (0, 1, 2).
 */
const MILESTONES = [
  {
    key: 'classify_issue',
    label: 'CLS',
    fullLabel: 'Classify',
    col: 0, row: 0,
    getSpeech: (out) => out
      ? `${out.category || '?'} · ${out.severity || '?'}${out.confidence != null ? ` (${Math.round(out.confidence * 100)}%)` : ''}`
      : 'Scanning report…',
  },
  {
    key: 'find_cluster',
    label: 'FND',
    fullLabel: 'Dedup',
    col: 1, row: 0,
    getSpeech: (out) => out?.found
      ? `Duplicate! ${out.cluster_size} reports merged`
      : out ? '✨ Unique — no duplicates' : 'Searching clusters…',
  },
  {
    key: 'geo_resolve',
    label: 'GEO',
    fullLabel: 'Locate',
    col: 0, row: 1,
    getSpeech: (out) => out?.ward
      ? `${out.ward}, Lucknow`
      : 'Pinpointing location…',
  },
  {
    key: 'compute_priority',
    label: 'PRI',
    fullLabel: 'Priority',
    col: 1, row: 1,
    getSpeech: (out) => out?.priority_score != null
      ? `Score: ${Math.round(out.priority_score)}/100`
      : 'Computing priority…',
  },
  {
    key: 'create_ticket',
    label: 'TKT',
    fullLabel: 'Create',
    col: 0, row: 2,
    alt: 'merge_into_ticket',
    getSpeech: (out, stepName) => {
      const id = out?.ticket_id;
      if (!id) return 'Creating ticket…';
      return stepName === 'merge_into_ticket' ? `Merged → ${id}` : `Created ${id}`;
    },
  },
  {
    key: 'notify_reporters',
    label: 'NOT',
    fullLabel: 'Notify',
    col: 1, row: 2,
    getSpeech: () => 'Notified ✓',
  },
];

const WALK_ORDER = MILESTONES.map(m => m.key);

function milestoneState(steps, key, alt) {
  const match = steps.find(s => s && (s.step === key || (alt && s.step === alt)));
  if (match?.status === 'error') return 'error';
  if (match?.status === 'success') return 'done';
  if (match?.status === 'pending') return 'active';
  return 'idle';
}

function stepOutput(steps, key, alt) {
  return steps.find(s => s && (s.step === key || (alt && s.step === alt)) && s.status === 'success')?.output || null;
}

function stepActualName(steps, key, alt) {
  return steps.find(s => s && (s.step === key || (alt && s.step === alt)))?.step || key;
}

/**
 * ZigzagPath — mascot walks a clean 2-col, 3-row grid.
 *
 * Layout:
 *   [CLS] ─────── [FND]
 *     │                │
 *   [GEO] ─────── [PRI]
 *     │                │
 *   [TKT] ─────── [NOT]
 *
 * The mascot is rendered inline next to the current active node
 * (on the opposite side from the connector), with a speech bubble above.
 */
function ZigzagPath({ steps, isComplete }) {
  // Current milestone index the mascot is at
  const currentIdx = useMemo(() => {
    for (let i = 0; i < WALK_ORDER.length; i++) {
      const m = MILESTONES[i];
      const state = milestoneState(steps, m.key, m.alt);
      if (state === 'active' || state === 'done') return i;
    }
    return -1; // not started
  }, [steps]);

  // The milestone to show a speech bubble for
  const speechMs = useMemo(() => {
    if (currentIdx < 0) return null;
    return MILESTONES[currentIdx];
  }, [currentIdx]);

  // Which connectors are filled (both source and target must be done)
  const filledConnectors = useMemo(() => {
    const set = new Set();
    for (let i = 0; i < WALK_ORDER.length - 1; i++) {
      const fromM = MILESTONES.find(ms => ms.key === WALK_ORDER[i]);
      const toM = MILESTONES.find(ms => ms.key === WALK_ORDER[i + 1]);
      const fromState = milestoneState(steps, fromM.key, fromM.alt);
      const toState = milestoneState(steps, toM.key, toM.alt);
      if (fromState === 'done' && (toState === 'done' || toState === 'active')) {
        set.add(i);
      }
    }
    return set;
  }, [steps]);

  return (
    <div className="zzp">
      {/* Grid of nodes + connectors */}
      <div className="zzp-grid">
        {MILESTONES.map((m, i) => {
          const state = milestoneState(steps, m.key, m.alt);
          const isCurrent = i === currentIdx;
          const filledRight = filledConnectors.has(i);
          const filledDown = i + 2 < MILESTONES.length
            && m.col === MILESTONES[i + 2]?.col
            && milestoneState(steps, m.key, m.alt) === 'done'
            && milestoneState(steps, MILESTONES[i + 2].key, MILESTONES[i + 2].alt) !== 'idle';

          return (
            <div key={m.key} className={`zzp-cell zzp-cell-${m.col === 0 ? 'left' : 'right'}`}>
              {/* Node */}
              <div className={`zzp-node zzp-node-${state} ${isCurrent ? 'zzp-node-current' : ''}`}>
                <span className="zzp-node-icon">{state === 'done' ? '✓' : m.label}</span>
                <span className={`zzp-node-label ${state === 'idle' ? 'text-muted' : ''}`}>{m.fullLabel}</span>
              </div>

              {/* Connector → right (horizontal) */}
              {m.col === 0 && i + 1 < MILESTONES.length && MILESTONES[i + 1].col === 1 && m.row === MILESTONES[i + 1].row && (
                <div className={`zzp-hline ${filledRight ? 'zzp-hline-done' : ''}`} />
              )}

              {/* Connector ↓ (vertical) */}
              {filledDown && (
                <div className="zzp-vline zzp-vline-done" />
              )}
            </div>
          );
        })}
      </div>

      {/* Mascot row — positioned below the grid at the current node's column */}
      <div className="zzp-mascot-row">
        <motion.div
          className="zzp-mascot-pos"
          animate={{
            gridColumn: currentIdx >= 0 ? (MILESTONES[currentIdx].col === 0 ? 1 : 3) : 1,
          }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        >
          <AnimatePresence mode="wait">
            {speechMs && (
              <motion.div
                key={speechMs.key}
                className="zzp-bubble"
                initial={{ opacity: 0, y: 6, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.9 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                {speechMs.getSpeech(
                  stepOutput(steps, speechMs.key, speechMs.alt),
                  stepActualName(steps, speechMs.key, speechMs.alt)
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <SentinelSprite
            scale={2}
            flip={currentIdx >= 0 ? MILESTONES[currentIdx].col === 1 : false}
            celebrating={isComplete}
          />
        </motion.div>
      </div>
    </div>
  );
}

export default ZigzagPath;
