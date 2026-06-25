import { useState, useEffect } from 'react';
import { fetchDashboardStats, fetchRecurrenceRisk } from '../services/api';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../utils/constants';
import { formatHours, capitalize } from '../utils/formatters';
import { motion } from 'framer-motion';

const CountUp = ({ to, suffix = '' }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (to === null || to === undefined) return;
    let start = 0;
    const duration = 1500;
    const end = parseFloat(to);
    if (isNaN(end)) return;
    
    let startTime = null;
    const animate = (time) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // cubic ease out
      setCount(Math.floor(easeProgress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [to]);
  
  if (to === null || to === undefined) return '—';
  return <>{count}{suffix}</>;
};

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

  const categoryBreakdown = stats?.byCategory || {};
  const maxCategory = Math.max(...Object.values(categoryBreakdown), 1);
  const departments = stats?.deptLeaderboard || [];

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
    <motion.div 
      className="flex flex-col gap-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <h2>Dashboard</h2>

      <div className="stats-row">
        <motion.div variants={itemAnim} className="stat-card">
          <div className="stat-value"><CountUp to={stats?.total} /></div>
          <div className="stat-label">Total Issues</div>
        </motion.div>
        <motion.div variants={itemAnim} className="stat-card">
          <div className="stat-value"><CountUp to={stats?.resolvedThisWeek} /></div>
          <div className="stat-label">Resolved This Week</div>
        </motion.div>
        <motion.div variants={itemAnim} className="stat-card">
          <div className="stat-value">
            {stats?.avgResolutionHours != null ? <CountUp to={Math.round(stats.avgResolutionHours)} suffix="h" /> : '—'}
          </div>
          <div className="stat-label">Avg Resolution Time</div>
        </motion.div>
        <motion.div variants={itemAnim} className="stat-card">
          <div className="stat-value"><CountUp to={stats?.activeReporters} /></div>
          <div className="stat-label">Active Reporters</div>
        </motion.div>
      </div>

      {Object.keys(categoryBreakdown).length > 0 && (
        <motion.div variants={itemAnim} className="card">
          <h3 style={{ marginBottom: 'var(--space-5)' }}>Category Breakdown</h3>
          <div className="flex flex-col gap-3">
            {Object.entries(categoryBreakdown).map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-sm" style={{ width: 120, flexShrink: 0 }}>
                  {CATEGORY_LABELS[cat] || capitalize(cat)}
                </span>
                <div style={{ flex: 1, height: 24, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / maxCategory) * 100}%` }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                    style={{
                      height: '100%',
                      background: CATEGORY_COLORS[cat] || 'var(--accent)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 'var(--space-2)',
                    }}
                  >
                    <span className="text-xs font-medium" style={{ color: 'white' }}>{count}</span>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {departments.length > 0 && (
        <motion.div variants={itemAnim} className="card">
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
                      <span style={{ color: dept.resolution_rate >= 70 ? 'var(--success)' : dept.resolution_rate >= 40 ? 'var(--warning)' : 'var(--error)' }}>
                        {dept.resolution_rate != null ? `${Math.round(dept.resolution_rate)}%` : '—'}
                      </span>
                    </td>
                    <td>{formatHours(dept.avg_hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {recurrence.length > 0 && (
        <motion.div variants={itemAnim} className="card">
          <h3 style={{ marginBottom: 'var(--space-4)' }}>Recurrence Risk</h3>
          <div className="flex flex-col gap-3">
            {recurrence.slice(0, 10).map((item, i) => (
              <div key={i} className="card card-compact flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{item.ward ? `${item.ward} (${CATEGORY_LABELS[item.category] || capitalize(item.category)})` : `Zone ${i + 1}`}</span>
                  <span className="text-sm font-mono" style={{
                    color: item.probability > 0.7 ? 'var(--error)' : item.probability > 0.4 ? 'var(--warning)' : 'var(--success)',
                  }}>
                    {item.probability != null ? `${Math.round(item.probability * 100)}%` : '—'}
                  </span>
                </div>
                <div className="priority-bar">
                  <motion.div
                    className="priority-bar-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round((item.probability || 0) * 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                    style={{
                      background: item.probability > 0.7 ? 'var(--error)' : item.probability > 0.4 ? 'var(--warning)' : 'var(--success)',
                    }}
                  />
                </div>
                {item.recommendedAction && (
                  <p className="text-xs text-muted">↳ {item.recommendedAction}</p>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default DashboardPage;
