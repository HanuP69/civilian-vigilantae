import { useState, useEffect } from 'react';
import { fetchDashboardStats, fetchRecurrenceRisk } from '../services/api';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../utils/constants';
import { formatHours, capitalize } from '../utils/formatters';

function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recurrence, setRecurrence] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchDashboardStats().catch(() => null),
      fetchRecurrenceRisk().catch(() => []),
    ]).then(([s, r]) => {
      setStats(s);
      setRecurrence(Array.isArray(r) ? r : r?.risks || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="stats-row">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 90, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  const categoryBreakdown = stats?.category_breakdown || {};
  const maxCategory = Math.max(...Object.values(categoryBreakdown), 1);
  const departments = stats?.department_stats || [];

  return (
    <div className="flex flex-col gap-6">
      <h2>Dashboard</h2>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{stats?.total_issues ?? '—'}</div>
          <div className="stat-label">Total Issues</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.resolved_this_week ?? '—'}</div>
          <div className="stat-label">Resolved This Week</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.avg_resolution_hours != null ? formatHours(stats.avg_resolution_hours) : '—'}</div>
          <div className="stat-label">Avg Resolution Time</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.active_reporters ?? '—'}</div>
          <div className="stat-label">Active Reporters</div>
        </div>
      </div>

      {Object.keys(categoryBreakdown).length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-5)' }}>Category Breakdown</h3>
          <div className="flex flex-col gap-3">
            {Object.entries(categoryBreakdown).map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-sm" style={{ width: 120, flexShrink: 0 }}>
                  {CATEGORY_LABELS[cat] || capitalize(cat)}
                </span>
                <div style={{ flex: 1, height: 24, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(count / maxCategory) * 100}%`,
                      background: CATEGORY_COLORS[cat] || 'var(--accent)',
                      borderRadius: 'var(--radius-sm)',
                      transition: 'width 300ms ease-out',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 'var(--space-2)',
                    }}
                  >
                    <span className="text-xs font-medium" style={{ color: 'white' }}>{count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {departments.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-4)' }}>Department Performance</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Total</th>
                  <th>Resolved</th>
                  <th>Rate</th>
                  <th>Avg Hours</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept, i) => (
                  <tr key={i}>
                    <td className="font-medium" style={{ color: 'var(--ink-primary)' }}>{dept.name}</td>
                    <td>{dept.total}</td>
                    <td>{dept.resolved}</td>
                    <td>
                      <span style={{ color: dept.rate >= 70 ? 'var(--success)' : dept.rate >= 40 ? 'var(--warning)' : 'var(--error)' }}>
                        {dept.rate != null ? `${Math.round(dept.rate)}%` : '—'}
                      </span>
                    </td>
                    <td>{formatHours(dept.avg_hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recurrence.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-4)' }}>Recurrence Risk</h3>
          <div className="flex flex-col gap-3">
            {recurrence.slice(0, 10).map((item, i) => (
              <div key={i} className="card card-compact flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{item.location || item.area || `Zone ${i + 1}`}</span>
                  <span className="text-sm font-mono" style={{
                    color: item.probability > 0.7 ? 'var(--error)' : item.probability > 0.4 ? 'var(--warning)' : 'var(--success)',
                  }}>
                    {item.probability != null ? `${Math.round(item.probability * 100)}%` : '—'}
                  </span>
                </div>
                <div className="priority-bar">
                  <div
                    className="priority-bar-fill"
                    style={{
                      width: `${Math.round((item.probability || 0) * 100)}%`,
                      background: item.probability > 0.7 ? 'var(--error)' : item.probability > 0.4 ? 'var(--warning)' : 'var(--success)',
                    }}
                  />
                </div>
                {item.recommended_action && (
                  <p className="text-xs text-muted">↳ {item.recommended_action}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
