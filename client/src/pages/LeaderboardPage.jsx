import { useState, useEffect } from 'react';
import { fetchLeaderboard } from '../services/api';
import { useToast } from '../hooks/useToast.jsx';
import { motion } from 'framer-motion';

const BADGE_DISPLAY = {
  'Neighborhood Watch': { emoji: '🛡️', name: 'Neighborhood Watch' },
  'Verified Reporter': { emoji: '✅', name: 'Verified Reporter' },
  'Eagle Eye': { emoji: '🔍', name: 'Eagle Eye' },
  'Community Champion': { emoji: '🏆', name: 'Community Champion' },
  'Ward Guardian': { emoji: '⭐', name: 'Ward Guardian' },
};

const getBadgeDisplay = (badge) => {
  if (typeof badge === 'object' && badge !== null) {
    return { emoji: badge.emoji || badge.icon || '🏅', name: badge.name || 'Badge' };
  }
  return BADGE_DISPLAY[badge] || { emoji: '🏅', name: badge };
};

const Avatar = ({ seed, name }) => {
  const [error, setError] = useState(false);
  if (error) {
    const initial = (name || '?').charAt(0).toUpperCase();
    return (
      <div
        className="pixel-avatar flex items-center justify-center"
        style={{ width: 48, height: 48, background: 'var(--bg-surface)', color: 'var(--accent)', fontWeight: 600, fontSize: '1.25rem' }}
      >
        {initial}
      </div>
    );
  }
  return (
    <img
      src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(seed || name)}`}
      alt={name}
      loading="lazy"
      onError={() => setError(true)}
      className="pixel-avatar"
      style={{ width: 48, height: 48, backgroundColor: 'var(--bg-surface)' }}
    />
  );
};

function LeaderboardPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchLeaderboard()
      .then(data => {
        setUsers(Array.isArray(data) ? data : data.leaderboard || data.users || []);
      })
      .catch(() => {
        setUsers([]);
        toast('Failed to load leaderboard', 'error');
      })
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading leaderboard">
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
          const name = user.name || user.username || user.display_name || `User ${user.id || user.uid || i + 1}`;
          const badges = user.badges || [];

          let rankColor = 'var(--ink-secondary)';
          if (rank === 1) rankColor = 'var(--rank-gold)';
          if (rank === 2) rankColor = 'var(--rank-silver)';
          if (rank === 3) rankColor = 'var(--rank-bronze)';

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
                  minWidth: '40px',
                  textAlign: 'center'
                }}
              >
                {rank}
              </div>

              <Avatar seed={name} name={name} />

              <div className="flex flex-col flex-1 gap-1" style={{ minWidth: 0 }}>
                <span className="font-medium truncate" style={{ color: 'var(--ink-primary)', fontSize: '1.1rem' }}>
                  {name}
                </span>
                <div className="flex items-center gap-3">
                  <div className="xp-bar" style={{ flex: 1, maxWidth: 200 }}>
                    <div
                      className="xp-bar-fill"
                      style={{
                        width: `${Math.min(((user.xp || 0) / maxXP) * 100, 100)}%`,
                        background: rank <= 3 ? rankColor : 'var(--accent)'
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>
                    {user.reports ?? user.reports_submitted ?? 0} Reports
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="font-pixel" style={{ color: 'var(--accent)', fontSize: '1rem' }}>
                  {user.xp ?? 0} XP
                </span>
                {badges.length > 0 && (
                  <div className="flex gap-1" style={{ fontSize: '0.875rem' }}>
                    {badges.slice(0, 5).map((badge, bi) => {
                      const display = getBadgeDisplay(badge);
                      return (
                        <span key={bi} title={display.name} role="img" aria-label={display.name}>
                          {display.emoji}
                        </span>
                      );
                    })}
                  </div>
                )}
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
