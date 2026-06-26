import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchTickets, fetchRecurrenceRisk } from '../services/api';
import { useSSE } from '../hooks/useSSE';
import { useToast } from '../hooks/useToast.jsx';
import { CATEGORY_LABELS, CATEGORY_COLORS, WARD_LIST, WARD_CENTERS } from '../utils/constants';
import { timeAgo, capitalize } from '../utils/formatters';
import ConfigurableMap from '../components/map/ConfigurableMap';

const LAYERS = [
  { key: 'reports', label: 'ACTIVE ISSUES' },
  { key: 'verified', label: 'VERIFIED ISSUES' },
  { key: 'clusters', label: 'ISSUE CLUSTERS' },
  { key: 'sla', label: 'SLA BREACH RISK' },
  { key: 'recurrence', label: 'COMMUNITY HOTSPOTS' },
];



const haversineApprox = (a, b) => {
  const R = 6371000;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const lat1 = a[0] * Math.PI / 180;
  const lat2 = b[0] * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

function HomePage() {
  const [tickets, setTickets] = useState([]);
  const [recurrence, setRecurrence] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', category: '', ward: '' });
  const [activeTicketId, setActiveTicketId] = useState(null);
  const [map, setMap] = useState(null);
  const [layer, setLayer] = useState('reports');
  const mapProvider = import.meta.env.VITE_MAP_PROVIDER || 'maps';
  const { events } = useSSE();
  const { toast } = useToast();
  const navigate = useNavigate();

  const feedRef = useRef(null);
  const insightsRef = useRef(null);
  const scrollFeed = (direction) => {
    if (feedRef.current) {
      const scrollAmount = 180;
      feedRef.current.scrollBy({
        top: direction === 'up' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    setLoading(true);
    const active = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) active[k] = v; });
    fetchTickets(active)
      .then(data => setTickets(Array.isArray(data) ? data : data.tickets || []))
      .catch(() => { setTickets([]); toast('Failed to load tickets', 'error'); })
      .finally(() => setLoading(false));
  }, [filters, toast]);

  useEffect(() => {
    fetchRecurrenceRisk()
      .then(data => setRecurrence(Array.isArray(data) ? data : data?.risks || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/missions')
      .then(res => res.json())
      .then(data => setMissions(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (events.length === 0) return;
    const lastEvent = events[events.length - 1];

    if (lastEvent.type === 'ticket_created') {
      setTickets(prev => {
        const ticket = lastEvent.data;
        if (!ticket || prev.some(t => t.id === ticket.id)) return prev;
        if (filters.status && ticket.status !== filters.status) return prev;
        if (filters.category && ticket.category !== filters.category) return prev;
        if (filters.ward && ticket.ward !== filters.ward) return prev;
        toast('New report received', 'success');
        return [ticket, ...prev];
      });
    } else if (lastEvent.type === 'ticket_updated') {
      setTickets(prev =>
        prev.map(t => {
          if (t.id !== lastEvent.data.ticket_id) return t;
          const updatedFields = {};
          if (lastEvent.data.event === 'escalated') {
            updatedFields.status = 'in_progress';
          }
          if (lastEvent.data.status) updatedFields.status = lastEvent.data.status;
          // Always merge priority_score if present and valid
          if (lastEvent.data.priority_score != null && !isNaN(lastEvent.data.priority_score)) {
            updatedFields.priority_score = lastEvent.data.priority_score;
          }
          return { ...t, ...updatedFields };
        })
      );
    } else if (lastEvent.type === 'verification_recorded') {
      setTickets(prev =>
        prev.map(t => {
          if (t.id !== lastEvent.data.ticket_id) return t;
          let status = t.status;
          const { up, down } = lastEvent.data;
          if (up >= 3 && t.status === 'reported') status = 'verified';
          if (up >= 5 && t.status === 'resolved') status = 'reopened';
          if (down >= 5 && t.status !== 'resolved') status = 'resolved';
          return { ...t, verification_up: up, verification_down: down, status };
        })
      );
    }
  }, [events, filters, toast]);

  const handleFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
  const handleHover = (ticket) => {
    setActiveTicketId(ticket?.id || null);
    if (map && ticket?.lat && ticket?.lng) {
      if (mapProvider === 'maps') {
        map.panTo({ lat: Number(ticket.lat), lng: Number(ticket.lng) });
        map.setZoom(15);
      } else {
        map.flyTo([Number(ticket.lat), Number(ticket.lng)], 15, { duration: 1.2, easeLinearity: 0.25 });
      }
    }
  };
  const handleCardKey = (e, ticket) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/ticket/${ticket.id}`); }
  };

  const clusterGroups = useMemo(() => {
    const groups = [];
    const seen = new Set();
    for (const t of tickets) {
      if (seen.has(t.id) || t.status === 'resolved' || !t.lat || !t.lng) continue;
      const nearby = tickets.filter(o =>
        o.id !== t.id && !seen.has(o.id) && o.category === t.category &&
        o.lat && o.lng && haversineApprox([t.lat, t.lng], [o.lat, o.lng]) < 500
      );
      if (nearby.length > 0) {
        const group = [t, ...nearby];
        group.forEach(g => seen.add(g.id));
        const lat = group.reduce((s, g) => s + g.lat, 0) / group.length;
        const lng = group.reduce((s, g) => s + g.lng, 0) / group.length;
        groups.push({ lat, lng, category: t.category, count: group.length, id: t.id });
      }
    }
    return groups;
  }, [tickets]);

  const slaByWard = useMemo(() => {
    const now = Date.now();
    const counts = {};
    for (const t of tickets) {
      if (!t.sla_deadline || !t.ward) continue;
      if (!counts[t.ward]) counts[t.ward] = { total: 0, breached: 0 };
      counts[t.ward].total++;
      if (t.status !== 'resolved' && new Date(t.sla_deadline).getTime() < now) counts[t.ward].breached++;
    }
    return counts;
  }, [tickets]);

  const severityClass = (s) => `badge badge-outline badge-severity-${(s || 'low').toLowerCase()}`;
  const statusClass = (s) => `badge badge-outline badge-status-${(s || 'reported').toLowerCase().replace(/ /g, '-')}`;
  const activeIssues = useMemo(() => tickets.filter(t => t.status !== 'resolved'), [tickets]);
  const resolvedCount = useMemo(() => tickets.filter(t => t.status === 'resolved').length, [tickets]);
  const activeCount = useMemo(() => activeIssues.length, [activeIssues]);
  const criticalCount = useMemo(() => activeIssues.filter(t => t.priority_score > 70).length, [activeIssues]);
  const slaBreachCount = useMemo(() => {
    const now = Date.now();
    return activeIssues.filter(t => t.sla_deadline && new Date(t.sla_deadline).getTime() < now).length;
  }, [activeIssues]);

  const communityHealthIndex = useMemo(() => {
    if (tickets.length === 0) return 100;
    const activePenalty = activeCount * 1.5;
    const criticalPenalty = criticalCount * 3.0;
    const slaPenalty = slaBreachCount * 5.0;
    const rawIndex = 100 - (activePenalty + criticalPenalty + slaPenalty);
    return Math.max(10, Math.min(100, Math.round(rawIndex)));
  }, [tickets.length, activeCount, criticalCount, slaBreachCount]);

  const urgentTickets = criticalCount;
  const verifiedCount = useMemo(() => tickets.filter(t => t.status === 'verified').length, [tickets]);
  const topRisk = useMemo(() => recurrence.filter(r => (r.probability || 0) > 0.5)[0], [recurrence]);
  const hotspotCount = useMemo(() => recurrence.filter(r => (r.probability || 0) > 0.4).length, [recurrence]);



  const legendItems = () => {
    if (layer === 'reports' || layer === 'verified') return [
      { color: 'var(--marker-critical)', label: 'Critical (>70)' },
      { color: 'var(--marker-warning)', label: 'Moderate (40-70)' },
      { color: 'var(--marker-ok)', label: 'Low (<40)' },
    ];
    if (layer === 'clusters') return [{ color: 'var(--accent)', label: `${clusterGroups.length} detected clusters` }];
    if (layer === 'recurrence') return [
      { color: 'var(--error)', label: 'High risk (>70%)' },
      { color: 'var(--warning)', label: 'Medium (40-70%)' },
      { color: 'var(--success)', label: 'Low (<40%)' },
    ];
    if (layer === 'sla') return [
      { color: 'var(--error)', label: 'High SLA Risk (>50%)' }
    ];
    return [];
  };

  return (
    <div className="home-container" style={{ paddingBottom: 'var(--space-10)' }}>
      {/* Hero — editorial strip, not a landing page */}
      <section aria-label="Introduction" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-8)',
        paddingBottom: 'var(--space-6)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-4)',
          }}>
            <span className="font-pixel" style={{
              fontSize: '0.5rem',
              color: 'var(--accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              padding: '4px 8px',
              border: '1px solid var(--accent-muted)',
              borderRadius: 0,
            }}>
              LIVE · LUCKNOW COMMUNITY WATCH
            </span>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--success)',
              boxShadow: '0 0 0 3px oklch(0.65 0.16 155 / 0.2)',
              animation: 'pulse-dot 2s ease-in-out infinite',
              display: 'inline-block',
            }} />
          </div>
          <h1 className="animate-reveal hero-heading" style={{ fontStyle: 'normal', letterSpacing: '-0.03em', fontFamily: 'var(--font-serif)' }}>
            Lucknow Community Issues Watch,<br />
            <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>monitored & resolved by active citizens.</span>
          </h1>
        </div>
        <div className="animate-fade-up stagger-2" style={{ textAlign: 'right' }}>
          <Link to="/report" className="btn btn-primary btn-lg pixel-border" style={{
            padding: 'var(--space-3) var(--space-5)',
            borderRadius: 0,
            gap: 'var(--space-2)',
            fontFamily: 'var(--font-pixel)',
            fontSize: '0.65rem',
          }}>
            📢 REPORT NEW ISSUE
          </Link>
          <p className="font-pixel text-muted" style={{ fontSize: '0.625rem', marginTop: 'var(--space-2)' }}>
            {tickets.length > 0 ? `${tickets.length} ACTIVE ISSUES` : 'BE THE FIRST TO HELP'}
          </p>
        </div>
      </section>

      {/* Section 1: Community Health KPI Header */}
      <div className="kpi-grid animate-fade-up stagger-2">
        <div className="summary-card pixel-border" style={{ borderRadius: 0, background: 'var(--bg-secondary)', padding: '16px' }}>
          <div className="font-pixel text-muted" style={{ fontSize: '0.625rem', marginBottom: '8px' }}>COMMUNITY HEALTH</div>
          <div className="font-serif" style={{ fontSize: '1.75rem', fontWeight: 'bold', color: communityHealthIndex > 80 ? 'var(--success)' : communityHealthIndex > 50 ? 'var(--warning)' : 'var(--error)' }}>
            {communityHealthIndex}%
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '4px' }}>
            {communityHealthIndex > 80 ? '🟢 Stable condition' : communityHealthIndex > 50 ? '🟡 Active warnings' : '🔴 Critical backlog'}
          </p>
        </div>
        <div className="summary-card pixel-border" style={{ borderRadius: 0, background: 'var(--bg-secondary)', padding: '16px' }}>
          <div className="font-pixel text-muted" style={{ fontSize: '0.625rem', marginBottom: '8px' }}>ACTIVE ISSUES</div>
          <div className="font-serif" style={{ fontSize: '1.75rem', fontWeight: 'bold', color: activeCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {activeCount}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '4px' }}>
            {activeCount === 0 ? 'All clear!' : `${urgentTickets} high-priority`}
          </p>
        </div>
        <div className="summary-card pixel-border" style={{ borderRadius: 0, background: 'var(--bg-secondary)', padding: '16px' }}>
          <div className="font-pixel text-muted" style={{ fontSize: '0.625rem', marginBottom: '8px' }}>VERIFIED ISSUES</div>
          <div className="font-serif" style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--success)' }}>
            {verifiedCount}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '4px' }}>
            Consensus confirmed
          </p>
        </div>
        <div className="summary-card pixel-border" style={{ borderRadius: 0, background: 'var(--bg-secondary)', padding: '16px' }}>
          <div className="font-pixel text-muted" style={{ fontSize: '0.625rem', marginBottom: '8px' }}>COMMUNITY HOTSPOTS</div>
          <div className="font-serif" style={{ fontSize: '1.75rem', fontWeight: 'bold', color: hotspotCount > 0 ? 'var(--error)' : 'var(--success)' }}>
            {hotspotCount}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '4px' }}>
            Recurrence risk detected
          </p>
        </div>
      </div>

      {/* Section 2: Centerpiece Map */}
      <div className="animate-fade-up stagger-2" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="map-wrapper pixel-border" style={{ height: '520px', minHeight: 520, borderRadius: 0, position: 'relative' }}>
          <ConfigurableMap
            provider={mapProvider}
            center={[26.8467, 80.9462]}
            zoom={12}
            tickets={tickets}
            clusterGroups={clusterGroups}
            recurrence={recurrence}
            missions={missions}
            slaByWard={slaByWard}
            layer={layer}
            activeTicketId={activeTicketId}
            onMarkerHover={setActiveTicketId}
            onMarkerClick={(ticket) => navigate(`/ticket/${ticket.id}`)}
            onMapReady={setMap}
            wardCenters={WARD_CENTERS}
            categoryColors={CATEGORY_COLORS}
            categoryLabels={CATEGORY_LABELS}
            capitalize={capitalize}
          />
          <div className="layer-toggle" role="tablist" aria-label="Map layers">
            {LAYERS.map(l => (
              <button
                key={l.key}
                role="tab"
                aria-selected={layer === l.key}
                className={`layer-chip font-pixel ${layer === l.key ? 'active' : ''}`}
                style={{ fontSize: '0.65rem', borderRadius: 0, border: '1px solid var(--border)' }}
                onClick={() => setLayer(l.key)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="layer-legend" aria-hidden="true" style={{ borderRadius: 0, border: '1px solid var(--border)' }}>
            {legendItems().map((item, i) => (
              <div className="legend-item font-pixel" key={i} style={{ fontSize: '0.625rem' }}>
                <span className="legend-swatch" style={{ background: item.color, borderRadius: 0 }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 3 & 4: Bottom Grid */}
      <div className="home-bottom-grid animate-fade-up stagger-2">
        {/* Left Column: Community Activity Feed */}
        <div className="flex flex-col gap-4 home-feed-col rpg-panel" style={{ padding: 'var(--space-4)', height: '480px' }}>
          <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            <span className="font-pixel" style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>📢 COMMUNITY ACTIVITY FEED</span>
            <div className="flex gap-2">
              <button 
                onClick={() => scrollFeed('up')} 
                className="btn btn-secondary font-pixel" 
                style={{ padding: '4px 8px', fontSize: '0.625rem', borderRadius: 0, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                aria-label="Scroll feed up"
              >
                ▲
              </button>
              <button 
                onClick={() => scrollFeed('down')} 
                className="btn btn-secondary font-pixel" 
                style={{ padding: '4px 8px', fontSize: '0.625rem', borderRadius: 0, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                aria-label="Scroll feed down"
              >
                ▼
              </button>
            </div>
          </div>

          {/* Filter chips row */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={filters.status}
              onChange={e => handleFilter('status', e.target.value)}
              className="filter-chip-select font-pixel"
              style={{ borderRadius: 0, fontSize: '0.625rem' }}
            >
              <option value="">ALL STATUSES</option>
              <option value="reported">REPORTED</option>
              <option value="verified">VERIFIED</option>
              <option value="in_progress">IN PROGRESS</option>
              <option value="resolved">RESOLVED</option>
              <option value="reopened">REOPENED</option>
            </select>
            <select
              value={filters.category}
              onChange={e => handleFilter('category', e.target.value)}
              className="filter-chip-select font-pixel"
              style={{ borderRadius: 0, fontSize: '0.625rem' }}
            >
              <option value="">ALL CATEGORIES</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.toUpperCase()}</option>
              ))}
            </select>
            <select
              value={filters.ward}
              onChange={e => handleFilter('ward', e.target.value)}
              className="filter-chip-select font-pixel"
              style={{ borderRadius: 0, fontSize: '0.625rem' }}
            >
              <option value="">ALL WARDS</option>
              {WARD_LIST.map(w => (<option key={w} value={w}>{w.toUpperCase()}</option>))}
            </select>
            <span className="font-pixel text-muted" style={{ marginLeft: 'auto', whiteSpace: 'nowrap', fontSize: '0.625rem' }}>
              {tickets.length} ISSUE{tickets.length !== 1 ? 'S' : ''}
            </span>
          </div>

          {/* Feed list */}
          <div ref={feedRef} className="flex flex-col gap-3 rpg-scrollbar" style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div aria-busy="true" aria-label="Loading reports" className="flex flex-col gap-3">
                {[1, 2, 3, 4].map(i => (<div key={i} className="skeleton" style={{ height: 110, borderRadius: 0 }} />))}
              </div>
            ) : tickets.length === 0 ? (
              <div className="empty-state flex flex-col gap-4 pixel-border" style={{ borderRadius: 0 }}>
                <p className="font-pixel" style={{ fontSize: '0.65rem' }}>NO ISSUES FOUND.</p>
                <Link to="/report" className="btn btn-primary pixel-border" style={{ alignSelf: 'center', borderRadius: 0, fontFamily: 'var(--font-pixel)', fontSize: '0.55rem' }}>REPORT ISSUE</Link>
              </div>
            ) : (
              tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="home-ticket-card clickable-card pixel-border"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/ticket/${ticket.id}`)}
                  onKeyDown={(e) => handleCardKey(e, ticket)}
                  style={{
                    borderColor: ticket.priority_score > 70 ? 'var(--error)' : ticket.priority_score > 40 ? 'var(--warning)' : 'var(--border)',
                    background: activeTicketId === ticket.id ? 'var(--bg-elevated)' : 'var(--bg-secondary)',
                    borderRadius: 0,
                  }}
                  onMouseEnter={() => handleHover(ticket)}
                  onMouseLeave={() => setActiveTicketId(null)}
                >
                  <div className="flex justify-between items-start" style={{ marginBottom: 'var(--space-2)' }}>
                    <span className="font-serif" style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--ink-primary)', lineHeight: 1.3 }}>
                      {ticket.title || ticket.ai_title || 'Untitled Issue'}
                    </span>
                    <span className="font-pixel text-muted" style={{ marginLeft: 'var(--space-3)', whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.625rem' }}>{timeAgo(ticket.created_at).toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                    <span className="badge badge-outline font-pixel" style={{ color: CATEGORY_COLORS[ticket.category] || 'var(--ink-secondary)', borderRadius: 0, fontSize: '0.625rem', padding: '2px 4px' }}>
                      {CATEGORY_LABELS[ticket.category] || capitalize(ticket.category)}
                    </span>
                    <span className={`${severityClass(ticket.severity)} font-pixel`} style={{ borderRadius: 0, fontSize: '0.625rem', padding: '2px 4px' }}>{capitalize(ticket.severity)}</span>
                    <span className={`${statusClass(ticket.status)} font-pixel`} style={{ borderRadius: 0, fontSize: '0.625rem', padding: '2px 4px' }}>{capitalize(ticket.status)}</span>
                    <span className="font-pixel text-muted" style={{ marginLeft: 'auto', fontSize: '0.625rem' }}>{ticket.ward?.toUpperCase() || '—'}</span>
                  </div>
                  {ticket.priority_score != null && !isNaN(ticket.priority_score) && (
                    <div className="priority-bar" style={{ height: '3px', marginTop: 'var(--space-3)', borderRadius: 0 }}>
                      <div className="priority-bar-fill" style={{ width: `${Math.round(ticket.priority_score)}%`, background: ticket.priority_score > 70 ? 'var(--error)' : ticket.priority_score > 40 ? 'var(--warning)' : 'var(--accent)', borderRadius: 0 }} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Agent Insights Panel */}
        <div className="flex flex-col gap-4 home-feed-col rpg-panel" style={{ padding: 'var(--space-4)', height: '480px' }}>
          <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            <span className="font-pixel" style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>🤖 AGENT INSIGHTS NETWORK</span>
          </div>

          <div ref={insightsRef} className="flex flex-col gap-3 rpg-scrollbar" style={{ overflowY: 'auto', flex: 1 }}>
            <div className="flex flex-col gap-3">
              {/* Insight 1: Active Clusters */}
              <div className="pixel-border" style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 0 }}>
                <span className="font-pixel" style={{ fontSize: '0.55rem', color: 'var(--accent)' }}>DBSCAN CLUSTERING ANALYSIS</span>
                <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                  {clusterGroups.length > 0 
                    ? `Grouped ${tickets.length} issues into ${clusterGroups.length} high-density geographic clusters. Concentration monitored in ${topRisk?.ward || 'Lucknow'}.`
                    : `Scanning coordinates... No high-density issue clusters detected yet.`}
                </p>
              </div>

              {/* Insight 2: Recurrence Forecast */}
              <div className="pixel-border" style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 0 }}>
                <span className="font-pixel" style={{ fontSize: '0.55rem', color: 'var(--warning)' }}>RECURRENCE RISK FORECAST</span>
                <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                  {topRisk 
                    ? `AI predicts elevated recurrence risk (${Math.round((topRisk.probability || 0) * 100)}%) for ${topRisk.ward} ward based on historical patterns.`
                    : `Weibull hazard model indicators stable across all Lucknow wards.`}
                </p>
              </div>

              {/* Insight 3: SLA Status */}
              <div className="pixel-border" style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 0 }}>
                <span className="font-pixel" style={{ fontSize: '0.55rem', color: slaBreachCount > 0 ? 'var(--error)' : 'var(--success)' }}>SLA COMPLIANCE MONITOR</span>
                <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                  {slaBreachCount > 0 
                    ? `Alert: ${slaBreachCount} active issues have breached or are near their SLA resolution deadline.`
                    : `All active issues are within expected SLA response window.`}
                </p>
              </div>

              {/* Dynamic Consensus Logs from SSE events */}
              {events.filter(e => ['ticket_created', 'ticket_updated', 'verification_recorded'].includes(e.type)).length > 0 && (
                <div className="flex flex-col gap-2" style={{ marginTop: '4px' }}>
                  <span className="font-pixel" style={{ fontSize: '0.55rem', color: 'var(--success)' }}>LIVE AI-CONSENSUS FEED</span>
                  {events
                    .filter(e => ['ticket_created', 'ticket_updated', 'verification_recorded'].includes(e.type))
                    .slice(-5)
                    .reverse()
                    .map((ev, idx) => {
                      let message = "";
                      if (ev.type === 'ticket_created') {
                        message = `[AI Auto-Triage] Parsed report "${ev.data.title || 'Untitled'}". Assigned category: ${ev.data.category || 'General'}.`;
                      } else if (ev.type === 'ticket_updated') {
                        message = `[Escalation] Priority level updated for issue #${(ev.data.ticket_id || '').substring(0, 6)} based on community signals.`;
                      } else if (ev.type === 'verification_recorded') {
                        message = `[Consensus] Consensus updated for issue #${(ev.data.ticket_id || '').substring(0, 6)}: ${ev.data.up} approvals / ${ev.data.down} flags.`;
                      }
                      return (
                        <div key={idx} style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)', borderLeft: '2px solid var(--accent)', paddingLeft: '8px', marginBottom: '4px' }}>
                          {message}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
