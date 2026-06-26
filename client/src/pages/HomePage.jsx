import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchTickets, fetchRecurrenceRisk } from '../services/api';
import { useSSE } from '../hooks/useSSE';
import { useToast } from '../hooks/useToast.jsx';
import { CATEGORY_LABELS, CATEGORY_COLORS, WARD_LIST, WARD_CENTERS } from '../utils/constants';
import { timeAgo, capitalize } from '../utils/formatters';
import ConfigurableMap from '../components/map/ConfigurableMap';

const LAYERS = [
  { key: 'reports', label: 'Reports' },
  { key: 'clusters', label: 'Clusters' },
  { key: 'recurrence', label: 'Recurrence' },
  { key: 'sla', label: 'SLA' },
];



const haversineApprox = (a, b) => {
  const R = 6371000;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const x = dLat / 2;
  const y = dLng * Math.cos(a[0] * Math.PI / 180);
  return 2 * R * Math.asin(Math.sqrt(Math.sin(x) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(y / 2) ** 2));
};

function HomePage() {
  const [tickets, setTickets] = useState([]);
  const [recurrence, setRecurrence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', category: '', ward: '' });
  const [activeTicketId, setActiveTicketId] = useState(null);
  const [map, setMap] = useState(null);
  const [layer, setLayer] = useState('reports');
  const mapProvider = import.meta.env.VITE_MAP_PROVIDER || 'maps';
  const { events } = useSSE();
  const { toast } = useToast();
  const navigate = useNavigate();

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
  const urgentTickets = useMemo(() => tickets.filter(t => (t.priority_score || 0) > 70).length, [tickets]);
  const verifiedCount = useMemo(() => tickets.filter(t => t.status === 'verified').length, [tickets]);
  const topRisk = useMemo(() => recurrence.filter(r => (r.probability || 0) > 0.5)[0], [recurrence]);



  const legendItems = () => {
    if (layer === 'reports') return [
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
      { color: 'var(--error)', label: '>50% breached' },
      { color: 'var(--warning)', label: '25-50% breached' },
      { color: 'var(--success)', label: 'Healthy' },
    ];
    return [];
  };

  return (
    <div className="home-container" style={{ paddingBottom: 'var(--space-10)' }}>
      {/* Hero — editorial strip, not a landing page */}
      <section aria-label="Introduction" style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'end',
        gap: 'var(--space-8)',
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
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              color: 'var(--accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              padding: '3px 8px',
              border: '1px solid var(--accent-muted)',
              borderRadius: 'var(--radius-sm)',
            }}>
              Live · Lucknow
            </span>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--success)',
              boxShadow: '0 0 0 3px oklch(0.65 0.16 155 / 0.2)',
              animation: 'pulse-dot 2s ease-in-out infinite',
              display: 'inline-block',
            }} />
          </div>
          <h1 className="animate-reveal hero-heading" style={{ fontStyle: 'normal', letterSpacing: '-0.03em' }}>
            Infrastructure issues,<br />
            <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>tracked in the open.</span>
          </h1>
        </div>
        <div className="animate-fade-up stagger-2" style={{ textAlign: 'right' }}>
          <Link to="/report" className="btn btn-primary btn-lg" style={{
            padding: 'var(--space-3) var(--space-6)',
            fontSize: '0.9375rem',
            borderRadius: 'var(--radius-full)',
            gap: 'var(--space-2)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            Report an issue
          </Link>
          <p className="text-xs text-muted" style={{ marginTop: 'var(--space-2)' }}>
            {tickets.length > 0 ? `${tickets.length} active incidents` : 'Be the first to report'}
          </p>
        </div>
      </section>

      <div className="hero-panel animate-fade-up stagger-2" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="hero-panel-row">
          <span className="info-pill">⚡ AI triage in seconds</span>
          <span className="info-pill">🧭 Auto-deduped by location and time</span>
          <span className="info-pill">📈 Live ward risk signals</span>
        </div>
        <div className="flex items-center justify-between" style={{ gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div>
            <h3 className="section-title" style={{ marginBottom: 'var(--space-2)' }}>A faster path from report to action</h3>
            <p className="text-secondary">Citizens can submit issues in seconds, and the platform turns them into visible, prioritized civic work.</p>
          </div>
          <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
            <div className="summary-card" style={{ minWidth: 140 }}>
              <div className="font-serif" style={{ fontSize: '1.35rem' }}>{urgentTickets}</div>
              <div className="text-xs text-muted">high urgency</div>
            </div>
            <div className="summary-card" style={{ minWidth: 140 }}>
              <div className="font-serif" style={{ fontSize: '1.35rem' }}>{verifiedCount}</div>
              <div className="text-xs text-muted">verified issues</div>
            </div>
            <div className="summary-card" style={{ minWidth: 180 }}>
              <div className="font-serif" style={{ fontSize: '1.1rem' }}>{topRisk ? `${topRisk.ward}` : '—'}</div>
              <div className="text-xs text-muted">{topRisk ? `${Math.round((topRisk.probability || 0) * 100)}% recurrence risk` : 'no major hotspot'}</div>
            </div>
          </div>
        </div>
        <div className="how-it-works-grid">
          <div className="how-it-card">
            <h4>1. Report</h4>
            <p className="text-secondary">Upload media, describe the issue, and confirm the location in a guided flow.</p>
          </div>
          <div className="how-it-card">
            <h4>2. Understand</h4>
            <p className="text-secondary">The agent classifies, deduplicates, and prioritizes the report automatically.</p>
          </div>
          <div className="how-it-card">
            <h4>3. Act</h4>
            <p className="text-secondary">Track status, verify community impact, and spot wards that need attention.</p>
          </div>
        </div>
      </div>

      <div className="animate-fade-up stagger-2 home-grid">
        {/* LEFT: Map full height */}
        <div className="home-map-col">
          <div className="map-wrapper" style={{ height: '100%', minHeight: 520 }}>
            <ConfigurableMap
              provider={mapProvider}
              center={[26.8467, 80.9462]}
              zoom={12}
              tickets={tickets}
              clusterGroups={clusterGroups}
              recurrence={recurrence}
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
                  className={`layer-chip ${layer === l.key ? 'active' : ''}`}
                  onClick={() => setLayer(l.key)}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <div className="layer-legend" aria-hidden="true">
              {legendItems().map((item, i) => (
                <div className="legend-item" key={i}>
                  <span className="legend-swatch" style={{ background: item.color }} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Compact filter row + feed */}
        <div className="flex flex-col gap-4 home-feed-col">
          {/* Filter chips row */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={filters.status}
              onChange={e => handleFilter('status', e.target.value)}
              className="filter-chip-select"
            >
              <option value="">All statuses</option>
              <option value="reported">Reported</option>
              <option value="verified">Verified</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="reopened">Reopened</option>
            </select>
            <select
              value={filters.category}
              onChange={e => handleFilter('category', e.target.value)}
              className="filter-chip-select"
            >
              <option value="">All categories</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={filters.ward}
              onChange={e => handleFilter('ward', e.target.value)}
              className="filter-chip-select"
            >
              <option value="">All wards</option>
              {WARD_LIST.map(w => (<option key={w} value={w}>{w}</option>))}
            </select>
            <span className="text-xs text-muted" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              {tickets.length} incident{tickets.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Feed */}
          <div className="flex flex-col gap-3" style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div aria-busy="true" aria-label="Loading reports" className="flex flex-col gap-3">
                {[1, 2, 3, 4].map(i => (<div key={i} className="skeleton" style={{ height: 110, borderRadius: 'var(--radius-lg)' }} />))}
              </div>
            ) : tickets.length === 0 ? (
              <div className="empty-state flex flex-col gap-4">
                <p className="font-serif" style={{ fontSize: '1.25rem' }}>No incidents found.</p>
                <Link to="/report" className="btn btn-primary" style={{ alignSelf: 'center' }}>Report an Issue</Link>
              </div>
            ) : (
              tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="home-ticket-card clickable-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/ticket/${ticket.id}`)}
                  onKeyDown={(e) => handleCardKey(e, ticket)}
                  style={{
                    borderColor: ticket.priority_score > 70 ? 'var(--error)' : ticket.priority_score > 40 ? 'var(--warning)' : 'var(--border)',
                    background: activeTicketId === ticket.id ? 'var(--bg-elevated)' : 'var(--bg-secondary)',
                  }}
                  onMouseEnter={() => handleHover(ticket)}
                  onMouseLeave={() => setActiveTicketId(null)}
                >
                  <div className="flex justify-between items-start" style={{ marginBottom: 'var(--space-2)' }}>
                    <span className="font-serif" style={{ fontSize: '1.0625rem', fontWeight: 500, color: 'var(--ink-primary)', lineHeight: 1.3 }}>
                      {ticket.title || ticket.ai_title || 'Untitled Report'}
                    </span>
                    <span className="text-xs text-muted" style={{ marginLeft: 'var(--space-3)', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeAgo(ticket.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                    <span className="badge badge-outline" style={{ color: CATEGORY_COLORS[ticket.category] || 'var(--ink-secondary)' }}>
                      {CATEGORY_LABELS[ticket.category] || capitalize(ticket.category)}
                    </span>
                    <span className={severityClass(ticket.severity)}>{capitalize(ticket.severity)}</span>
                    <span className={statusClass(ticket.status)}>{capitalize(ticket.status)}</span>
                    <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>{ticket.ward || '—'}</span>
                  </div>
                  {ticket.priority_score != null && !isNaN(ticket.priority_score) && (
                    <div className="priority-bar" style={{ height: '2px', marginTop: 'var(--space-3)' }}>
                      <div className="priority-bar-fill" style={{ width: `${Math.round(ticket.priority_score)}%`, background: ticket.priority_score > 70 ? 'var(--error)' : ticket.priority_score > 40 ? 'var(--warning)' : 'var(--accent)' }} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
