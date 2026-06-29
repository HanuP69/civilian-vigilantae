import { useState, useEffect, useMemo } from'react';
import { Bar, Doughnut, Line } from'react-chartjs-2';
import'../charts/register.js';
import { TICK_COLOR, statusPalette, resolvePalette, resolveVar, refreshChartTheme, baseScales, baseChartProps, SANDSTONE_GRID_COLOR, SANDSTONE_TICK_COLOR } from'../charts/theme.js';
import { fetchDashboardStats, fetchRecurrenceRisk, fetchTickets, fetchAssets } from'../services/api';
import { CATEGORY_LABELS, CATEGORY_COLORS } from'../utils/constants';
import { formatHours, capitalize } from'../utils/formatters';
import { useToast } from'../hooks/useToast.jsx';
import { motion } from'framer-motion';
import { PageShell } from'../components/ui/PixelKit';

const getSeverityColor = (index) => {
  if (index > 8) return'var(--error)';
  if (index > 3) return'var(--warning)';
  return'var(--success)';
};
const CountUp = ({ to, suffix =''}) => {
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
  if (to === null || to === undefined) return'—';
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
      <svg className="hex-grid-svg"viewBox="0 0 350 310">
        <defs>
          <filter id="glow-red"x="-20%"y="-20%"width="140%"height="140%">
            <feGaussianBlur stdDeviation="5"result="blur"/>
            <feComposite in="SourceGraphic"in2="blur"operator="over"/>
          </filter>
          <filter id="glow-yellow"x="-20%"y="-20%"width="140%"height="140%">
            <feGaussianBlur stdDeviation="4"result="blur"/>
            <feComposite in="SourceGraphic"in2="blur"operator="over"/>
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
          
          let fill ='rgba(16, 185, 129, 0.15)'; 
          let stroke ='var(--success)';
          let glowFilter ='';

          if (riskIndex > 8) {
            fill ='rgba(239, 68, 68, 0.35)'; 
            stroke ='var(--error)';
            glowFilter ='url(#glow-red)';
          } else if (riskIndex > 3) {
            fill ='rgba(245, 158, 11, 0.25)'; 
            stroke ='var(--warning)';
            glowFilter ='url(#glow-yellow)';
          }

          const isHovered = activeWard?.name === ward.name;

          return (
            <g
              key={ward.name}
              className={`hex-g ${isHovered ?'hovered':''}`}
              onMouseEnter={() => setActiveWard(ward)}
              style={{ cursor:'pointer'}}
            >
              <polygon
                points={getHexPoints(xc, yc, r)}
                fill={fill}
                stroke={isHovered ?'#ffffff': stroke}
                strokeWidth={isHovered ? 3 : 1.5}
                filter={isHovered ? glowFilter ||'url(#glow-yellow)': glowFilter}
                style={{ transition:'all 0.2s ease'}}
              />
              <text
                x={xc}
                y={yc - 4}
                className="hex-label"
                textAnchor="middle"
                style={{
                  fill: isHovered ?'#ffffff':'var(--ink-primary)',
                  fontSize:'9px',
                  fontWeight: 600,
                  pointerEvents:'none',
                  letterSpacing:'0.02em',
                  transition:'fill 0.2s'
                }}
              >
                {ward.name.split('')[0]}
              </text>
              <text
                x={xc}
                y={yc + 10}
                className="hex-sublabel"
                textAnchor="middle"
                style={{
                  fill: isHovered ?'#ffffff':'var(--ink-muted)',
                  fontSize:'8px',
                  fontWeight: 500,
                  pointerEvents:'none',
                  transition:'fill 0.2s'
                }}
              >Risk: {Math.round(Math.min((riskIndex / 12) * 100, 100))}%
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
    title:'Total Issues Count',
    text:'Measures the absolute volume of unique municipal issues recorded in the database, including both active and resolved tickets.',
    formula:'N_{total} = \\sum_{t \\in Firestore} 1'
  },
  resolved_7d: {
    title:'Resolution Throughput (7 Days)',
    text:'Measures the rate of ticket closures within the last 7 days. Highlights recent municipal productivity and cleanup efficiency.',
    formula:'N_{resolved\\_7d} = \\sum_{t \\in Tickets} \\mathbb{I}(t.status = \\text{"resolved"} \\land \\Delta t_{resolved} \\le 7d)'
  },
  avg_resolution: {
    title:'Average Speed of Resolution',
    text:'Calculates the average hours elapsed between ticket creation and successful resolution status. Helps audit department SLAs.',
    formula:'\\mu_{hours} = \\frac{1}{N} \\sum_{i=1}^{N} (\\text{resolved\\_at}_i - \\text{created\\_at}_i)\\ \\text{in hours}'
  },
  active_reporters: {
    title:'Unique Citizen Contributors',
    text:'Counts the unique citizen user accounts that have reported issues within the last 7 days. Measures civic engagement density.',
    formula:'N_{reporters} = |\\{ reporter\\_id \\mid \\Delta t_{created} \\le 7d \\}|'
  },
  sla_risk: {
    title:'Tickets Breaching SLA Deadline',
    text:'Identifies unresolved issues where the current time exceeds the calculated SLA deadline (dependent on category defaults, e.g. 72h).',
    formula:'N_{breached} = \\sum_{t \\in Active} \\mathbb{I}(\\text{now} > \\text{sla\\_deadline}_t)'
  },
  category: {
    title:'Issues Distribution by Category',
    text:'Categorizes incoming tickets using Gemini text/media zero-shot classification model. Each ticket is mapped to a primary municipal department (Roads, Water, Electricity, Sanitation) based on semantic categorizations.',
    formula:'Count(c) = \\sum_{t \\in Tickets} \\mathbb{I}(t.category = c)'
  },
  status: {
    title:'Ticket Status Distribution',
    text:'Tracks active issues through their operational lifecycle: reported (initial state) -> verified (minimum 3 community confirmation votes) -> resolved (validated resolved state) -> reopened (new reported anomalies).',
    formula:'\\text{Ratio}(s) = \\frac{\\sum \\mathbb{I}(t.status = s)}{N_{total}} \\times 100%'
  },
  velocity: {
    title:'Resolution Velocity Trend',
    text:'Calculates the daily completion rate of resolved tickets over the last 30 days to measure municipal response efficiency and detect queue blockages.',
    formula:'V(d) = \\text{CountResolved}(d)\\ \\text{for } d \\in [1, 30]'
  },
  departments: {
    title:'Department Performance Audit',
    text:'Tracks the average SLA response time and resolution throughput for each municipal department. Performance rankings are sorted dynamically by resolution rate descending.',
    formula:'\\text{Rate}(dept) = \\frac{N_{resolved}}{N_{assigned}} \\times 100\\%'
  },
  recurrence: {
    title:'Weibull Recurrence Risk Forecast',
    text:'Forecasts the likelihood of an issue recurring in a specific ward within the next 14 days using a Weibull survival analysis model fitted on historical inter-arrival resolution intervals.',
    formula:'P(R) = \\frac{F(t_0 + 336) - F(t_0)}{1 - F(t_0)}\\ \\text{where } F(t) = 1 - e^{-\\left(\\frac{t}{\\lambda}\\right)^k}'
  },
  ward_heatmap: {
    title:'Localized Ward Hotspot Density',
    text:'Measures ward severity by weighting active issues (w = 1.5) and critical priority issues (w = 3.0) to calculate a localized civic risk index.',
    formula:'\\text{Risk Index} = (\\text{Active} \\times 1.5) + (\\text{High Urgency} \\times 3.0)'
  },
  verification_confidence: {
    title:'Verification Confidence Index',
    text:'Consolidates AI confidence, reporter trust, nearby report density, and community upvotes into a composite score representing system-wide data accuracy.',
    formula:'\\text{Avg V} = \\frac{1}{|T_{active}|} \\sum_{t \\in T_{active}} (0.40 \\cdot c_{ai} + 0.20 \\cdot t_{rep} + 0.20 \\cdot e_{near} + 0.20 \\cdot v_{comm}) \\times 100'
  },
  cluster_density: {
    title:'Hotspot Cluster Density',
    text:'Measures the proportion of active reports that reside inside a localized DBSCAN geospatial cluster, indicating collective regional issues.',
    formula:'\\text{Cluster Ratio} = \\frac{\\sum_{t \\in T} \\mathbb{I}(t.cluster\\_detail.found = \\text{true})}{|T|} \\times 100\\%'
  },
  sla_breach_risk: {
    title:'SLA Breach Risk (Average)',
    text:'The average probability of open tickets breaching their SLA resolution time limit, calculated using the Weibull probability of breach.',
    formula:'\\bar{P}(SLA) = \\frac{1}{|T_{active}|} \\sum_{t \\in T_{active}} P(T_{breach} < \\text{now} \\mid t)'
  },
  recurrence_risk: {
    title:'Peak Recurrence Risk Forecast',
    text:'The highest 14-day recurrence probability predicted across all wards and categories, fitted using a Weibull hazard function on historical arrival rates.',
    formula:'\\max_{w, c} P_w(R_c) = \\max_{w, c} \\left[ 1 - e^{-\\left(\\frac{t_0 + 336}{\\lambda}\\right)^k + \\left(\\frac{t_0}{\\lambda}\\right)^k} \\right]'
  },
  ward_health_score: {
    title:'Guild Ward Health Score',
    text:'The average health index across all municipal wards. Each ward health is 100 minus the mean priority score of active tickets in that ward.',
    formula:'\\bar{H}_{ward} = \\frac{1}{|W|} \\sum_{w \\in W} \\left(100 - \\frac{1}{|T_{w}|} \\sum_{t \\in T_w} \\text{priority\\_score}_t\\right)'
  },
  dept_accountability: {
    title:'Department Guild Accountability',
    text:'Average success rate of resolution throughput across all departments, tracking the percent of assigned tickets successfully resolved.',
    formula:'\\bar{R}_{dept} = \\frac{1}{|D|} \\sum_{d \\in D} \\frac{N_{resolved, d}}{N_{total, d}} \\times 100\\%'
  }
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemAnim = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type:'spring', stiffness: 300, damping: 24 } },
};
function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recurrence, setRecurrence] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRisk, setExpandedRisk] = useState(null);
  const [activeInfo, setActiveInfo] = useState({});
  const [selectedWardName, setSelectedWardName] = useState(null);
  const [viewMode, setViewMode] = useState('map');
  const [dashboardTab, setDashboardTab] = useState('overview');
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
      fetchAssets().catch(() => []),
    ]).then(([s, r, t, a]) => {
      if (s === null) toast('Failed to load dashboard stats','error');
      if (r === null) toast('Failed to load recurrence risk','error');
      setStats(s);
      setRecurrence(Array.isArray(r) ? r : r?.risks || []);
      setTickets(Array.isArray(t) ? t : t.tickets || []);
      setAssets(Array.isArray(a) ? a : []);
      setLoading(false);
    });
  }, [toast]);

  const wardMetrics = useMemo(() => {
    const metrics = {};
    for (const ticket of tickets) {
      if (!ticket.ward) continue;
      if (!metrics[ticket.ward]) {
        metrics[ticket.ward] = { name: ticket.ward, active: 0, total: 0, highUrgency: 0, maxRisk: 0, severityIndex: 0 };
      }
      metrics[ticket.ward].total++;
      if (ticket.status !=='resolved') {
        metrics[ticket.ward].active++;
        if (ticket.priority_score > 70) {
          metrics[ticket.ward].highUrgency++;
        }
      }
    }
    for (const name in metrics) {
      metrics[name].severityIndex = (metrics[name].active * 1.5) + (metrics[name].highUrgency * 3.0);
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
      if (!t.sla_deadline || t.status ==='resolved') return false;
      return new Date(t.sla_deadline).getTime() < now;
    }).length;
  }, [tickets]);

  const createdSpark = useMemo(() => build7dSpark(tickets,'created_at'), [tickets]);
  const resolvedSpark = useMemo(() => build7dSpark(tickets,'resolved_at'), [tickets]);
  const velocity = useMemo(() => buildVelocity30d(tickets), [tickets]);

  const mathMetrics = useMemo(() => {
    // 1. Verification Confidence
    const verifiedTickets = tickets.filter(t => t.verification_score !== undefined);
    const avgVerification = verifiedTickets.length > 0
      ? Math.round(verifiedTickets.reduce((sum, t) => sum + (t.verification_score || 0), 0) / verifiedTickets.length)
      : 75; // fallback
    const verificationParams = {
      n: verifiedTickets.length,
      avg: avgVerification
    };

    // 2. Cluster Density
    const clusteredCount = tickets.filter(t => t.cluster_detail?.found || (t.cluster_detail?.cluster_size && t.cluster_detail.cluster_size > 1)).length;
    const clusterDensity = tickets.length > 0 ? Math.round((clusteredCount / tickets.length) * 100) : 0;
    const clusterParams = {
      clustered: clusteredCount,
      total: tickets.length
    };

    // 3. SLA Breach Risk
    const activeTickets = tickets.filter(t => t.status !=='resolved');
    const ticketsWithSla = activeTickets.filter(t => t.sla_risk_score !== undefined);
    const avgSlaRisk = ticketsWithSla.length > 0
      ? Math.round(ticketsWithSla.reduce((sum, t) => sum + (t.sla_risk_score || 0), 0) / ticketsWithSla.length)
      : 0;
    const slaParams = {
      active: activeTickets.length,
      withSla: ticketsWithSla.length,
      avgProb: avgSlaRisk
    };

    // 4. Recurrence Risk
    const maxRecurrence = recurrence.length > 0
      ? Math.round(Math.max(...recurrence.map(r => r.probability || 0)) * 100)
      : 0;
    const peakRecurrenceRecord = recurrence.length > 0
      ? recurrence.reduce((prev, current) => ((prev.probability || 0) > (current.probability || 0)) ? prev : current, recurrence[0])
      : null;
    const recurrenceParams = {
      peak: maxRecurrence,
      ward: peakRecurrenceRecord ? peakRecurrenceRecord.ward :'N/A',
      category: peakRecurrenceRecord ? (CATEGORY_LABELS[peakRecurrenceRecord.category] || peakRecurrenceRecord.category) :'N/A'
    };

    // 5. Ward Health Score
    const wardScores = stats?.wardHealthScores ? Object.values(stats.wardHealthScores) : [];
    const avgWardHealth = wardScores.length > 0
      ? Math.round(wardScores.reduce((sum, s) => sum + s, 0) / wardScores.length)
      : 100;
    const wardEntries = stats?.wardHealthScores ? Object.entries(stats.wardHealthScores) : [];
    const minWard = wardEntries.length > 0
      ? wardEntries.reduce((prev, current) => (prev[1] < current[1] ? prev : current), wardEntries[0])
      : null;
    const wardParams = {
      avg: avgWardHealth,
      minWardName: minWard ? minWard[0] :'N/A',
      minWardScore: minWard ? minWard[1] : 100
    };

    // 6. Department Accountability
    const deptsList = stats?.deptLeaderboard || [];
    const avgDeptAccountability = deptsList.length > 0
      ? Math.round(deptsList.reduce((sum, d) => sum + (d.resolution_rate || 0), 0) / deptsList.length)
      : 0;
    const topDept = deptsList.length > 0 ? deptsList[0] : null;
    const bottomDept = deptsList.length > 1 ? deptsList[deptsList.length - 1] : null;
    const deptParams = {
      avg: avgDeptAccountability,
      topName: topDept ? topDept.name :'N/A',
      topRate: topDept ? topDept.resolution_rate : 0,
      bottomName: bottomDept ? bottomDept.name :'N/A',
      bottomRate: bottomDept ? bottomDept.resolution_rate : 0
    };

    return [
      {
        label:'VERIFICATION CONFIDENCE',
        value: avgVerification,
        suffix:'%',
        panelKey:'verification_confidence',
        params:`N = ${verificationParams.n} tickets, Avg Score = ${verificationParams.avg}%`
      },
      {
        label:'CLUSTER DENSITY',
        value: clusterDensity,
        suffix:'%',
        panelKey:'cluster_density',
        params:`Clustered = ${clusterParams.clustered}, Total = ${clusterParams.total}`
      },
      {
        label:'SLA BREACH RISK',
        value: avgSlaRisk,
        suffix:'%',
        panelKey:'sla_breach_risk',
        danger: avgSlaRisk > 50,
        params:`Active = ${slaParams.active}, With SLA = ${slaParams.withSla}, Avg Prob = ${slaParams.avgProb}%`
      },
      {
        label:'RECURRENCE RISK',
        value: maxRecurrence,
        suffix:'%',
        panelKey:'recurrence_risk',
        warning: maxRecurrence > 50,
        params:`Peak = ${recurrenceParams.peak}%, Ward = ${recurrenceParams.ward}, Cat = ${recurrenceParams.category}`
      },
      {
        label:'WARD HEALTH SCORE',
        value: avgWardHealth,
        suffix:'/100',
        panelKey:'ward_health_score',
        success: avgWardHealth > 75,
        params:`Avg Health = ${wardParams.avg}%, Min Ward = ${wardParams.minWardName} (${wardParams.minWardScore}%)`
      },
      {
        label:'DEPT ACCOUNTABILITY',
        value: avgDeptAccountability,
        suffix:'%',
        panelKey:'dept_accountability',
        params:`Top = ${deptParams.topName} (${deptParams.topRate}%), Bottom = ${deptParams.bottomName} (${deptParams.bottomRate}%)`
      }
    ];
  }, [tickets, recurrence, stats]);

  const categoryData = {
    labels: catKeys.map(k =>CATEGORY_LABELS[k] || capitalize(k)),
    datasets: [{
      data: catKeys.map(k => categoryBreakdown[k]),
      backgroundColor: resolvePalette(catKeys.map(k =>CATEGORY_COLORS[k] ||'var(--accent)')),
      borderRadius: 0,
      borderSkipped: false,
    }],
  };

  const statusData = {
    labels: statusKeys.map(k => capitalize(k)),
    datasets: [{
      data: statusKeys.map(k => statusBreakdown[k]),
      backgroundColor: statusPalette(statusKeys),
      borderColor:'#15161d',
      borderWidth: 3,
      hoverOffset: 8,
    }],
  };

  const sparkConfig = (data, colorVar) => ({
    data: {
      labels: data.map((_, i) => i),
      datasets: [{ data, borderColor: resolveVar(colorVar), backgroundColor: resolveVar(colorVar), borderWidth: 2, pointRadius: 0, tension: 0, fill: false }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } }, elements: { line: { borderCapStyle:'square'} } },
  });

  const velocityData = {
    labels: velocity.map((_, i) => i === 29 ?'today':`${29 - i}d`),
    datasets: [{
      data: velocity,
      borderColor: resolveVar('var(--success)'),
      backgroundColor: (ctx) => {
        const chart = ctx.chart;
        const { ctx: c, chartArea } = chart;
        if (!chartArea) return'rgba(0,0,0,0)';
        const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        g.addColorStop(0,'rgba(99,196,139,0.35)');
        g.addColorStop(1,'rgba(99,196,139,0)');
        return g;
      },
      fill: true,
      borderWidth: 2.5,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointHoverBackgroundColor:'#ffffff',
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
    indexAxis:'y',
    plugins: { legend: { display: false } },
    scales: {
      x: { ...baseScales.x, beginAtZero: true, ticks: { precision: 0, color: TICK_COLOR } },
      y: { ...baseScales.y, grid: { display: false }, ticks: { color: TICK_COLOR } },
    },
  };

  const statusOpts = {
    ...baseChartProps,
    cutout:'68%',
    plugins: {
      legend: {
        position:'bottom',
        labels: { color: TICK_COLOR, padding: 14, usePointStyle: true, pointStyle:'circle', boxWidth: 8 },
      },
    },
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-5"aria-busy="true"aria-label="Loading dashboard">
        <div className="kpi-row">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton" style={{ height: 110, borderRadius: 0 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 300, borderRadius: 0 }} />
      </div>
    );
  }  const kpis = [
    { label:'ISSUES IN JOURNAL', value: stats?.total, spark: createdSpark, sparkColor:'var(--accent)', panelKey:'total_issues'},
    { label:'ISSUES RESOLVED', value: stats?.resolvedThisWeek, spark: resolvedSpark, sparkColor:'var(--success)', panelKey:'resolved_7d', success: true },
    { label:'AVG RESOLUTION', value: stats?.avgResolutionHours != null ? Math.round(stats.avgResolutionHours) : null, suffix:'h', panelKey:'avg_resolution'},
    { label:'SENTINELS ACTIVE', value: stats?.activeReporters, panelKey:'active_reporters'},
    { label:'EXPIRING ISSUES', value: slaAtRisk, danger: slaAtRisk > 0, panelKey:'sla_risk'},
  ];

  return (
    <PageShell 
      title="Department Operations Ledger"
      subtitle={`${tickets.length} ISSUES TRACKED · LIVE`}
    >

      {/* Modern RPG Sub-Tabs */}
      <div style={{ display:'flex', gap:'6px', borderBottom:'2px solid var(--border)', paddingBottom:'var(--space-3)'}}>
        {[
          { id:'overview', label:'City Overview'},
          { id:'infrastructure', label:'Infrastructure'},
          { id:'algorithms', label:'Algorithmic Engine'}
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setDashboardTab(tab.id)}
            className="font-pixel"
            style={{
              padding:'10px 16px',
              fontSize:'0.65rem',
              border:'2px solid #000',
              borderRadius: 0,
              background: dashboardTab === tab.id ?'var(--accent)':'var(--bg-secondary)',
              color: dashboardTab === tab.id ?'#000':'var(--ink-secondary)',
              boxShadow: dashboardTab === tab.id ?'none':'2px 2px 0 rgba(0,0,0,0.5)',
              cursor:'pointer',
              fontWeight: 800,
              textTransform:'uppercase'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: CITY OVERVIEW */}
      {dashboardTab ==='overview'&& (
        <>
          <div style={{ display:'flex', justifyContent:'flex-start', marginBottom:'var(--space-1)', marginTop:'var(--space-2)'}}>
            <span className="font-pixel text-muted" style={{ fontSize:'0.5rem', textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--ink-muted)'}}>
              [  City-Wide Summary Aggregates ]
            </span>
          </div>
          <div className="grafana-kpi-grid">
            {kpis.map((kpi) => {
              const isOpen = activeInfo[kpi.panelKey];
              return (
                <motion.div
                  key={kpi.label}
                  variants={itemAnim}
                  className={`grafana-kpi-card rpg-panel-sandstone ${kpi.danger ?'danger': kpi.success ?'success':''}`}
                >
                  <div className="flex flex-col gap-1" style={{ height:'100%', justifyContent:'space-between'}}>
                    <div className="flex items-center justify-between">
                      <span className="grafana-kpi-title">{kpi.label}</span>
                      <button
                        className="btn-info-icon"
                        onClick={() => toggleInfo(kpi.panelKey)}
                        style={{ width: 14, height: 14, fontSize:'0.65rem'}}
                        aria-label={`Formula details for ${kpi.label}`}
                      >
                        ⓘ
                      </button>
                    </div>
                    {isOpen ? (
                      <div className="text-xs text-muted rpg-scrollbar" style={{ lineHeight: 1.3, animation:'slideDown 0.2s ease-out', overflowY:'auto', maxHeight:'68px'}}>
                        <span style={{ color:'var(--accent)', fontWeight: 600 }}>{EXPLANATIONS[kpi.panelKey].title}:</span>{''}
                        {EXPLANATIONS[kpi.panelKey].text}
                        <div className="formula-box" style={{ marginTop:'4px'}}>
                          <Latex math={EXPLANATIONS[kpi.panelKey].formula} block />
                        </div>
                      </div>
                    ) : (
                      <div className="grafana-kpi-val">
                        <CountUp to={kpi.value} suffix={kpi.suffix ||''} />
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

          {/* Grafana-style Hotspot Heatmap Panel with Hexmap Toggle */}
          <motion.div variants={itemAnim} className="card rpg-panel rpg-panel-sandstone" style={{ marginBottom:'var(--space-6)', position:'relative', borderRadius: 0 }}>
            <div className="flex items-center justify-between" style={{ marginBottom:'var(--space-4)', flexWrap:'wrap', gap:'var(--space-2)'}}>
              <div className="flex items-center gap-3">
                <h3 className="font-pixel" style={{ fontSize:'0.65rem', margin: 0, color:'var(--accent)'}}>[  WARD ISSUES HEATMAP ]</h3>
                <button className="btn-info-icon" onClick={() => toggleInfo('ward_heatmap')} aria-label="Formula details for Heatmap">ⓘ</button>
                <div className="flex items-center gap-1.5" style={{ marginLeft:'var(--space-2)'}}>
                  <button 
                    className={`btn-toggle ${viewMode ==='map'?'active':''}`}
                    onClick={() => setViewMode('map')}
                  >Hexmap
                  </button>
                  <button 
                    className={`btn-toggle ${viewMode ==='list'?'active':''}`}
                    onClick={() => setViewMode('list')}
                  >Card List
                  </button>
                </div>
              </div>
              <span className="font-pixel text-muted" style={{ fontSize:'0.45rem'}}>REAL-TIME CIVIC DENSITY</span>
            </div>

            {activeInfo.ward_heatmap && (
              <div 
                className="metric-explanation-panel"
                style={{ 
                  position:'absolute', 
                  top: 0, 
                  left: 0, 
                  width:'100%', 
                  height:'100%', 
                  backgroundColor:'rgba(21, 22, 29, 0.96)', 
                  backdropFilter:'blur(4px)',
                  borderRadius: 0,
                  zIndex: 30,
                  display:'flex',
                  flexDirection:'column',
                  justifyContent:'space-between',
                  margin: 0,
                  padding:'var(--space-5)',
                  boxSizing:'border-box'
                }}
              >
                <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)'}}>
                  <div className="flex justify-between items-center">
                    <span style={{ fontSize:'0.75rem', fontWeight: 700, color:'var(--accent)', textTransform:'uppercase', letterSpacing:'0.05em'}}>Hotspot Severity Metric
                    </span>
                    <button className="btn-close-inline" onClick={() => toggleInfo('ward_heatmap')}>✕</button>
                  </div>
                  <p className="text-secondary text-xs rpg-scrollbar" style={{ lineHeight: 1.4, margin: 0, overflowY:'auto', maxHeight:'140px'}}>
                    {EXPLANATIONS.ward_heatmap.text}
                  </p>
                </div>
                <div className="formula-box" style={{ marginTop:'auto'}}>
                  <Latex math={EXPLANATIONS.ward_heatmap.formula} block />
                </div>
              </div>
            )}

            {viewMode ==='map'? (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:'var(--space-6)'}}>
                {/* Visual Hex Map Column */}
                <div style={{ padding:'var(--space-4)', background:'var(--bg-primary)', border:'1px solid var(--border-subtle)', minHeight: 380, display:'flex', flexDirection:'column', justifyContent:'center'}}>
                  <WardHexmap wardMetrics={wardMetrics} activeWard={selectedWard} setActiveWard={(w) => setSelectedWardName(w.name)} />
                </div>

                {/* Interactive Sidebar details */}
                <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)', padding:'var(--space-4)', background:'var(--bg-primary)', border:'1px solid var(--border-subtle)'}}>
                  {selectedWard ? (
                    <>
                      <div style={{ borderBottom:'2px solid var(--border)', paddingBottom:'var(--space-3)'}} className="flex flex-col gap-1">
                        <h4 className="font-pixel" style={{ margin: 0, fontSize:'12px', color:'var(--accent)', fontWeight: 600 }}>{selectedWard.name}</h4>
                        <span className="font-pixel" style={{ fontSize:'10px', color:'var(--ink-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:'4px', display:'block'}}>WARD SEVERITY STATUS</span>
                      </div>
                      
                      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)'}}>
                        <div style={{ display:'flex', justifycontent:'space-between', alignItems:'center'}}>
                          <span className="font-pixel" style={{ fontSize:'10px', color:'var(--ink-muted)'}}>ACTIVE ISSUES</span>
                          <span style={{ fontSize:'0.85rem', fontWeight: 600, color:'var(--ink-primary)'}} className="font-mono">{selectedWard.active}</span>
                        </div>
                        <div style={{ display:'flex', justifycontent:'space-between', alignItems:'center'}}>
                          <span className="font-pixel" style={{ fontSize:'10px', color:'var(--ink-muted)'}}>CRITICAL ISSUES</span>
                          <span style={{ fontSize:'0.85rem', fontWeight: 600, color: selectedWard.highUrgency > 0 ?'var(--error)':'var(--ink-primary)'}} className="font-mono">{selectedWard.highUrgency}</span>
                        </div>
                        <div style={{ display:'flex', justifycontent:'space-between', alignItems:'center'}}>
                          <span className="font-pixel" style={{ fontSize:'10px', color:'var(--ink-muted)'}}>HISTORICAL LOG</span>
                          <span style={{ fontSize:'0.85rem', fontWeight: 500, color:'var(--ink-secondary)'}} className="font-mono">{selectedWard.total}</span>
                        </div>
                      </div>

                      <div className="ward-rating-box" style={{ marginTop:'var(--space-4)'}}>
                        <div className="flex justify-between items-center" style={{ marginBottom:'6px'}}>
                          <span className="font-pixel" style={{ fontSize:'9px', color:'var(--ink-secondary)'}}>SEVERITY INDEX</span>
                          <span className="font-mono font-bold" style={{ color: getSeverityColor(selectedWard.severityIndex) }}>
                            {selectedWard.severityIndex.toFixed(2)}
                          </span>
                        </div>
                        <div className="priority-bar" style={{ height:'6px', borderRadius: 0 }}>
                          <div 
                            className="priority-bar-fill"
                            style={{ 
                              width:`${Math.min(selectedWard.severityIndex * 10, 100)}%`, 
                              background: getSeverityColor(selectedWard.severityIndex),
                              borderRadius: 0
                            }} 
                          />
                        </div>
                      </div>

                      <div style={{ marginTop:'auto', display:'flex', flexDirection:'column', gap:'6px'}}>
                        <span className="font-pixel" style={{ fontSize:'8px', color:'var(--ink-muted)'}}>MAPPED CITIZENS</span>
                        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap'}}>
                          {selectedWard.reporters?.slice(0, 5).map((repId, idx) => (
                            <span 
                              key={idx}
                              className="font-mono"
                              style={{ 
                                background:'var(--bg-secondary)', 
                                border:'1px solid var(--border-subtle)', 
                                padding:'2px 6px',
                                fontSize:'10px',
                                color:'var(--ink-secondary)'
                              }}
                            >
                              sentinel_{repId.substring(0, 5)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--ink-muted)', textAlign:'center'}}>
                      <span style={{ fontSize:'1.5rem', marginBottom:'var(--space-3)'}}></span>
                      <p className="font-pixel" style={{ fontSize:'8px', lineHeight: 1.4 }}>SELECT A WARD NODE ON THE HEX GRID TO PROJECT CRITICAL CIVIC SEVERITY DETAILS
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rpg-scrollbar" style={{ maxHeight:'420px', overflowY:'auto', border:'1px solid var(--border-subtle)'}}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.72rem'}}>
                  <thead>
                    <tr style={{ background:'var(--bg-secondary)', borderBottom:'2px solid var(--border)'}}>
                      <th className="font-pixel" style={{ padding:'12px 16px', textAlign:'left', fontSize:'0.45rem'}}>WARD REGION</th>
                      <th className="font-pixel" style={{ padding:'12px 16px', textAlign:'center', fontSize:'0.45rem'}}>ACTIVE ISSUES</th>
                      <th className="font-pixel" style={{ padding:'12px 16px', textAlign:'center', fontSize:'0.45rem'}}>CRITICAL</th>
                      <th className="font-pixel" style={{ padding:'12px 16px', textAlign:'right', fontSize:'0.45rem'}}>SEVERITY INDEX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wardMetrics.slice().sort((a,b) => b.severityIndex - a.severityIndex).map(ward => (
                      <tr 
                        key={ward.name} 
                        style={{ borderBottom:'1px solid var(--border-subtle)', cursor:'pointer', background: selectedWardName === ward.name ?'#e8a832': undefined }}
                        onClick={() => setSelectedWardName(ward.name)}
                      >
                        <td style={{ padding:'12px 16px', color:'var(--ink-primary)', fontWeight: 600 }}>{ward.name.toUpperCase()}</td>
                        <td style={{ padding:'12px 16px', textAlign:'center'}}>{ward.active}</td>
                        <td style={{ padding:'12px 16px', textAlign:'center', color: ward.highUrgency > 0 ?'var(--error)':'inherit', fontWeight: ward.highUrgency > 0 ?'bold':'normal'}}>{ward.highUrgency}</td>
                        <td style={{ padding:'12px 16px', textAlign:'right', color: getSeverityColor(ward.severityIndex), fontWeight:'bold'}}>{ward.severityIndex.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* TAB 2: INFRASTRUCTURE HEALTH & AUDIT */}
      {dashboardTab ==='infrastructure'&& (
        <>
          {/* Infrastructure Assets Health Ledger */}
          <motion.div variants={itemAnim} className="card rpg-panel rpg-panel-sandstone" style={{ marginBottom:'var(--space-6)', position:'relative', borderRadius: 0 }}>
            <div className="flex items-center justify-between" style={{ marginBottom:'var(--space-4)', flexWrap:'wrap', gap:'var(--space-2)'}}>
              <div className="flex items-center gap-3">
                <h3 className="font-pixel" style={{ fontSize:'0.65rem', margin: 0, color:'var(--accent)'}}>[  INFRASTRUCTURE ASSETS LEDGER ]</h3>
                <button className="btn-info-icon" onClick={() => toggleInfo('assets_info')} aria-label="Formula details for Assets Health">ⓘ</button>
              </div>
              <span className="font-pixel text-muted" style={{ fontSize:'0.45rem'}}>DYNAMIC INFRASTRUCTURE HEALTH STATUS</span>
            </div>

            {activeInfo.assets_info && (
              <div 
                className="metric-explanation-panel"
                style={{ 
                  position:'absolute', 
                  top: 0, 
                  left: 0, 
                  width:'100%', 
                  height:'100%', 
                  backgroundColor:'rgba(21, 22, 29, 0.96)', 
                  backdropFilter:'blur(4px)',
                  borderRadius: 0,
                  zIndex: 30,
                  display:'flex',
                  flexDirection:'column',
                  justifyContent:'space-between',
                  margin: 0,
                  padding:'var(--space-5)',
                  boxSizing:'border-box'
                }}
              >
                <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)'}}>
                  <div className="flex justify-between items-center">
                    <span style={{ fontSize:'0.75rem', fontWeight: 700, color:'var(--accent)', textTransform:'uppercase', letterSpacing:'0.05em'}}>Infrastructure Health Index
                    </span>
                    <button className="btn-close-inline" onClick={() => toggleInfo('assets_info')}>✕</button>
                  </div>
                  <p className="text-secondary text-xs rpg-scrollbar" style={{ lineHeight: 1.4, margin: 0, overflowY:'auto', maxHeight:'140px'}}>Asset Health decays dynamically when open tickets are linked to it: Critical (-30), High (-20), Medium (-10), Low (-5). Resolving tickets restores asset health.
                  </p>
                </div>
                <div className="formula-box" style={{ marginTop:'auto'}}>
                  <Latex math="H_{asset} = \max\left(0, 100 - \sum_{t \in T_{open}} \text{SeverityWeight}_t\right)"block />
                </div>
              </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'var(--space-5)'}}>
              {/* Column 1: Top Failing Assets (Health < 100) */}
              <div style={{ padding:'var(--space-3)', background:'var(--bg-primary)', border:'1px solid var(--border-subtle)'}}>
                <h4 className="font-pixel" style={{ fontSize:'0.55rem', color:'var(--error)', marginBottom:'var(--space-3)'}}>CRITICAL INFRASTRUCTURE STATUS
                </h4>
                {assets.filter(a => a.health < 100).length === 0 ? (
                  <p className="text-secondary text-xs" style={{ fontStyle:'italic'}}>All city assets check out at 100% health. Good work, Marshall.
                  </p>
                ) : (
                  <div className="rpg-scrollbar" style={{ maxHeight:'280px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'8px'}}>
                    {assets.filter(a => a.health < 100).sort((a,b) => a.health - b.health).map(asset => {
                      const color = asset.health < 60 ?'var(--error)':'var(--warning)';
                      return (
                        <div key={asset.id} style={{ borderBottom:'1px dashed var(--border-subtle)', paddingBottom:'6px', fontSize:'0.72rem'}}>
                          <div className="flex justify-between items-center" style={{ marginBottom:'4px'}}>
                            <span style={{ color:'var(--ink-primary)', fontWeight: 600 }}>{asset.name}</span>
                            <span style={{ color, fontWeight:'bold'}}>{asset.health}%</span>
                          </div>
                          <div className="flex justify-between text-xs text-muted">
                            <span>Ward: {asset.ward.toUpperCase()} · Type: {asset.type.toUpperCase()}</span>
                            <span>{asset.open_issues_count || 0} active faults</span>
                          </div>
                          <div className="priority-bar" style={{ height:'4px', marginTop:'4px', borderRadius: 0 }}>
                            <div className="priority-bar-fill" style={{ width:`${asset.health}%`, background: color, borderRadius: 0 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Column 2: Healthy Infrastructure Registry */}
              <div style={{ padding:'var(--space-3)', background:'var(--bg-primary)', border:'1px solid var(--border-subtle)'}}>
                <h4 className="font-pixel" style={{ fontSize:'0.55rem', color:'var(--success)', marginBottom:'var(--space-3)'}}>
                  ✓ STABLE INFRASTRUCTURE REGISTRY
                </h4>
                <div className="rpg-scrollbar" style={{ maxHeight:'280px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'8px'}}>
                  {assets.filter(a => a.health === 100).map(asset => (
                    <div key={asset.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px dashed var(--border-subtle)', paddingBottom:'6px', fontSize:'0.72rem'}}>
                      <div>
                        <span style={{ color:'var(--ink-secondary)'}}>{asset.name}</span>
                        <div style={{ fontSize:'0.6rem', color:'var(--ink-muted)'}}>Ward: {asset.ward.toUpperCase()} · Type: {asset.type.toUpperCase()}</div>
                      </div>
                      <span className="font-pixel" style={{ fontSize:'0.45rem', color:'var(--success)', border:'1px solid var(--success)', padding:'2px 4px'}}>OPERATIONAL</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {departments.length > 0 && (
            <motion.div variants={itemAnim} className="card rpg-panel rpg-panel-sandstone" style={{ display:'flex', flexDirection:'column', position:'relative', borderRadius: 0 }}>
              <div className="flex items-center justify-between" style={{ marginBottom:'var(--space-4)'}}>
                <div className="flex items-center gap-2">
                  <h3 className="font-pixel" style={{ fontSize:'0.65rem', margin: 0, color:'var(--accent)'}}>[  DEPARTMENT PERFORMANCE LEDGER ]</h3>
                  <button className="btn-info-icon" onClick={() => toggleInfo('departments')} aria-label="Formula details for Departments">ⓘ</button>
                </div>
                <span className="font-pixel text-muted" style={{ fontSize:'0.45rem'}}>SLA AUDIT</span>
              </div>

              {activeInfo.departments && (
                <div 
                  className="metric-explanation-panel"
                  style={{ 
                    position:'absolute', 
                    top: 0, 
                    left: 0, 
                    width:'100%', 
                    height:'100%', 
                    backgroundColor:'rgba(21, 22, 29, 0.96)', 
                    backdropFilter:'blur(4px)',
                    borderRadius: 0,
                    zIndex: 30,
                    display:'flex',
                    flexDirection:'column',
                    justifyContent:'space-between',
                    margin: 0,
                    padding:'var(--space-5)',
                    boxSizing:'border-box'
                  }}
                >
                  <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)'}}>
                    <div className="flex justify-between items-center">
                      <span style={{ fontSize:'0.75rem', fontWeight: 700, color:'var(--accent)', textTransform:'uppercase', letterSpacing:'0.05em'}}>SLA & Performance Metric
                      </span>
                      <button className="btn-close-inline" onClick={() => toggleInfo('departments')}>✕</button>
                    </div>
                    <p className="text-secondary text-xs rpg-scrollbar" style={{ lineHeight: 1.4, margin: 0, overflowY:'auto', maxHeight:'140px'}}>Computes total open issues assigned to a department, total issues successfully resolved, and average duration (speed) to resolve tickets.
                    </p>
                  </div>
                  <div className="formula-box" style={{ marginTop:'auto'}}>
                    <Latex math="\text{Avg Speed} = \frac{1}{|T_{resolved}|} \sum_{t \in T_{resolved}} (\text{ResolvedTime}_t - \text{CreatedTime}_t)"block />
                  </div>
                </div>
              )}

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th className="font-pixel" style={{ fontSize:'0.45rem'}}>DEPARTMENT NAME</th>
                      <th className="font-pixel" style={{ fontSize:'0.45rem'}}>ISSUES ASSIGNED</th>
                      <th className="font-pixel" style={{ fontSize:'0.45rem'}}>RESOLVED</th>
                      <th className="font-pixel" style={{ fontSize:'0.45rem'}}>SUCCESS RATE</th>
                      <th className="font-pixel" style={{ fontSize:'0.45rem'}}>AVG RESOLVE SPEED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((dept, i) => (
                      <tr key={dept.name} style={i === 0 ? { background:'#e8a832'} : undefined}>
                        <td className="font-medium" style={{ color:'var(--ink-primary)'}}>
                          {dept.name}{i === 0 && <span className="badge font-pixel" style={{ marginLeft:'var(--space-2)', background:'var(--rank-gold)', color:'#000', fontSize:'0.45rem', borderRadius: 0, padding:'2px 4px'}}>TOP</span>}
                        </td>
                        <td>{dept.total}</td>
                        <td>{dept.resolved}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold font-mono" style={{ color: dept.resolution_rate > 80 ?'var(--success)': dept.resolution_rate > 50 ?'var(--warning)':'var(--error)'}}>
                              {dept.resolution_rate}%
                            </span>
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
        </>
      )}

      {/* TAB 3: ALGORITHMIC ENGINE */}
      {dashboardTab ==='algorithms'&& (
        <>
          <div className="flex items-center justify-between" style={{ marginTop:'var(--space-2)'}}>
            <div className="flex items-center gap-3">
              <h2 className="font-pixel" style={{ fontSize:'13px', color:'var(--accent)', margin: 0 }}>Multi-Agent Mathematical Engine</h2>
              <span className="font-pixel text-muted" style={{ fontSize:'0.5rem', textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--ink-muted)'}}>
                [  City-Wide Averages ]
              </span>
            </div>
            <span className="font-pixel text-muted" style={{ fontSize:'10px'}}>6 CORE ALGORITHMIC SCENARIOS</span>
          </div>

          <div className="grafana-kpi-grid">
            {mathMetrics.map((kpi) => {
              const isOpen = activeInfo[kpi.panelKey];
              return (
                <motion.div
                  key={kpi.label}
                  variants={itemAnim}
                  className={`grafana-kpi-card rpg-panel-sandstone ${kpi.danger ?'danger': kpi.warning ?'warning': kpi.success ?'success':''}`}
                >
                  <div className="flex flex-col gap-1" style={{ height:'100%', justifyContent:'space-between'}}>
                    <div className="flex items-center justify-between">
                      <span className="grafana-kpi-title" style={{ fontSize:'10px', letterSpacing:'0.05em'}}>{kpi.label}</span>
                      <button
                        className="btn-info-icon"
                        onClick={() => toggleInfo(kpi.panelKey)}
                        style={{ width: 14, height: 14, fontSize:'0.65rem'}}
                        aria-label={`Formula details for ${kpi.label}`}
                      >
                        ⓘ
                      </button>
                    </div>
                    {isOpen ? (
                      <div className="text-xs text-muted rpg-scrollbar" style={{ lineHeight: 1.3, animation:'slideDown 0.2s ease-out', overflowY:'auto', maxHeight:'72px'}}>
                        <span style={{ color:'var(--accent)', fontWeight: 600, fontSize:'11px'}}>{EXPLANATIONS[kpi.panelKey].title}:</span>{''}
                        <span style={{ fontSize:'11px'}}>{EXPLANATIONS[kpi.panelKey].text}</span>
                        <div className="formula-box" style={{ marginTop:'4px', padding:'2px', background:'rgba(0,0,0,0.2)'}}>
                          <Latex math={EXPLANATIONS[kpi.panelKey].formula} block />
                        </div>
                        <div style={{ marginTop:'4px', fontSize:'10px', color:'var(--accent)', borderTop:'1px dashed var(--border-subtle)', paddingTop:'2px'}}>
                          <strong>Parameters:</strong> {kpi.params}
                        </div>
                      </div>
                    ) : (
                      <div className="grafana-kpi-val" style={{ fontSize:'1.2rem'}}>
                        {kpi.isFloat ? (
                          <span className="font-mono">{kpi.value.toFixed(2)}</span>
                        ) : (
                          <CountUp to={kpi.value} suffix={kpi.suffix ||''} />
                        )}
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
              title="[  ISSUE CATEGORIES ]"
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
              title="[  ISSUE LIFECYCLE ]"
              subtitle="lifecycle"
              panelKey="status"
              activeInfo={activeInfo}
              onToggleInfo={toggleInfo}
              explanation={EXPLANATIONS.status.text}
              formula={EXPLANATIONS.status.formula}
            >
              <div style={{ position:'relative', width:'100%', height:'100%'}}>
                <Doughnut data={statusData} options={statusOpts} />
                <div className="doughnut-center-label">
                  <span className="doughnut-center-val">{stats?.total || 0}</span>
                  <span className="doughnut-center-lbl font-pixel" style={{ fontSize:'0.45rem', marginTop:'4px'}}>ISSUE LEDGER</span>
                </div>
              </div>
            </InteractivePanel>
          </div>

          <InteractivePanel
            title="[  DEPARTMENT DISPATCH VELOCITY ]"
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

          {recurrence.length > 0 && (
            <motion.div variants={itemAnim} className="card rpg-panel rpg-panel-sandstone" style={{ display:'flex', flexDirection:'column', position:'relative', borderRadius: 0, marginTop:'var(--space-6)'}}>
              <div className="flex items-center justify-between" style={{ marginBottom:'var(--space-4)'}}>
                <div className="flex items-center gap-2">
                  <h3 className="font-pixel" style={{ fontSize:'0.65rem', margin: 0, color:'var(--accent)'}}>[  RECURRENCE FORECAST ORACLE ]</h3>
                  <button className="btn-info-icon" onClick={() => toggleInfo('recurrence')} aria-label="Formula details for Recurrence Risk">ⓘ</button>
                </div>
                <span className="font-pixel text-muted" style={{ fontSize:'0.45rem'}}>WEIBULL ANALYSIS</span>
              </div>

              {activeInfo.recurrence && (
                <div 
                  className="metric-explanation-panel"
                  style={{ 
                    position:'absolute', 
                    top: 0, 
                    left: 0, 
                    width:'100%', 
                    height:'100%', 
                    backgroundColor:'rgba(21, 22, 29, 0.96)', 
                    backdropFilter:'blur(4px)',
                    borderRadius: 0,
                    zIndex: 30,
                    display:'flex',
                    flexDirection:'column',
                    justifyContent:'space-between',
                    margin: 0,
                    padding:'var(--space-5)',
                    boxSizing:'border-box'
                  }}
                >
                  <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)'}}>
                    <div className="flex justify-between items-center">
                      <span style={{ fontSize:'0.75rem', fontWeight: 700, color:'var(--accent)', textTransform:'uppercase', letterSpacing:'0.05em'}}>Weibull Forecast Logic
                      </span>
                      <button className="btn-close-inline" onClick={() => toggleInfo('recurrence')}>✕</button>
                    </div>
                    <p className="text-secondary text-xs rpg-scrollbar" style={{ lineHeight: 1.4, margin: 0, overflowY:'auto', maxHeight:'180px'}}>
                      {EXPLANATIONS.recurrence.text}
                    </p>
                  </div>
                  <div className="formula-box" style={{ marginTop:'auto'}}>
                    <Latex math={EXPLANATIONS.recurrence.formula} block />
                  </div>
                </div>
              )}

              <div className="method-banner" style={{ marginBottom:'var(--space-4)'}}>
                <span className="font-pixel" style={{ color:'var(--accent)', fontWeight: 700, fontSize:'0.55rem'}}>WEIBULL SURVIVAL MODEL</span>
                <span style={{ marginLeft:'6px'}}>· forecasting 14-day recurrence probability from inter-arrival intervals</span>
              </div>
              <div className="flex flex-col gap-3">
                {recurrence.slice(0, 10).map((item, i) => {
                  const key =`${item.ward}-${item.category}-${i}`;
                  const isOpen = expandedRisk === key;
                  const color = item.probability > 0.7 ?'var(--error)': item.probability > 0.4 ?'var(--warning)':'var(--success)';
                  return (
                    <div key={key}>
                      <div className="recurrence-row" onClick={() => setExpandedRisk(isOpen ? null : key)}>
                        <div className="flex items-center gap-3">
                          <span className="bullet font-pixel" style={{ color }}>{isOpen ?'▼':'▶'}</span>
                          <span style={{ color:'var(--ink-primary)', fontWeight: 600 }}>{item.category.replace('_','').toUpperCase()}</span>
                          <span style={{ color:'var(--ink-muted)'}}>in {item.ward.toUpperCase()}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="badge font-pixel" style={{ background: color, color:'#000', fontSize:'9px', borderRadius: 0, padding:'2px 6px'}}>
                            {Math.round(item.probability * 100)}% RISK
                          </span>
                        </div>
                      </div>
                      
                      {isOpen && (
                        <motion.div 
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="recurrence-detail-box"
                        >
                          <p style={{ margin:'0 0 var(--space-4) 0', color:'var(--ink-secondary)', fontSize:'0.72rem', lineHeight: 1.4 }}>
                            <strong>Analysis:</strong> {item.recommendedAction}
                          </p>
                          <div className="flex flex-wrap gap-6">
                            <div className="flex flex-col gap-4" style={{ flex: '1 1 120px', minWidth: 0 }}>
                              <div className="flex flex-col gap-1">
                                <span className="label font-pixel" style={{ fontSize:'0.45rem'}}>SCALE FACTOR (λ)</span>
                                <span className="font-mono text-base font-semibold">{item.lambda}h</span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="label font-pixel" style={{ fontSize:'0.45rem'}}>SHAPE METRIC (k)</span>
                                <span className="font-mono text-base font-semibold">{item.k}</span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="label font-pixel" style={{ fontSize:'0.45rem'}}>LAST RESOLVED</span>
                                <span className="font-mono text-sm font-medium">
                                  {item.lastResolved ? new Date(item.lastResolved).toLocaleDateString() :'—'}
                                </span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="label font-pixel" style={{ fontSize:'0.45rem'}}>ELAPSED TIME</span>
                                <span className="font-mono text-sm font-medium text-secondary">
                                  {item.lastResolved 
                                    ?`${Math.round(Math.max((new Date() - new Date(item.lastResolved)) / 3600000, 0))} hours`
                                    :'—'}
                                </span>
                              </div>
                            </div>
                            <div style={{ flex: '1 1 200px', minWidth: 0, height: 180 }}>
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
        </>
      )}
    </PageShell>
  );
}

function InteractivePanel({ title, subtitle, panelKey, activeInfo, onToggleInfo, explanation, formula, children, height = 280 }) {
  const isOpen = activeInfo[panelKey];
  return (
    <motion.div 
      variants={itemAnim} 
      className="card rpg-panel rpg-panel-sandstone chart-card"
      style={{ display:'flex', flexDirection:'column', position:'relative', borderRadius: 0 }}
    >
      <div className="chart-card-header" style={{ marginBottom:'var(--space-3)'}}>
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
            position:'absolute', 
            top: 0, 
            left: 0, 
            width:'100%', 
            height:'100%', 
            backgroundColor:'rgba(21, 22, 29, 0.96)', 
            backdropFilter:'blur(4px)',
            borderRadius: 0,
            zIndex: 30,
            display:'flex',
            flexDirection:'column',
            justifyContent:'space-between',
            margin: 0,
            padding:'var(--space-5)',
            boxSizing:'border-box'
          }}
        >
          <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)'}}>
            <div className="flex justify-between items-center">
              <span style={{ fontSize:'0.75rem', fontWeight: 700, color:'var(--accent)', textTransform:'uppercase', letterSpacing:'0.05em'}}>Calculation & Logic
              </span>
              <button className="btn-close-inline" onClick={() => onToggleInfo(panelKey)}>✕</button>
            </div>
            <p className="text-secondary text-xs rpg-scrollbar" style={{ lineHeight: 1.4, margin: 0, overflowY:'auto', maxHeight:'140px'}}>
              {explanation}
            </p>
          </div>
          {formula && (
            <div className="formula-box" style={{ marginTop:'auto'}}>
              <Latex math={formula} block />
            </div>
          )}
        </div>
      )}

      <div className="chart-card-body chart-card-body-parchment" style={{ height, flex: 1, minHeight: 0 }}>
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
        label:'Weibull CDF',
        data: points,
        borderColor: resolveVar('var(--accent)'),
        backgroundColor:'rgba(201,163,90,0.08)',
        fill: true,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHitRadius: 10,
        tension: 0,
      },
      {
        label:'Current Status Line',
        data: [
          { x: currentX, y: 0 },
          { x: currentX, y: currentY }
        ],
        borderColor: currentY > 70 ?'var(--error)': currentY > 40 ?'var(--warning)':'var(--success)',
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
      },
      {
        label:'Current Risk State',
        data: [{ x: currentX, y: currentY }],
        borderColor:'#ffffff',
        backgroundColor: currentY > 70 ?'var(--error)': currentY > 40 ?'var(--warning)':'var(--success)',
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
            return`T = ${item.parsed.x} hours since resolution`;
          },
          label: (item) => {
            if (item.datasetIndex === 2) {
              return`Current State: ${item.parsed.y.toFixed(1)}% risk`;
            }
            return`CDF Recurrence Risk: ${item.parsed.y.toFixed(1)}%`;
          }
        }
      }
    },
    scales: {
      x: {
        type:'linear',
        grid: {
          color: SANDSTONE_GRID_COLOR,
          drawBorder: false,
        },
        ticks: {
          callback: (value) =>`${value}h`,
          maxTicksLimit: 6,
          color: SANDSTONE_TICK_COLOR,
        }
      },
      y: {
        type:'linear',
        min: 0,
        max: 100,
        grid: {
          color: SANDSTONE_GRID_COLOR,
          drawBorder: false,
        },
        ticks: {
          callback: (value) =>`${value}%`,
          maxTicksLimit: 5,
          color: SANDSTONE_TICK_COLOR,
        }
      }
    }
  };

  return (
    <div className="flex flex-col gap-2" style={{ height:'100%'}}>
      <span className="label">Weibull CDF · P(recurrence) Curve</span>
      <div className="chart-card-body-parchment" style={{ flex: 1, minHeight: 140 }}>
        <Line data={data} options={opts} />
      </div>
    </div>
  );
}

export default DashboardPage;
