import { useState, useEffect } from 'react';
import { fetchLeaderboard } from '../services/api';

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
          <div key={i} className="skeleton" style={{ height: 56, borderRadius: 'var(--radius-md)' }} />
        ))}
      </div>
    );
  }

  const rankEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }} className="flex flex-col gap-5">
      <h2>Leaderboard</h2>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>XP</th>
                <th>Badges</th>
                <th>Reports</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => {
                const rank = user.rank || i + 1;
                const maxXP = users[0]?.xp || 1;
                return (
                  <tr key={user.id || i}>
                    <td style={{ color: 'var(--ink-primary)', fontWeight: 600, fontSize: '1rem' }}>
                      {rankEmoji(rank)}
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium" style={{ color: 'var(--ink-primary)' }}>
                          {user.name || user.username || `User ${user.id}`}
                        </span>
                        <div className="xp-bar" style={{ width: 120 }}>
                          <div
                            className="xp-bar-fill"
                            style={{ width: `${((user.xp || 0) / maxXP) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono font-semibold" style={{ color: 'var(--accent)' }}>
                        {user.xp ?? 0}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {(user.badges || []).map((badge, bi) => (
                          <span key={bi} title={badge.name || badge}>
                            {badge.emoji || badge.icon || '🏅'}
                          </span>
                        ))}
                        {(!user.badges || user.badges.length === 0) && (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </div>
                    </td>
                    <td>{user.reports_count ?? user.total_reports ?? 0}</td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <span className="text-muted">No leaderboard data available</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default LeaderboardPage;
