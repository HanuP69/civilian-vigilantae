import { useState, useEffect, useMemo } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import '../charts/register.js';
import { TICK_COLOR, statusPalette, resolvePalette, resolveVar, refreshChartTheme, baseScales, baseChartProps } from '../charts/theme.js';
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

const Latex = ({ math, block = false }) => {
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (!math) return;
    const renderMath = () => {
      if (window.katex) {
        try {
          const rendered = window.katex.renderToString(math, {
            displayMode: block,
            throwOnError: false
          });
          setHtml(rendered);
          return true;
        } catch (err) {
          console.error(err);
          setHtml(math);
          return true;
        }
      }
      return false;
    };

    if (renderMath()) return;

    const timer = setInterval(() => {
      if (renderMath()) {
        clearInterval(timer);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [math, block]);

  if (!html) {
    return <code className="katex-placeholder">{math}</code>;
  }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
};

function WardHexmap({ wardMetrics, activeWard, setActiveWard }) {
  const r = 52; 
  const dx = Math.sqrt(3) * r; 
  const dy = 1.5 * r; 
  const offsetX = 55;
  const offsetY = 55;

  const coordMap = {
    'Chowk': { col: 0, row: 0 },
    'Aliganj': { col: 1, row: 0 },
    'Indira Nagar': { col: 2, row: 0 },
    'Aminabad': { col: 0, row: 1 },
    'Hazratganj': { col: 1, row: 1 },
    'Gomti Nagar': { col: 2, row: 1 },
    'Rajajipuram': { col: 0, row: 2 },
    'Alambagh': { col: 1, row: 2 },
  };

  const getHexPoints = (xc, yc, radius) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angleRad = (Math.PI / 180) * (30 + 60 * i);
      const x = xc + radius * Math.cos(angleRad);
      const y = yc + radius * Math.sin(angleRad);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  };

  return (
    <div className="hexmap-wrapper">
      <svg className="hex-grid-svg" viewBox="0 0 350 310">
        <defs>
          <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-yellow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {wardMetrics.map((ward) => {
          const coords = coordMap[ward.name];
          if (!coords) return null;

          const { col, row } = coords;
          const isOddRow = row % 2 !== 0;
          const xc = col * dx + (isOddRow ? 0.5 * dx : 0) + offsetX;
          const yc = row * dy + offsetY;

          const riskIndex = (ward.active * 1.5) + (ward.highUrgency * 3.0);
          
          let fill = 'rgba(16, 185, 129, 0.15)'; 
          let stroke = 'var(--success)';
          let glowFilter = '';

          if (riskIndex > 8) {
            fill = 'rgba(239, 68, 68, 0.35)'; 
            stroke = 'var(--error)';
            glowFilter = 'url(#glow-red)';
          } else if (riskIndex > 3) {
            fill = 'rgba(245, 158, 11, 0.25)'; 
            stroke = 'var(--warning)';
            glowFilter = 'url(#glow-yellow)';
          }

          const isHovered = activeWard?.name === ward.name;

          return (
            <g
              key={ward.name}
              className={`hex-g ${isHovered ? 'hovered' : ''}`}
              onMouseEnter={() => setActiveWard(ward)}
              style={{ cursor: 'pointer' }}
            >
              <polygon
                points={getHexPoints(xc, yc, r)}
                fill={fill}
                stroke={isHovered ? '#ffffff' : stroke}
                strokeWidth={isHovered ? 3 : 1.5}
                filter={isHovered ? glowFilter || 'url(#glow-yellow)' : glowFilter}
                style={{ transition: 'all 0.2s ease' }}
              />
              <text
                x={xc}
                y={yc - 4}
                className="hex-label"
                textAnchor="middle"
                style={{
                  fill: isHovered ? '#ffffff' : 'var(--ink-primary)',
                  fontSize: '9px',
                  fontWeight: 600,
                  pointerEvents: 'none',
                  letterSpacing: '0.02em',
                  transition: 'fill 0.2s'
                }}
              >
                {ward.name.split(' ')[0]}
              </text>
              <text
                x={xc}
                y={yc + 10}
                className="hex-sublabel"
                textAnchor="middle"
                style={{
                  fill: isHovered ? '#ffffff' : 'var(--ink-muted)',
                  fontSize: '8px',
                  fontWeight: 500,
                  pointerEvents: 'none',
                  transition: 'fill 0.2s'
                }}
              >
                Risk: {Math.round(Math.min((riskIndex / 12) * 100, 100))}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

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

const EXPLANATIONS = {
  total_issues: {
    title: 'Total Issues Count',
    text: 'Measures the absolute volume of unique municipal issues recorded in the database, including both active and resolved tickets.',
    formula: 'N_{total} = \\sum_{t \\in Firestore} 1'
  },
  resolved_7d: {
    title: 'Resolution Throughput (7 Days)',
    text: 'Measures the rate of ticket closures within the last 7 days. Highlights recent municipal productivity and cleanup efficiency.',
    formula: 'N_{resolved\\_7d} = \\sum_{t \\in Tickets} \\mathbb{I}(t.status = \\text{"resolved"} \\land \\Delta t_{resolved} \\le 7d)'
  },
  avg_resolution: {
    title: 'Average Speed of Resolution',
    text: 'Calculates the average hours elapsed between ticket creation and successful resolution status. Helps audit department SLAs.',
    formula: '\\mu_{hours} = \\frac{1}{N} \\sum_{i=1}^{N} (\\text{resolved\\_at}_i - \\text{created\\_at}_i)\\ \\text{in hours}'
  },
  active_reporters: {
    title: 'Unique Citizen Contributors',
    text: 'Counts the unique citizen user accounts that have reported issues within the last 7 days. Measures civic engagement density.',
    formula: 'N_{reporters} = |\\{ reporter\\_id \\mid \\Delta t_{created} \\le 7d \\}|'
  },
  sla_risk: {
    title: 'Tickets Breaching SLA Deadline',
    text: 'Identifies unresolved issues where the current time exceeds the calculated SLA deadline (dependent on category defaults, e.g. 72h).',
    formula: 'N_{breached} = \\sum_{t \\in Active} \\mathbb{I}(\\text{now} > \\text{sla\\_deadline}_t)'
  },
  category: {
    title: 'Issues Distribution by Category',
    text: 'Categorizes incoming tickets using Gemini text/media zero-shot classification model. Each ticket is mapped to a primary municipal department (Roads, Water, Electricity, Sanitation) based on semantic categorizations.',
    formula: 'Count(c) = \\sum_{t \\in Tickets} \\mathbb{I}(t.category = c)'
  },
  status: {
    title: 'Ticket Status Distribution',
    text: 'Tracks active issues through their operational lifecycle: reported (initial state) -> verified (minimum 3 community confirmation votes) -> resolved (validated resolved state) -> reopened (new reported anomalies).',
    formula: '\\text{Ratio}(s) = \\frac{\\sum \\mathbb{I}(t.status = s)}{N_{total}} \\times 100%'
  },
  velocity: {
    title: 'Resolution Velocity Trend',
    text: 'Calculates the daily completion rate of resolved tickets over the last 30 days to measure municipal response efficiency and detect queue blockages.',
    formula: 'V(d) = \\text{CountResolved}(d)\\ \\text{for } d \\in [1, 30]'
  },
  departments: {
    title: 'Department Performance Audit',
    text: 'Tracks the average SLA response time and resolution throughput for each municipal department. Performance rankings are sorted dynamically by resolution rate descending.',
    formula: '\\text{Rate}(dept) = \\frac{N_{resolved}}{N_{assigned}} \\times 100\\%'
  },
  recurrence: {
    title: 'Weibull Recurrence Risk Forecast',
    text: 'Forecasts the likelihood of an issue recurring in a specific ward within the next 14 days using a Weibull survival analysis model fitted on historical inter-arrival resolution intervals.',
    formula: 'P(R) = \\frac{F(t_0 + 336) - F(t_0)}{1 - F(t_0)}\\ \\text{where } F(t) = 1 - e^{-\\left(\\frac{t}{\\lambda}\\right)^k}'
  },
  ward_heatmap: {
    title: 'Localized Ward Hotspot Density',
    text: 'Measures ward severity by weighting active issues (w = 1.5) and critical priority issues (w = 3.0) to calculate a localized civic risk index.',
    formula: '\\text{Risk Index} = (\\text{Active} \\times 1.5) + (\\text{High Urgency} \\times 3.0)'
  }
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemAnim = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recurrence, setRecurrence] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRisk, setExpandedRisk] = useState(null);
  const [activeInfo, setActiveInfo] = useState({});
  const [selectedWardName, setSelectedWardName] = useState(null);
  const [viewMode, setViewMode] = useState('map');
  const { toast } = useToast();

  const toggleInfo = (key) => setActiveInfo(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    refreshChartTheme();
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

  const wardMetrics = useMemo(() => {
    const metrics = {};
    for (const ticket of tickets) {
      if (!ticket.ward) continue;
      if (!metrics[ticket.ward]) {
        metrics[ticket.ward] = { name: ticket.ward, active: 0, total: 0, highUrgency: 0, maxRisk: 0 };
      }
      metrics[ticket.ward].total++;
      if (ticket.status !== 'resolved') {
        metrics[ticket.ward].active++;
        if (ticket.priority_score > 70) {
          metrics[ticket.ward].highUrgency++;
        }
      }
    }
    for (const item of recurrence) {
      if (metrics[item.ward]) {
        metrics[item.ward].maxRisk = Math.max(metrics[item.ward].maxRisk || 0, item.probability);
      }
    }
    return Object.values(metrics).sort((a, b) => b.active - a.active);
  }, [tickets, recurrence]);

  useEffect(() => {
    if (wardMetrics.length > 0 && !selectedWardName) {
      setSelectedWardName(wardMetrics[0].name);
    }
  }, [wardMetrics, selectedWardName]);

  const selectedWard = useMemo(() => {
    return wardMetrics.find(w => w.name === selectedWardName) || wardMetrics[0] || null;
  }, [wardMetrics, selectedWardName]);

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
      borderRadius: 0,
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
      datasets: [{ data, borderColor: resolveVar(colorVar), backgroundColor: resolveVar(colorVar), borderWidth: 2, pointRadius: 0, tension: 0, fill: false }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } }, elements: { line: { borderCapStyle: 'square' } } },
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
      borderWidth: 2.5,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointHoverBackgroundColor: '#ffffff',
      pointHoverBorderColor: resolveVar('var(--success)'),
      pointHoverBorderWidth: 3,
      tension: 0,
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
            <div key={i} className="skeleton" style={{ height: 110, borderRadius: 0 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 300, borderRadius: 0 }} />
      </div>
    );
  }

  const kpis = [
    { label: 'QUESTS IN JOURNAL', value: stats?.total, spark: createdSpark, sparkColor: 'var(--accent)', panelKey: 'total_issues' },
    { label: 'QUESTS COMPLETED', value: stats?.resolvedThisWeek, spark: resolvedSpark, sparkColor: 'var(--success)', panelKey: 'resolved_7d', success: true },
    { label: 'AVG RESOLUTION', value: stats?.avgResolutionHours != null ? Math.round(stats.avgResolutionHours) : null, suffix: 'h', panelKey: 'avg_resolution' },
    { label: 'GUILD SENTINELS', value: stats?.activeReporters, panelKey: 'active_reporters' },
    { label: 'EXPIRING QUESTS', value: slaAtRisk, danger: slaAtRisk > 0, panelKey: 'sla_risk' },
  ];

  return (
    <motion.div className="flex flex-col gap-6" variants={container} initial="hidden" animate="show">
      <div className="flex items-center justify-between">
        <h2 className="font-pixel" style={{ fontSize: '0.9rem', color: 'var(--ink-primary)' }}>⚔️ Guild Operations Ledger</h2>
        <span className="font-pixel text-muted" style={{ fontSize: '0.45rem' }}>{tickets.length} QUESTS TRACKED · LIVE</span>
      </div>

      <div className="grafana-kpi-grid">
        {kpis.map((kpi) => {
          const isOpen = activeInfo[kpi.panelKey];
          return (
            <motion.div
              key={kpi.label}
              variants={itemAnim}
              className={`grafana-kpi-card ${kpi.danger ? 'danger' : kpi.success ? 'success' : ''}`}
            >
              <div className="flex flex-col gap-1" style={{ height: '100%', justifyContent: 'space-between' }}>
                <div className="flex items-center justify-between">
                  <span className="grafana-kpi-title">{kpi.label}</span>
                  <button
                    className="btn-info-icon"
                    onClick={() => toggleInfo(kpi.panelKey)}
                    style={{ width: 14, height: 14, fontSize: '0.65rem' }}
                    aria-label={`Formula details for ${kpi.label}`}
                  >
                    ⓘ
                  </button>
                </div>
                {isOpen ? (
                  <div className="text-xs text-muted rpg-scrollbar" style={{ lineHeight: 1.3, animation: 'slideDown 0.2s ease-out', overflowY: 'auto', maxHeight: '68px' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{EXPLANATIONS[kpi.panelKey].title}:</span>{' '}
                    {EXPLANATIONS[kpi.panelKey].text}
                    <div className="formula-box" style={{ marginTop: '4px' }}>
                      <Latex math={EXPLANATIONS[kpi.panelKey].formula} block />
                    </div>
                  </div>
                ) : (
                  <div className="grafana-kpi-val">
                    <CountUp to={kpi.value} suffix={kpi.suffix || ''} />
                  </div>
                )}
                {!isOpen && kpi.spark && (
                  <div className="kpi-spark" style={{ height: 28 }}>
                    <Line {...sparkConfig(kpi.spark, kpi.sparkColor)} />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="dash-grid">
        <InteractivePanel
          title="[ 📦 QUEST CLASSES ]"
          subtitle={`${catKeys.length} categories`}
          panelKey="category"
          activeInfo={activeInfo}
          onToggleInfo={toggleInfo}
          explanation={EXPLANATIONS.category.text}
          formula={EXPLANATIONS.category.formula}
        >
          <Bar data={categoryData} options={categoryOpts} />
        </InteractivePanel>
        <InteractivePanel
          title="[ ⏳ QUEST LIFECYCLE ]"
          subtitle="lifecycle"
          panelKey="status"
          activeInfo={activeInfo}
          onToggleInfo={toggleInfo}
          explanation={EXPLANATIONS.status.text}
          formula={EXPLANATIONS.status.formula}
        >
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Doughnut data={statusData} options={statusOpts} />
            <div className="doughnut-center-label">
              <span className="doughnut-center-val">{stats?.total || 0}</span>
              <span className="doughnut-center-lbl font-pixel" style={{ fontSize: '0.45rem', marginTop: '4px' }}>QUEST JOURNAL</span>
            </div>
          </div>
        </InteractivePanel>
      </div>

      <InteractivePanel
        title="[ ⚡ GUILD DISPATCH VELOCITY ]"
        subtitle="resolved tickets · last 30 days"
        panelKey="velocity"
        activeInfo={activeInfo}
        onToggleInfo={toggleInfo}
        explanation={EXPLANATIONS.velocity.text}
        formula={EXPLANATIONS.velocity.formula}
        height={240}
      >
        <Line data={velocityData} options={velocityOpts} />
      </InteractivePanel>

      {/* Grafana-style Hotspot Heatmap Panel with Hexmap Toggle */}
      <motion.div variants={itemAnim} className="card rpg-panel" style={{ marginBottom: 'var(--space-6)', position: 'relative', borderRadius: 0 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div className="flex items-center gap-3">
            <h3 className="font-pixel" style={{ fontSize: '0.65rem', margin: 0, color: 'var(--accent)' }}>[ 🗺️ WARD THREAT HEXMAP ]</h3>
            <button className="btn-info-icon" onClick={() => toggleInfo('ward_heatmap')} aria-label="Formula details for Heatmap">ⓘ</button>
            <div className="flex items-center gap-1.5" style={{ marginLeft: 'var(--space-2)' }}>
              <button 
                className={`btn-toggle ${viewMode === 'map' ? 'active' : ''}`}
                onClick={() => setViewMode('map')}
              >
                Hexmap
              </button>
              <button 
                className={`btn-toggle ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                Card List
              </button>
            </div>
          </div>
          <span className="font-pixel text-muted" style={{ fontSize: '0.45rem' }}>REAL-TIME CIVIC DENSITY</span>
        </div>

        {activeInfo.ward_heatmap && (
          <div 
            className="metric-explanation-panel" 
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%', 
              height: '100%', 
              backgroundColor: 'rgba(21, 22, 29, 0.96)', 
              backdropFilter: 'blur(4px)',
              borderRadius: 0,
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              margin: 0,
              padding: 'var(--space-5)',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div className="flex justify-between items-center">
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Hotspot Severity Metric
                </span>
                <button className="btn-close-inline" onClick={() => toggleInfo('ward_heatmap')}>✕</button>
              </div>
              <p className="text-secondary text-xs rpg-scrollbar" style={{ lineHeight: 1.4, margin: 0, overflowY: 'auto', maxHeight: '140px' }}>
                {EXPLANATIONS.ward_heatmap.text}
              </p>
            </div>
            <div className="formula-box" style={{ marginTop: 'auto' }}>
              <Latex math={EXPLANATIONS.ward_heatmap.formula} block />
            </div>
          </div>
        )}

        {viewMode === 'map' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-5)', alignItems: 'center' }}>
            <WardHexmap wardMetrics={wardMetrics} activeWard={selectedWard} setActiveWard={(w) => setSelectedWardName(w ? w.name : null)} />
            
            {selectedWard && (
              <div className="hex-details-card rpg-panel" style={{ animation: 'fadeIn 0.25s ease-out', borderRadius: 0 }}>
                <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                  <h4 className="font-pixel" style={{ margin: 0, fontSize: '0.65rem', color: 'var(--accent)', fontWeight: 600 }}>{selectedWard.name}</h4>
                  <span className="font-pixel" style={{ fontSize: '0.45rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px', display: 'block' }}>WARD SEVERITY STATUS</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="font-pixel" style={{ fontSize: '0.45rem', color: 'var(--ink-muted)' }}>ACTIVE QUESTS</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink-primary)' }} className="font-mono">{selectedWard.active}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="font-pixel" style={{ fontSize: '0.45rem', color: 'var(--ink-muted)' }}>CRITICAL THREATS</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: selectedWard.highUrgency > 0 ? 'var(--error)' : 'var(--ink-primary)' }} className="font-mono">{selectedWard.highUrgency}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="font-pixel" style={{ fontSize: '0.45rem', color: 'var(--ink-muted)' }}>HISTORICAL LOG</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--ink-secondary)' }} className="font-mono">{selectedWard.total}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="font-pixel" style={{ fontSize: '0.45rem', color: 'var(--ink-muted)' }}>RECURRENCE RISK</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: selectedWard.maxRisk > 0.7 ? 'var(--error)' : selectedWard.maxRisk > 0.4 ? 'var(--warning)' : 'var(--success)' }} className="font-mono">
                      {selectedWard.maxRisk ? `${Math.round(selectedWard.maxRisk * 100)}%` : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-subtle)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-1)' }}>
                    <span className="font-pixel" style={{ fontSize: '0.45rem', fontWeight: 600, color: 'var(--ink-secondary)' }}>THREAT INDEX</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: ((selectedWard.active * 1.5) + (selectedWard.highUrgency * 3.0)) > 8 ? 'var(--error)' : ((selectedWard.active * 1.5) + (selectedWard.highUrgency * 3.0)) > 3 ? 'var(--warning)' : 'var(--success)' }} className="font-mono">
                      {((selectedWard.active * 1.5) + (selectedWard.highUrgency * 3.0)).toFixed(1)}
                    </span>
                  </div>
                  
                  <div style={{ background: 'oklch(0.12 0.01 260)', borderLeft: '2.5px solid var(--accent)', padding: 'var(--space-3)', borderRadius: 0, fontSize: '0.72rem', color: 'var(--ink-secondary)', marginTop: 'var(--space-2)', lineHeight: 1.4 }}>
                    <span className="font-pixel" style={{ fontSize: '0.45rem', fontWeight: 700, color: 'var(--accent)', display: 'block', marginBottom: '4px' }}>RECOMMENDED ACTION:</span>{' '}
                    {selectedWard.active === 0 ? 'No active threats. Maintain regular civil sweeps.' :
                     selectedWard.highUrgency > 1 || ((selectedWard.active * 1.5) + (selectedWard.highUrgency * 3.0)) > 8 ? 'Dispatch emergency maintenance crew immediately to resolve critical breaches.' :
                     'Schedule department audit of outstanding tickets in next 48-hour routine cycle.'}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grafana-heatmap-grid" style={{ animation: 'fadeIn 0.25s ease-out' }}>
            {wardMetrics.map((ward) => {
              const riskIndex = (ward.active * 1.5) + (ward.highUrgency * 3.0);
              let colorVar = 'var(--success)';
              let glowColor = 'rgba(16, 185, 129, 0.12)';
              if (riskIndex > 8) {
                colorVar = 'var(--error)';
                glowColor = 'rgba(239, 68, 68, 0.15)';
              } else if (riskIndex > 3) {
                colorVar = 'var(--warning)';
                glowColor = 'rgba(245, 158, 11, 0.15)';
              }

              return (
                <div 
                  key={ward.name} 
                  className="grafana-heatmap-card"
                  style={{ 
                    borderColor: riskIndex > 0 ? colorVar : 'var(--border-subtle)',
                    boxShadow: riskIndex > 3 ? `0 0 12px ${glowColor}` : 'none'
                  }}
                >
                  <span className="text-sm font-semibold" style={{ color: 'var(--ink-primary)' }}>{ward.name}</span>
                  <div className="flex justify-between text-xs text-muted" style={{ marginTop: 'var(--space-2)' }}>
                    <span>Active Issues:</span>
                    <span className="font-mono font-semibold" style={{ color: 'var(--ink-secondary)' }}>{ward.active}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted">
                    <span>Critical (Urgent):</span>
                    <span className="font-mono font-semibold" style={{ color: ward.highUrgency > 0 ? 'var(--error)' : 'var(--ink-secondary)' }}>
                      {ward.highUrgency}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted">
                    <span>Max Recurrence Risk:</span>
                    <span className="font-mono font-semibold" style={{ color: (ward.maxRisk || 0) > 0.7 ? 'var(--error)' : (ward.maxRisk || 0) > 0.4 ? 'var(--warning)' : 'var(--success)' }}>
                      {ward.maxRisk ? `${Math.round(ward.maxRisk * 100)}%` : '—'}
                    </span>
                  </div>
                  <div 
                    className="heatmap-intensity-bar" 
                    style={{ background: riskIndex > 0 ? colorVar : 'var(--border-subtle)' }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {departments.length > 0 && (
        <motion.div variants={itemAnim} className="card rpg-panel" style={{ display: 'flex', flexDirection: 'column', position: 'relative', borderRadius: 0 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="flex items-center gap-2">
              <h3 className="font-pixel" style={{ fontSize: '0.65rem', margin: 0, color: 'var(--accent)' }}>[ 🛡️ DEPARTMENT GUILD AUDIT ]</h3>
              <button className="btn-info-icon" onClick={() => toggleInfo('departments')} aria-label="Formula details for Departments">ⓘ</button>
            </div>
            <span className="font-pixel text-muted" style={{ fontSize: '0.45rem' }}>SLA AUDIT</span>
          </div>

          {activeInfo.departments && (
            <div 
              className="metric-explanation-panel" 
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%', 
                backgroundColor: 'rgba(21, 22, 29, 0.96)', 
                backdropFilter: 'blur(4px)',
                borderRadius: 0,
                zIndex: 30,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                margin: 0,
                padding: 'var(--space-5)',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div className="flex justify-between items-center">
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    SLA & Performance Metric
                  </span>
                  <button className="btn-close-inline" onClick={() => toggleInfo('departments')}>✕</button>
                </div>
                <p className="text-secondary text-xs rpg-scrollbar" style={{ lineHeight: 1.4, margin: 0, overflowY: 'auto', maxHeight: '140px' }}>
                  {EXPLANATIONS.departments.text}
                </p>
              </div>
              <div className="formula-box" style={{ marginTop: 'auto' }}>
                <Latex math={EXPLANATIONS.departments.formula} block />
              </div>
            </div>
          )}

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th className="font-pixel" style={{ fontSize: '0.45rem' }}>DEPARTMENT GUILD</th>
                  <th className="font-pixel" style={{ fontSize: '0.45rem' }}>QUESTS ASSIGNED</th>
                  <th className="font-pixel" style={{ fontSize: '0.45rem' }}>RESOLVED</th>
                  <th className="font-pixel" style={{ fontSize: '0.45rem' }}>SUCCESS RATE</th>
                  <th className="font-pixel" style={{ fontSize: '0.45rem' }}>AVG RESOLVE SPEED</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept, i) => (
                  <tr key={dept.name} style={i === 0 ? { background: 'oklch(0.25 0.06 85 / 0.15)' } : undefined}>
                    <td className="font-medium" style={{ color: 'var(--ink-primary)' }}>
                      {dept.name}{i === 0 && <span className="badge font-pixel" style={{ marginLeft: 'var(--space-2)', background: 'var(--rank-gold)', color: '#000', fontSize: '0.45rem', borderRadius: 0, padding: '2px 4px' }}>TOP</span>}
                    </td>
                    <td>{dept.total}</td>
                    <td>{dept.resolved}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span style={{ color: dept.resolution_rate >= 70 ? 'var(--success)' : dept.resolution_rate >= 40 ? 'var(--warning)' : 'var(--error)' }}>
                          {dept.resolution_rate != null ? `${Math.round(dept.resolution_rate)}%` : '—'}
                        </span>
                        <div className="dept-bar-mini" style={{ borderRadius: 0 }}>
                          <div className="dept-bar-mini-fill" style={{ width: `${dept.resolution_rate || 0}%`, background: dept.resolution_rate >= 70 ? 'var(--success)' : dept.resolution_rate >= 40 ? 'var(--warning)' : 'var(--error)', borderRadius: 0 }} />
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
        <motion.div variants={itemAnim} className="card rpg-panel" style={{ display: 'flex', flexDirection: 'column', position: 'relative', borderRadius: 0 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="flex items-center gap-2">
              <h3 className="font-pixel" style={{ fontSize: '0.65rem', margin: 0, color: 'var(--accent)' }}>[ 🔮 RECURRENCE FORECAST ORACLE ]</h3>
              <button className="btn-info-icon" onClick={() => toggleInfo('recurrence')} aria-label="Formula details for Recurrence Risk">ⓘ</button>
            </div>
            <span className="font-pixel text-muted" style={{ fontSize: '0.45rem' }}>WEIBULL ANALYSIS</span>
          </div>

          {activeInfo.recurrence && (
            <div 
              className="metric-explanation-panel"
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%', 
                backgroundColor: 'rgba(21, 22, 29, 0.96)', 
                backdropFilter: 'blur(4px)',
                borderRadius: 0,
                zIndex: 30,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                margin: 0,
                padding: 'var(--space-5)',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div className="flex justify-between items-center">
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Weibull Forecast Logic
                  </span>
                  <button className="btn-close-inline" onClick={() => toggleInfo('recurrence')}>✕</button>
                </div>
                <p className="text-secondary text-xs rpg-scrollbar" style={{ lineHeight: 1.4, margin: 0, overflowY: 'auto', maxHeight: '180px' }}>
                  {EXPLANATIONS.recurrence.text}
                </p>
              </div>
              <div className="formula-box" style={{ marginTop: 'auto' }}>
                <Latex math={EXPLANATIONS.recurrence.formula} block />
              </div>
            </div>
          )}

          <div className="method-banner" style={{ marginBottom: 'var(--space-4)' }}>
            <span className="font-pixel" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.55rem' }}>WEIBULL SURVIVAL MODEL</span>
            <span style={{ marginLeft: '6px' }}>· forecasting 14-day recurrence probability from inter-arrival intervals</span>
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
                      <span className="recurrence-meta font-pixel" style={{ fontSize: '0.45rem' }}>{CATEGORY_LABELS[item.category] || capitalize(item.category)}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="flex justify-between text-xs" style={{ marginBottom: '4px' }}>
                        <span className="text-muted">{item.recommendedAction || item.recommendation}</span>
                        <span className="font-mono font-semibold" style={{ color }}>{Math.round((item.probability || 0) * 100)}%</span>
                      </div>
                      <div className="priority-bar" style={{ borderRadius: 0 }}>
                        <motion.div
                          className="priority-bar-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(Math.round((item.probability || 0) * 100), 2)}%` }}
                          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                          style={{ background: color, borderRadius: 0 }}
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
                      <div className="flex gap-8" style={{ padding: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div className="flex flex-col gap-4" style={{ minWidth: 160 }}>
                          <div className="flex flex-col gap-1">
                            <span className="label font-pixel" style={{ fontSize: '0.45rem' }}>SCALE FACTOR (λ)</span>
                            <span className="font-mono text-base font-semibold">{item.lambda}h</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="label font-pixel" style={{ fontSize: '0.45rem' }}>SHAPE METRIC (k)</span>
                            <span className="font-mono text-base font-semibold">{item.k}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="label font-pixel" style={{ fontSize: '0.45rem' }}>LAST RESOLVED</span>
                            <span className="font-mono text-sm font-medium">
                              {item.lastResolved ? new Date(item.lastResolved).toLocaleDateString() : '—'}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="label font-pixel" style={{ fontSize: '0.45rem' }}>ELAPSED TIME</span>
                            <span className="font-mono text-sm font-medium text-secondary">
                              {item.lastResolved 
                                ? `${Math.round(Math.max((new Date() - new Date(item.lastResolved)) / 3600000, 0))} hours` 
                                : '—'}
                            </span>
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 280, height: 180 }}>
                          <WeibullCurve lambda={item.lambda} k={item.k} lastResolved={item.lastResolved} />
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

function InteractivePanel({ title, subtitle, panelKey, activeInfo, onToggleInfo, explanation, formula, children, height = 280 }) {
  const isOpen = activeInfo[panelKey];
  return (
    <motion.div 
      variants={itemAnim} 
      className="card rpg-panel chart-card" 
      style={{ display: 'flex', flexDirection: 'column', position: 'relative', borderRadius: 0 }}
    >
      <div className="chart-card-header" style={{ marginBottom: 'var(--space-3)' }}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="chart-card-title">{title}</h3>
            <button
              className="btn-info-icon"
              onClick={() => onToggleInfo(panelKey)}
              aria-label={`View metric details for ${title}`}
              title="View metric details"
            >
              ⓘ
            </button>
          </div>
          {subtitle && <span className="chart-card-subtitle">{subtitle}</span>}
        </div>
      </div>

      {isOpen && (
        <div 
          className="metric-explanation-panel"
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            backgroundColor: 'rgba(21, 22, 29, 0.96)', 
            backdropFilter: 'blur(4px)',
            borderRadius: 0,
            zIndex: 30,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            margin: 0,
            padding: 'var(--space-5)',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div className="flex justify-between items-center">
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Calculation & Logic
              </span>
              <button className="btn-close-inline" onClick={() => onToggleInfo(panelKey)}>✕</button>
            </div>
            <p className="text-secondary text-xs rpg-scrollbar" style={{ lineHeight: 1.4, margin: 0, overflowY: 'auto', maxHeight: '140px' }}>
              {explanation}
            </p>
          </div>
          {formula && (
            <div className="formula-box" style={{ marginTop: 'auto' }}>
              <Latex math={formula} block />
            </div>
          )}
        </div>
      )}

      <div className="chart-card-body" style={{ height, flex: 1, minHeight: 0 }}>
        {children}
      </div>
    </motion.div>
  );
}

function WeibullCurve({ lambda, k, lastResolved }) {
  if (!lambda || !k || lambda <= 0 || k <= 0) return null;

  const now = new Date();
  const lastResolvedDate = lastResolved ? new Date(lastResolved) : null;
  const hoursSinceLast = lastResolvedDate
    ? Math.max((now.getTime() - lastResolvedDate.getTime()) / (1000 * 60 * 60), 0)
    : 0;

  const points = [];
  const maxT = Math.max(hoursSinceLast + 72, lambda * 3); // plot up to current + 3 days, or at least 3*lambda
  
  for (let i = 0; i <= 30; i++) {
    const t = (maxT * i) / 30;
    const cdf = 1 - Math.exp(-Math.pow(t / lambda, k));
    points.push({ x: Math.round(t), y: Math.round(cdf * 1000) / 10 });
  }

  const currentCDF = 1 - Math.exp(-Math.pow(hoursSinceLast / lambda, k));
  const currentY = Math.round(currentCDF * 1000) / 10;
  const currentX = Math.round(hoursSinceLast);

  const data = {
    datasets: [
      {
        label: 'Weibull CDF',
        data: points,
        borderColor: resolveVar('var(--accent)'),
        backgroundColor: 'rgba(201,163,90,0.08)',
        fill: true,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHitRadius: 10,
        tension: 0,
      },
      {
        label: 'Current Status Line',
        data: [
          { x: currentX, y: 0 },
          { x: currentX, y: currentY }
        ],
        borderColor: currentY > 70 ? 'var(--error)' : currentY > 40 ? 'var(--warning)' : 'var(--success)',
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
      },
      {
        label: 'Current Risk State',
        data: [{ x: currentX, y: currentY }],
        borderColor: '#ffffff',
        backgroundColor: currentY > 70 ? 'var(--error)' : currentY > 40 ? 'var(--warning)' : 'var(--success)',
        borderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        fill: false,
      }
    ],
  };

  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            const item = items[0];
            return `T = ${item.parsed.x} hours since resolution`;
          },
          label: (item) => {
            if (item.datasetIndex === 2) {
              return `Current State: ${item.parsed.y.toFixed(1)}% risk`;
            }
            return `CDF Recurrence Risk: ${item.parsed.y.toFixed(1)}%`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
          drawBorder: false,
        },
        ticks: {
          callback: (value) => `${value}h`,
          maxTicksLimit: 6,
          color: 'var(--ink-muted)',
        }
      },
      y: {
        type: 'linear',
        min: 0,
        max: 100,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
          drawBorder: false,
        },
        ticks: {
          callback: (value) => `${value}%`,
          maxTicksLimit: 5,
          color: 'var(--ink-muted)',
        }
      }
    }
  };

  return (
    <div className="flex flex-col gap-2" style={{ height: '100%' }}>
      <span className="label">Weibull CDF · P(recurrence) Curve</span>
      <div style={{ flex: 1, minHeight: 140 }}>
        <Line data={data} options={opts} />
      </div>
    </div>
  );
}

export default DashboardPage;
