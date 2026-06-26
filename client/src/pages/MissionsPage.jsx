import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const containerAnim = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemAnim = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

function MissionsPage() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/missions')
      .then(res => res.json())
      .then(data => {
        setMissions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load missions:', err);
        setLoading(false);
      });
  }, []);

  const handleDepart = (mission) => {
    // Navigate back to map with the specific coordinates and category filters
    navigate(`/?category=${mission.category || ''}&ward=${mission.ward || ''}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading missions" style={{ maxWidth: 800, margin: '0 auto' }}>
        <h2 className="font-pixel" style={{ fontSize: '0.9rem', color: 'var(--accent)' }}>🧭 Guild Investigations Board</h2>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 140, borderRadius: 0 }} />
        ))}
      </div>
    );
  }

  return (
    <motion.div 
      className="flex flex-col gap-6" 
      style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 'var(--space-10)' }}
      variants={containerAnim}
      initial="hidden"
      animate="show"
    >
      <div className="flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-4)' }}>
        <div>
          <h2 className="font-pixel" style={{ fontSize: '0.9rem', color: 'var(--accent)' }}>🧭 Active Investigation Missions</h2>
          <span className="font-pixel text-muted" style={{ fontSize: '0.45rem', marginTop: '4px', display: 'block' }}>CITIZEN SENSORS DIRECTIVE · COLLECTIVE CONSENSUS</span>
        </div>
        <span className="font-pixel text-muted" style={{ fontSize: '0.45rem' }}>{missions.filter(m => m.status === 'active').length} SWEEPS ACTIVE</span>
      </div>

      {missions.length === 0 ? (
        <div className="card rpg-panel text-center" style={{ padding: 'var(--space-8)', borderRadius: 0 }}>
          <p className="font-pixel" style={{ fontSize: '0.65rem', color: 'var(--ink-muted)' }}>NO CAMPAIGN DIRECTIVES ACTIVE AT THIS TIME.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {missions.map((mission) => {
            const isCompleted = mission.status === 'completed';
            const progressRatio = Math.min((mission.current_confirmations / mission.target_confirmations) * 100, 100);
            
            return (
              <motion.div 
                key={mission.id}
                variants={itemAnim}
                className={`card rpg-panel ${isCompleted ? 'success' : ''}`}
                style={{ 
                  borderRadius: 0,
                  position: 'relative',
                  borderLeft: isCompleted ? '4px solid var(--success)' : '4px solid var(--accent)'
                }}
              >
                <div className="flex justify-between items-start" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-2)' }}>
                      <h3 className="font-pixel" style={{ fontSize: '0.65rem', margin: 0, color: isCompleted ? 'var(--success)' : 'var(--ink-primary)' }}>
                        {mission.title}
                      </h3>
                      <span className="badge font-pixel" style={{ 
                        fontSize: '0.35rem', 
                        background: mission.type === 'hotspot_prediction' ? 'oklch(0.25 0.06 85 / 0.3)' : 'oklch(0.25 0.05 260 / 0.3)',
                        color: mission.type === 'hotspot_prediction' ? 'var(--warning)' : 'var(--accent)',
                        borderRadius: 0,
                        border: '1px solid currentColor',
                        padding: '2px 4px'
                      }}>
                        {mission.type === 'hotspot_prediction' ? 'PREDICTED HOTSPOT' : 'UNVERIFIED REPORT'}
                      </span>
                    </div>
                    <p className="text-secondary text-xs" style={{ lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
                      {mission.description}
                    </p>

                    <div style={{ maxWidth: '400px' }}>
                      <div className="flex justify-between text-xs font-mono" style={{ marginBottom: '4px' }}>
                        <span className="text-muted">Confirmations:</span>
                        <span style={{ color: isCompleted ? 'var(--success)' : 'var(--accent)' }}>
                          {mission.current_confirmations} / {mission.target_confirmations}
                        </span>
                      </div>
                      <div className="priority-bar" style={{ height: '6px', borderRadius: 0 }}>
                        <div 
                          className="priority-bar-fill" 
                          style={{ 
                            width: `${progressRatio}%`,
                            background: isCompleted ? 'var(--success)' : 'var(--accent)',
                            borderRadius: 0
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3" style={{ minWidth: '160px' }}>
                    <div className="flex gap-2">
                      <div className="summary-card text-center" style={{ padding: '6px 12px', minWidth: '70px', borderRadius: 0 }}>
                        <div className="font-pixel" style={{ fontSize: '0.55rem', color: 'var(--success)' }}>+{mission.xp_reward}</div>
                        <div className="font-pixel text-muted" style={{ fontSize: '0.35rem', marginTop: '2px' }}>XP</div>
                      </div>
                      <div className="summary-card text-center" style={{ padding: '6px 12px', minWidth: '70px', borderRadius: 0 }}>
                        <div className="font-pixel" style={{ fontSize: '0.55rem', color: 'var(--accent)' }}>{mission.gold_reward}</div>
                        <div className="font-pixel text-muted" style={{ fontSize: '0.35rem', marginTop: '2px' }}>GOLD</div>
                      </div>
                    </div>

                    {isCompleted ? (
                      <div 
                        className="font-pixel text-success" 
                        style={{ 
                          fontSize: '0.55rem', 
                          border: '2px double var(--success)', 
                          padding: '6px 12px', 
                          background: 'oklch(0.65 0.16 155 / 0.08)',
                          letterSpacing: '1px'
                        }}
                      >
                        ✓ QUEST PURGED
                      </div>
                    ) : (
                      <button 
                        className="btn btn-primary font-pixel" 
                        style={{ 
                          borderRadius: 0, 
                          fontSize: '0.5rem',
                          padding: '8px 12px',
                          letterSpacing: '0.5px'
                        }}
                        onClick={() => handleDepart(mission)}
                      >
                        🧭 TRAVEL TO SECTOR
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

export default MissionsPage;
