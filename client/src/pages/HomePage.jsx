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
            if (lastEvent.data.priority_score != null) updatedFields.priority_score = lastEvent.data.priority_score;
          }
          if (lastEvent.data.status) updatedFields.status = lastEvent.data.status;
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
      <section aria-label="Introduction" style={{ marginBottom: 'var(--space-10)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-8)' }}>
        <h1 className="animate-reveal hero-heading">
          Civic monitoring, <span style={{ color: 'var(--accent)' }}>reimagined</span>.
        </h1>
        <p className="animate-fade-up stagger-1 text-secondary" style={{ fontSize: '1.25rem', marginTop: 'var(--space-5)', maxWidth: '600px', fontWeight: 300 }}>
          Real-time visibility into urban infrastructure, powered by agentic intelligence, spatial clustering, and predictive forecasting.
        </p>
      </section>

      <div className="animate-fade-up stagger-2 home-grid">
        <div className="flex flex-col gap-6">
          <div className="map-wrapper">
            <MapContainer ref={setMap} center={[26.8467, 80.9462]} zoom={11} style={{ height: '100%', width: '100%' }}>
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

          <div className="flex flex-col gap-4 panel">
            <h3 className="label" style={{ fontSize: '0.875rem' }}>Filters</h3>
            <label className="flex flex-col gap-1">
              <span className="label">Status</span>
              <select value={filters.status} onChange={e => handleFilter('status', e.target.value)}>
                <option value="">All Statuses</option>
                <option value="reported">Reported</option>
                <option value="verified">Verified</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="reopened">Reopened</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="label">Category</span>
              <select value={filters.category} onChange={e => handleFilter('category', e.target.value)}>
                <option value="">All Categories</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="label">Ward</span>
              <select value={filters.ward} onChange={e => handleFilter('ward', e.target.value)}>
                <option value="">All Wards</option>
                {WARD_LIST.map(w => (<option key={w} value={w}>{w}</option>))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between" style={{ paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 style={{ fontSize: '1.5rem' }}>Recent Reports</h2>
            <span className="text-sm text-muted">{tickets.length} incidents</span>
          </div>

          <div className="flex flex-col gap-4">
            {loading ? (
              <div aria-busy="true" aria-label="Loading reports" className="flex flex-col gap-4">
                {[1, 2, 3, 4].map(i => (<div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />))}
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
                  className="card flex-col gap-3 clickable-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/ticket/${ticket.id}`)}
                  onKeyDown={(e) => handleCardKey(e, ticket)}
                  style={{
                    background: activeTicketId === ticket.id ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                    transform: activeTicketId === ticket.id ? 'translateY(-4px)' : 'translateY(0)'
                  }}
                  onMouseEnter={() => handleHover(ticket)}
                  onMouseLeave={() => setActiveTicketId(null)}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-serif" style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--ink-primary)' }}>
                      {ticket.title || ticket.ai_title || 'Untitled Report'}
                    </span>
                    <span className="text-xs text-muted" style={{ letterSpacing: '0.05em' }}>{timeAgo(ticket.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                    <span className="badge badge-outline" style={{ color: CATEGORY_COLORS[ticket.category] || 'var(--ink-secondary)' }}>
                      {CATEGORY_LABELS[ticket.category] || capitalize(ticket.category)}
                    </span>
                    <span className={severityClass(ticket.severity)}>{capitalize(ticket.severity)}</span>
                    <span className={statusClass(ticket.status)}>{capitalize(ticket.status)}</span>
                    <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>{ticket.ward || 'Unknown Ward'}</span>
                  </div>
                  {ticket.priority_score != null && (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      <div className="flex justify-between text-xs" style={{ marginBottom: 'var(--space-1)' }}>
                        <span className="text-muted">Priority Score</span>
                        <span style={{ color: ticket.priority_score > 70 ? 'var(--error)' : 'var(--accent)' }}>{Math.round(ticket.priority_score)}%</span>
                      </div>
                      <div className="priority-bar" style={{ height: '2px' }}>
                        <div className="priority-bar-fill" style={{ width: `${Math.round(ticket.priority_score)}%`, background: ticket.priority_score > 70 ? 'var(--error)' : ticket.priority_score > 40 ? 'var(--warning)' : 'var(--accent)' }} />
                      </div>
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
