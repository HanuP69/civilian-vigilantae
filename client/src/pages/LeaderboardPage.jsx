import { useState, useEffect } from 'react';
import { fetchLeaderboard } from '../services/api';
import { motion } from 'framer-motion';

function LeaderboardPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard()
      .then(data => setUsers(Array.isArray(data) ? data : data.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="skeleton" style={{ height: 32, width: 200 }} />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton pixel-border" style={{ height: 72 }} />
        ))}
      </div>
    );
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemAnim = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }} className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2>Top Reporters</h2>
        <span className="font-pixel text-xs" style={{ color: 'var(--accent)' }}>XP Leaderboard</span>
      </div>

      <motion.div 
        className="flex flex-col gap-4"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {users.map((user, i) => {
          const rank = user.rank || i + 1;
          const maxXP = users[0]?.xp || 1;
          const name = user.name || user.username || user.display_name || `User ${user.id}`;
          
          let rankColor = 'var(--ink-secondary)';
          if (rank === 1) rankColor = '#FFD700';
          if (rank === 2) rankColor = '#C0C0C0';
          if (rank === 3) rankColor = '#CD7F32';

          return (
            <motion.div 
              key={user.id || user.uid || i} 
              variants={itemAnim}
              className="card pixel-border flex items-center gap-4"
              style={{ 
                padding: 'var(--space-3) var(--space-4)',
                background: rank <= 3 ? 'var(--bg-elevated)' : 'var(--bg-secondary)',
                borderColor: rank <= 3 ? rankColor : 'var(--border)'
              }}
            >
              <div 
                className="font-pixel" 
                style={{ 
                  fontSize: '1.25rem', 
                  color: rankColor,
                  width: '40px',
                  textAlign: 'center'
                }}
              >
                {rank}
              </div>

              <img 
                src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(name)}`} 
                alt={name}
                className="pixel-avatar"
                style={{ width: 48, height: 48, backgroundColor: 'var(--bg-surface)' }}
              />

              <div className="flex flex-col flex-1 gap-1">
                <span className="font-medium" style={{ color: 'var(--ink-primary)', fontSize: '1.1rem' }}>
                  {name}
                </span>
                <div className="flex items-center gap-3">
                  <div className="xp-bar" style={{ flex: 1, maxWidth: 200, height: 8, borderRadius: 0, border: '1px solid var(--border)' }}>
                    <div
                      className="xp-bar-fill"
                      style={{ 
                        width: `${((user.xp || 0) / maxXP) * 100}%`,
                        borderRadius: 0,
                        background: rank <= 3 ? rankColor : 'var(--accent)'
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted">
                    {user.reports_submitted ?? user.reports_count ?? user.total_reports ?? 0} Reports
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="font-pixel" style={{ color: 'var(--accent)', fontSize: '1rem' }}>
                  {user.xp ?? 0} XP
                </span>
                <div className="flex gap-1">
                  {(user.badges || []).map((badge, bi) => (
                    <span key={bi} title={badge.name || badge} style={{ fontSize: '0.875rem' }}>
                      {badge.emoji || badge.icon || '🏅'}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}

        {users.length === 0 && (
          <div className="card pixel-border" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <span className="font-pixel text-muted text-sm">NO DATA DETECTED</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default LeaderboardPage;
