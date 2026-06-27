import { useState, useEffect } from 'react';
import { fetchLeaderboard } from '../services/api';
import { useToast } from '../hooks/useToast.jsx';
import { motion } from 'framer-motion';
import { CustomAvatar, parseCustomAvatar } from '../components/CustomAvatar';

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

const Avatar = ({ photoUrl, name }) => {
  const [error, setError] = useState(false);
  const avatarStyle = {
    width: 48,
    height: 48,
    borderRadius: 0,
    border: '2px solid var(--border)',
    background: 'var(--bg-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'var(--shadow-sm)',
    flexShrink: 0
  };

  if (photoUrl && photoUrl.startsWith('custom:')) {
    return (
      <div className="pixel-avatar" style={avatarStyle}>
        <CustomAvatar {...parseCustomAvatar(photoUrl)} size={40} />
      </div>
    );
  }

  if (error) {
    const initial = (name || '?').charAt(0).toUpperCase();
    return (
      <div style={{ ...avatarStyle, color: 'var(--accent)', fontWeight: 600, fontSize: '1.25rem' }}>
        {initial}
      </div>
    );
  }
  return (
    <img
      src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(photoUrl || name)}`}
      alt={name}
      loading="lazy"
      onError={() => setError(true)}
      style={avatarStyle}
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
          <div key={i} className="skeleton" style={{ height: 72, borderRadius: 'var(--radius-md)' }} />
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

  const getRankTitle = (rank) => {
    if (rank <= 3) return "City Champion 🏆";
    if (rank <= 10) return "Community Hero ⚡";
    if (rank <= 20) return "Guardian 🛡️";
    if (rank <= 50) return "Investigator 🔍";
    return "Scout 🧭";
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }} className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif">Hero League Rankings</h2>
        <span className="font-mono text-xs" style={{ color: 'var(--accent)', letterSpacing: '0.05em', fontWeight: 600 }}>Citizen contribution rankings</span>
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

          // Accuracy & Trust calculation with database schemas fallbacks
          const verifications = user.verifications_made !== undefined 
            ? user.verifications_made 
            : ((user.reports_verified || 0) + (user.reports_rejected || 0));

          const accurateVerifications = user.accurate_verifications !== undefined
            ? user.accurate_verifications
            : (user.reports_verified || 0);

          const accuracyRate = verifications > 0 
            ? Math.min(100, Math.round((accurateVerifications / verifications) * 100)) 
            : 100;
          
           const trustScore = Math.min(100, Math.max(50, Math.round(50 + (user.reports || user.reports_submitted || 0) * 3 + accurateVerifications * 2 - (verifications - accurateVerifications) * 4)));

          const contributionScore = user.contribution_score !== undefined
            ? user.contribution_score
            : Math.max(0, Math.round(
                ((user.xp || 0) * 0.1) +
                ((user.reports ?? user.reports_submitted ?? 0) * 15) +
                (accurateVerifications * 25) -
                (Math.max(0, verifications - accurateVerifications) * 10) +
                ((user.trust_score !== undefined ? user.trust_score : 0.5) * 100)
              ));

          return (
            <motion.div
              key={user.id || user.uid || i}
              variants={itemAnim}
              className="card rpg-panel flex items-center gap-4"
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 0
              }}
            >
              <div
                className="font-mono"
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: rankColor,
                  minWidth: '40px',
                  textAlign: 'center'
                }}
              >
                #{rank}
              </div>

              <Avatar photoUrl={user.photo_url} name={name} />

              <div className="flex flex-col flex-1 gap-1" style={{ minWidth: 0 }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate" style={{ color: 'var(--ink-primary)', fontSize: '1.1rem' }}>
                    {name}
                  </span>
                  <span 
                    className="font-pixel" 
                    style={{ 
                      fontSize: '8px', 
                      background: 'var(--accent-muted)', 
                      color: 'var(--accent)', 
                      padding: '2px 6px',
                      border: '1px solid var(--accent)',
                      display: 'inline-block'
                    }}
                  >
                    {getRankTitle(rank)}
                  </span>
                </div>
                
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="xp-bar" style={{ flex: 1, maxWidth: 200, minWidth: 100 }}>
                    <div
                      className="xp-bar-fill"
                      style={{
                        width: `${Math.min(((user.xp || 0) / maxXP) * 100, 100)}%`,
                        background: rank <= 3 ? rankColor : 'var(--accent)'
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>
                    {user.reports ?? user.reports_submitted ?? 0} Reported
                  </span>
                  <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>
                    · {verifications} Verified
                  </span>
                  <span className="text-xs" style={{ whiteSpace: 'nowrap', color: accuracyRate >= 70 ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                    · Accuracy: {accuracyRate}%
                  </span>
                  <span className="text-xs" style={{ whiteSpace: 'nowrap', color: 'var(--accent)', fontWeight: 600 }}>
                    · Trust: {trustScore}%
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="font-pixel" style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: 700 }}>
                  {contributionScore} PTS
                </span>
                <span className="font-mono text-muted" style={{ fontSize: '0.75rem' }}>
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
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', borderRadius: 0 }}>
            <span className="font-mono text-muted text-sm">NO DATA DETECTED</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default LeaderboardPage;
