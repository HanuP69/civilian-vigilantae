import { useState, useEffect, useMemo } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import '../charts/register.js';
import { GRID_COLOR, TICK_COLOR, categoryPalette, statusColor, statusPalette, resolvePalette, resolveVar, refreshChartTheme, baseScales, baseChartProps } from '../charts/theme.js';
import ChartCard from '../charts/ChartCard.jsx';
import { fetchDashboardStats, fetchRecurrenceRisk, fetchTickets } from '../services/api';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../utils/constants';
import { formatHours, capitalize } from '../utils/formatters';
import { useToast } from '../hooks/useToast.jsx';
import { motion } from 'framer-motion';
const CountUp = ({ to, suffix = '' }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (to === null || to === undefined) return;
    let startTime = null;
    const duration = 1500;
    const end = parseFloat(to);
    if (isNaN(end)) return;
    const animate = (time) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(easeProgress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [to]);
  if (to === null || to === undefined) return '—';
  return <>{count}{suffix}</>;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayBucket(iso, daysAgo) {
  const d = new Date(iso);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  midnight.setDate(midnight.getDate() - daysAgo);
  return d >= midnight;
}

function build7dSpark(tickets, field) {
  const buckets = new Array(7).fill(0);
  for (const t of tickets) {
    const v = t[field];
    if (!v) continue;
    for (let i = 0; i < 7; i++) {
      if (dayBucket(v, i) && !dayBucket(v, i - 1)) {
        buckets[6 - i]++;
        break;
      }
    }
  }
  return buckets;
}

function buildVelocity30d(tickets) {
  const buckets = new Array(30).fill(0);
  const now = Date.now();
  for (const t of tickets) {
    if (!t.resolved_at) continue;
    const diffDays = Math.floor((now - new Date(t.resolved_at).getTime()) / 86400000);
    if (diffDays >= 0 && diffDays < 30) buckets[29 - diffDays]++;
  }
  return buckets;
}

function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recurrence, setRecurrence] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRisk, setExpandedRisk] = useState(null);
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    refreshChartTheme();
    setMounted(true);
  }, []);

  useEffect(() => {
    Promise.all([
      fetchDashboardStats().catch(() => null),
      fetchRecurrenceRisk().catch(() => null),
      fetchTickets().catch(() => ({ tickets: [] })),
    ]).then(([s, r, t]) => {
      if (s === null) toast('Failed to load dashboard stats', 'error');
      if (r === null) toast('Failed to load recurrence risk', 'error');
      setStats(s);
      setRecurrence(Array.isArray(r) ? r : r?.risks || []);
      setTickets(Array.isArray(t) ? t : t.tickets || []);
      setLoading(false);
    });
  }, [toast]);

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const itemAnim = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
  };

  const categoryBreakdown = stats?.byCategory || {};
  const catKeys = Object.keys(categoryBreakdown);
  const statusBreakdown = stats?.byStatus || {};
  const statusKeys = Object.keys(statusBreakdown);
  const departments = stats?.deptLeaderboard || [];

  const slaAtRisk = useMemo(() => {
    const now = Date.now();
    return tickets.filter(t => {
      if (!t.sla_deadline || t.status === 'resolved') return false;
      return new Date(t.sla_deadline).getTime() < now;
    }).length;
  }, [tickets]);

  const createdSpark = useMemo(() => build7dSpark(tickets, 'created_at'), [tickets]);
  const resolvedSpark = useMemo(() => build7dSpark(tickets, 'resolved_at'), [tickets]);
  const velocity = useMemo(() => buildVelocity30d(tickets), [tickets]);

  const categoryData = {
    labels: catKeys.map(k => CATEGORY_LABELS[k] || capitalize(k)),
    datasets: [{
      data: catKeys.map(k => categoryBreakdown[k]),
      backgroundColor: resolvePalette(catKeys.map(k => CATEGORY_COLORS[k] || 'var(--accent)')),
      borderRadius: 4,
      borderSkipped: false,
    }],
  };

  const statusData = {
    labels: statusKeys.map(k => capitalize(k)),
    datasets: [{
      data: statusKeys.map(k => statusBreakdown[k]),
      backgroundColor: statusPalette(statusKeys),
      borderColor: '#15161d',
      borderWidth: 3,
      hoverOffset: 8,
    }],
  };

  const sparkConfig = (data, colorVar) => ({
    data: {
      labels: data.map((_, i) => i),
      datasets: [{ data, borderColor: resolveVar(colorVar), backgroundColor: resolveVar(colorVar), borderWidth: 2, pointRadius: 0, tension: 0.4, fill: false }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } }, elements: { line: { borderCapStyle: 'round' } } },
  });

  const velocityData = {
    labels: velocity.map((_, i) => i === 29 ? 'today' : `${29 - i}d`),
    datasets: [{
      data: velocity,
      borderColor: resolveVar('var(--success)'),
      backgroundColor: (ctx) => {
        const chart = ctx.chart;
        const { ctx: c, chartArea } = chart;
        if (!chartArea) return 'rgba(0,0,0,0)';
        const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        g.addColorStop(0, 'rgba(99,196,139,0.35)');
        g.addColorStop(1, 'rgba(99,196,139,0)');
        return g;
      },
      fill: true,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: resolveVar('var(--success)'),
      tension: 0.35,
    }],
  };

  const velocityOpts = {
    ...baseChartProps,
    plugins: { legend: { display: false } },
    scales: {
      x: { ...baseScales.x, grid: { display: false }, ticks: { maxTicksLimit: 6, color: TICK_COLOR } },
      y: { ...baseScales.y, beginAtZero: true, ticks: { precision: 0, color: TICK_COLOR } },
    },
  };

  const categoryOpts = {
    ...baseChartProps,
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: {
      x: { ...baseScales.x, beginAtZero: true, ticks: { precision: 0, color: TICK_COLOR } },
      y: { ...baseScales.y, grid: { display: false }, ticks: { color: TICK_COLOR } },
    },
  };

  const statusOpts = {
    ...baseChartProps,
    cutout: '68%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: TICK_COLOR, padding: 14, usePointStyle: true, pointStyle: 'circle', boxWidth: 8 },
      },
    },
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading dashboard">
        <div className="kpi-row">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton" style={{ height: 110, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  const kpis = [
    { label: 'Total Issues', value: stats?.total, spark: createdSpark, sparkColor: 'var(--accent)' },
    { label: 'Resolved / 7d', value: stats?.resolvedThisWeek, spark: resolvedSpark, sparkColor: 'var(--success)' },
    { label: 'Avg Resolution', value: stats?.avgResolutionHours != null ? Math.round(stats.avgResolutionHours) : null, suffix: 'h' },
    { label: 'Active Reporters', value: stats?.activeReporters },
    { label: 'SLA at Risk', value: slaAtRisk, danger: slaAtRisk > 0 },
  ];

  return (
    <motion.div className="flex flex-col gap-6" variants={container} initial="hidden" animate="show">
      <div className="flex items-center justify-between">
        <h2>Operations Dashboard</h2>
        <span className="font-mono text-xs text-muted">{tickets.length} tickets tracked · live</span>
      </div>

      <div className="kpi-row">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            variants={itemAnim}
            className="kpi-card"
            style={kpi.danger ? { borderColor: 'var(--error)' } : undefined}
          >
            <div className="kpi-value" style={kpi.danger ? { color: 'var(--error)' } : undefined}>
              <CountUp to={kpi.value} suffix={kpi.suffix || ''} />
            </div>
            <div className="kpi-label">{kpi.label}</div>
            {kpi.spark && (
              <div className="kpi-spark">
                <Line {...sparkConfig(kpi.spark, kpi.sparkColor)} />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="dash-grid">
        <ChartCard title="Issues by Category" subtitle={`${catKeys.length} categories`}>
          <Bar data={categoryData} options={categoryOpts} />
        </ChartCard>
        <ChartCard title="Status Distribution" subtitle="lifecycle">
          <Doughnut data={statusData} options={statusOpts} />
        </ChartCard>
      </div>

      <ChartCard title="Resolution Velocity" subtitle="resolved tickets · last 30 days" height={240}>
        <Line data={velocityData} options={velocityOpts} />
      </ChartCard>

      {departments.length > 0 && (
        <motion.div variants={itemAnim} className="card">
          <h3 style={{ marginBottom: 'var(--space-5)' }}>Department Performance</h3>
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
                  <tr key={dept.name} style={i === 0 ? { background: 'oklch(0.25 0.06 85 / 0.15)' } : undefined}>
                    <td className="font-medium" style={{ color: 'var(--ink-primary)' }}>
                      {dept.name}{i === 0 && <span className="badge" style={{ marginLeft: 'var(--space-2)', background: 'var(--rank-gold)', color: '#000', fontSize: '0.6rem' }}>TOP</span>}
                    </td>
                    <td>{dept.total}</td>
                    <td>{dept.resolved}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span style={{ color: dept.resolution_rate >= 70 ? 'var(--success)' : dept.resolution_rate >= 40 ? 'var(--warning)' : 'var(--error)' }}>
                          {dept.resolution_rate != null ? `${Math.round(dept.resolution_rate)}%` : '—'}
                        </span>
                        <div className="dept-bar-mini">
                          <div className="dept-bar-mini-fill" style={{ width: `${dept.resolution_rate || 0}%`, background: dept.resolution_rate >= 70 ? 'var(--success)' : dept.resolution_rate >= 40 ? 'var(--warning)' : 'var(--error)' }} />
                        </div>
                      </div>
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
          <h3 style={{ marginBottom: 'var(--space-3)' }}>Recurrence Risk Forecast</h3>
          <div className="method-banner">
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>weibull survival model</span>
            <span>· forecasting 14-day recurrence probability from inter-arrival intervals</span>
          </div>
          <div className="flex flex-col gap-3">
            {recurrence.slice(0, 10).map((item, i) => {
              const key = `${item.ward}-${item.category}-${i}`;
              const isOpen = expandedRisk === key;
              const color = item.probability > 0.7 ? 'var(--error)' : item.probability > 0.4 ? 'var(--warning)' : 'var(--success)';
              return (
                <div key={key}>
                  <div className="recurrence-row" onClick={() => setExpandedRisk(isOpen ? null : key)}>
                    <div className="flex flex-col" style={{ minWidth: 180 }}>
                      <span className="text-sm font-medium">{item.ward}</span>
                      <span className="recurrence-meta">{CATEGORY_LABELS[item.category] || capitalize(item.category)}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="flex justify-between text-xs" style={{ marginBottom: '4px' }}>
                        <span className="text-muted">{item.recommendedAction || item.recommendation}</span>
                        <span className="font-mono font-semibold" style={{ color }}>{Math.round((item.probability || 0) * 100)}%</span>
                      </div>
                      <div className="priority-bar">
                        <motion.div
                          className="priority-bar-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(Math.round((item.probability || 0) * 100), 2)}%` }}
                          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                          style={{ background: color }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-muted" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                  </div>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.25 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="flex gap-6" style={{ padding: 'var(--space-4) var(--space-5)', flexWrap: 'wrap' }}>
                        <div className="flex flex-col gap-1">
                          <span className="label">Scale (λ)</span>
                          <span className="font-mono text-sm">{item.lambda}h</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="label">Shape (k)</span>
                          <span className="font-mono text-sm">{item.k}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="label">Last resolved</span>
                          <span className="font-mono text-sm">{item.lastResolved ? new Date(item.lastResolved).toLocaleDateString() : '—'}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 200, height: 80 }}>
                          <WeibullCurve lambda={item.lambda} k={item.k} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function WeibullCurve({ lambda, k }) {
  if (!lambda || !k || lambda <= 0 || k <= 0) return null;
  const points = [];
  const maxT = lambda * 2.5;
  for (let i = 0; i <= 30; i++) {
    const t = (maxT * i) / 30;
    const cdf = 1 - Math.exp(-Math.pow(t / lambda, k));
    points.push({ x: i, y: cdf * 100 });
  }
  const data = {
    labels: points.map(p => p.x),
    datasets: [{
      data: points.map(p => p.y),
      borderColor: resolveVar('var(--accent)'),
      backgroundColor: 'rgba(201,163,90,0.12)',
      fill: true,
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.4,
    }],
  };
  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { title: () => '', label: (ctx) => `P(recurrence by t): ${ctx.parsed.y.toFixed(1)}%` } } },
    scales: { x: { display: false }, y: { display: false, max: 100 } },
  };
  return (
    <div className="flex flex-col gap-1" style={{ height: '100%' }}>
      <span className="label">Weibull CDF · P(recurrence)</span>
      <div style={{ flex: 1 }}>
        <Line data={data} options={opts} />
      </div>
    </div>
  );
}

export default DashboardPage;
