import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchTickets, fetchRecurrenceRisk } from '../services/api';
import { useSSE } from '../hooks/useSSE';
import { useToast } from '../hooks/useToast.jsx';
import { CATEGORY_LABELS, CATEGORY_COLORS, WARD_LIST, WARD_CENTERS, wardOf } from '../utils/constants';
import { timeAgo, capitalize } from '../utils/formatters';
import { MapContainer, TileLayer, Marker, Popup, Circle, Tooltip as LeafletTooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const LAYERS = [
  { key: 'reports', label: 'Reports' },
  { key: 'clusters', label: 'Clusters' },
  { key: 'recurrence', label: 'Recurrence' },
  { key: 'sla', label: 'SLA' },
];

const createMarkerIcon = (priorityScore, isActive, isFresh) => {
  const color = priorityScore > 70 ? 'var(--marker-critical)' : priorityScore > 40 ? 'var(--marker-warning)' : 'var(--marker-ok)';
  const scale = isActive ? 1.5 : 1;
  const pulse = isFresh ? 'animation: marker-pulse 1.5s infinite;' : '';
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div style="
      width: 24px; height: 24px;
      background-color: ${color};
      border: 2px solid var(--bg-primary);
      border-radius: 2px;
      box-shadow: 2px 2px 8px rgba(0,0,0,0.8);
      transform: scale(${scale});
      transform-origin: center;
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      ${pulse}
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const FRESH_MS = 2 * 60 * 1000;
const isFresh = (iso) => iso && (Date.now() - new Date(iso).getTime()) < FRESH_MS;

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
    setActiveTicketId(ticket.id);
    if (map && ticket.lat && ticket.lng) map.flyTo([ticket.lat, ticket.lng], 15, { duration: 1.2, easeLinearity: 0.25 });
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

  const renderMapLayer = () => {
    if (layer === 'reports') {
      return tickets.filter(t => t.lat && t.lng).map(t => (
        <Marker key={t.id} position={[t.lat, t.lng]} icon={createMarkerIcon(t.priority_score, activeTicketId === t.id, isFresh(t.created_at))} zIndexOffset={activeTicketId === t.id ? 1000 : 0}>
          <Popup>
            <div style={{ fontFamily: 'var(--font-sans)', minWidth: 180 }}>
              <strong>{t.title || t.ai_title || 'Report'}</strong><br/>
              <span style={{ color: CATEGORY_COLORS[t.category] || 'var(--ink-muted)', fontSize: '0.75rem' }}>{CATEGORY_LABELS[t.category] || capitalize(t.category)}</span>
              <div style={{ margin: '6px 0', fontSize: '0.75rem' }}>
                {t.verification_up > 0 && <span>✓ {t.verification_up} verified · </span>}
                {t.ward}
              </div>
              <Link to={`/ticket/${t.id}`} style={{ display: 'inline-block', marginTop: '4px', fontWeight: 600 }}>View Details →</Link>
            </div>
          </Popup>
        </Marker>
      ));
    }
    if (layer === 'clusters') {
      return clusterGroups.map((g, i) => (
        <Circle
          key={`c-${i}`}
          center={[g.lat, g.lng]}
          radius={300}
          pathOptions={{ color: CATEGORY_COLORS[g.category] || 'var(--accent)', fillColor: CATEGORY_COLORS[g.category] || 'var(--accent)', fillOpacity: 0.15, weight: 1 }}
        >
          <LeafletTooltip sticky>
            <div style={{ fontFamily: 'var(--font-sans)' }}>
              <strong>{g.count} reports</strong> · {CATEGORY_LABELS[g.category] || capitalize(g.category)}<br/>
              <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>tracked as 1 cluster (DBSCAN, 500m / 72h)</span>
            </div>
          </LeafletTooltip>
        </Circle>
      ));
    }
    if (layer === 'recurrence') {
      return recurrence.filter(r => r.probability > 0.3 && WARD_CENTERS[r.ward]).map((r, i) => {
        const color = r.probability > 0.7 ? 'var(--error)' : r.probability > 0.4 ? 'var(--warning)' : 'var(--success)';
        return (
          <Circle
            key={`r-${i}`}
            center={WARD_CENTERS[r.ward]}
            radius={400 + r.probability * 600}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.2, weight: 2 }}
          >
            <LeafletTooltip sticky>
              <div style={{ fontFamily: 'var(--font-sans)' }}>
                <strong>{Math.round(r.probability * 100)}% recurrence</strong> · {r.ward}<br/>
                <span style={{ fontSize: '0.75rem' }}>{CATEGORY_LABELS[r.category] || capitalize(r.category)}</span><br/>
                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{r.recommendedAction || r.recommendation}</span>
              </div>
            </LeafletTooltip>
          </Circle>
        );
      });
    }
    if (layer === 'sla') {
      return Object.entries(slaByWard).filter(([w]) => WARD_CENTERS[w]).map(([ward, c]) => {
        const ratio = c.total > 0 ? c.breached / c.total : 0;
        const color = ratio > 0.5 ? 'var(--error)' : ratio > 0.25 ? 'var(--warning)' : 'var(--success)';
        return (
          <Circle
            key={`s-${ward}`}
            center={WARD_CENTERS[ward]}
            radius={500}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.18, weight: 2, dashArray: '4 4' }}
          >
            <LeafletTooltip sticky>
              <div style={{ fontFamily: 'var(--font-sans)' }}>
                <strong>{ward}</strong><br/>
                <span style={{ color }}>{c.breached}</span> / {c.total} tickets past SLA<br/>
                <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{Math.round(ratio * 100)}% breach rate</span>
              </div>
            </LeafletTooltip>
          </Circle>
        );
      });
    }
    return null;
  };

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

      <div className="animate-fade-up stagger-2 home-grid">
        {/* LEFT: Map full height */}
        <div className="home-map-col">
          <div className="map-wrapper" style={{ height: '100%', minHeight: 520 }}>
            <MapContainer ref={setMap} center={[26.8467, 80.9462]} zoom={12} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              {renderMapLayer()}
            </MapContainer>
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
                    borderLeft: `3px solid ${ticket.priority_score > 70 ? 'var(--error)' : ticket.priority_score > 40 ? 'var(--warning)' : 'var(--border)'}`,
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
