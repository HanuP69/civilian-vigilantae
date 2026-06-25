import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchTickets } from '../services/api';
import { useSSE } from '../hooks/useSSE';
import { useToast } from '../hooks/useToast.jsx';
import { CATEGORY_LABELS, WARD_LIST } from '../utils/constants';
import { timeAgo, capitalize } from '../utils/formatters';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const createMarkerIcon = (priorityScore, isActive) => {
  const color = priorityScore > 70 ? 'var(--marker-critical)' : priorityScore > 40 ? 'var(--marker-warning)' : 'var(--marker-ok)';
  const scale = isActive ? 1.5 : 1;
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
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

function HomePage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', category: '', ward: '' });
  const [activeTicketId, setActiveTicketId] = useState(null);
  const [map, setMap] = useState(null);
  const { events } = useSSE();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const active = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v) active[k] = v;
    });
    fetchTickets(active)
      .then(data => setTickets(Array.isArray(data) ? data : data.tickets || []))
      .catch(() => {
        setTickets([]);
        toast('Failed to load tickets', 'error');
      })
      .finally(() => setLoading(false));
  }, [filters, toast]);

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
          if (t.id === lastEvent.data.ticket_id) {
            const updatedFields = {};
            if (lastEvent.data.event === 'escalated') {
              updatedFields.status = 'in_progress';
              if (lastEvent.data.priority_score != null) {
                updatedFields.priority_score = lastEvent.data.priority_score;
              }
            }
            if (lastEvent.data.status) {
              updatedFields.status = lastEvent.data.status;
            }
            return { ...t, ...updatedFields };
          }
          return t;
        })
      );
    } else if (lastEvent.type === 'verification_recorded') {
      setTickets(prev =>
        prev.map(t => {
          if (t.id === lastEvent.data.ticket_id) {
            let status = t.status;
            const newUp = lastEvent.data.up;
            const newDown = lastEvent.data.down;
            if (newUp >= 3 && t.status === 'reported') status = 'verified';
            if (newUp >= 5 && t.status === 'resolved') status = 'reopened';
            if (newDown >= 5 && t.status !== 'resolved') status = 'resolved';
            return { ...t, verification_up: newUp, verification_down: newDown, status };
          }
          return t;
        })
      );
    }
  }, [events, filters, toast]);

  const handleFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleHover = (ticket) => {
    setActiveTicketId(ticket.id);
    if (map && ticket.lat && ticket.lng) {
      map.flyTo([ticket.lat, ticket.lng], 15, { duration: 1.2, easeLinearity: 0.25 });
    }
  };

  const handleCardKey = (e, ticket) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(`/ticket/${ticket.id}`);
    }
  };

  const severityClass = (s) => `badge badge-outline badge-severity-${(s || 'low').toLowerCase()}`;
  const statusClass = (s) => `badge badge-outline badge-status-${(s || 'reported').toLowerCase().replace(/ /g, '-')}`;

  return (
    <div className="home-container" style={{ paddingBottom: 'var(--space-10)' }}>
      <section aria-label="Introduction" style={{ marginBottom: 'var(--space-10)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-8)' }}>
        <h1 className="animate-reveal hero-heading">
          Civic monitoring, <span style={{ color: 'var(--accent)' }}>reimagined</span>.
        </h1>
        <p className="animate-fade-up stagger-1 text-secondary" style={{ fontSize: '1.25rem', marginTop: 'var(--space-5)', maxWidth: '600px', fontWeight: 300 }}>
          Real-time visibility into urban infrastructure and community reports, powered by automated intelligence.
        </p>
      </section>

      <div className="animate-fade-up stagger-2 home-grid">

        <div className="flex flex-col gap-6">
          <div className="map-container" style={{ height: '350px', background: 'var(--bg-secondary)' }}>
            <MapContainer ref={setMap} center={[26.8467, 80.9462]} zoom={11} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              {tickets.filter(t => t.lat && t.lng).map(t => (
                <Marker
                  key={t.id}
                  position={[t.lat, t.lng]}
                  icon={createMarkerIcon(t.priority_score, activeTicketId === t.id)}
                  zIndexOffset={activeTicketId === t.id ? 1000 : 0}
                >
                  <Popup>
                    <div style={{ fontFamily: 'var(--font-sans)' }}>
                      <strong>{t.title || t.ai_title || 'Report'}</strong><br/>
                      {t.ward}<br/>
                      <span className={`badge badge-status-${(t.status || 'reported').toLowerCase().replace(/ /g, '-')}`} style={{ marginTop: '4px', display: 'inline-block' }}>
                        {capitalize(t.status)}
                      </span>
                      <br/>
                      <Link to={`/ticket/${t.id}`} style={{ display: 'inline-block', marginTop: '6px' }}>
                        View Details →
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
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
                {WARD_LIST.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
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
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />
                ))}
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
                    <span className="badge badge-outline" style={{ color: 'var(--ink-secondary)' }}>
                      {CATEGORY_LABELS[ticket.category] || capitalize(ticket.category)}
                    </span>
                    <span className={severityClass(ticket.severity)}>
                      {capitalize(ticket.severity)}
                    </span>
                    <span className={statusClass(ticket.status)}>
                      {capitalize(ticket.status)}
                    </span>
                    <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
                      {ticket.ward || 'Unknown Ward'}
                    </span>
                  </div>

                  {ticket.priority_score != null && (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      <div className="flex justify-between text-xs" style={{ marginBottom: 'var(--space-1)' }}>
                        <span className="text-muted">Priority Score</span>
                        <span style={{ color: ticket.priority_score > 70 ? 'var(--error)' : 'var(--accent)' }}>
                          {Math.round(ticket.priority_score)}%
                        </span>
                      </div>
                      <div className="priority-bar" style={{ height: '2px' }}>
                        <div
                          className="priority-bar-fill"
                          style={{
                            width: `${Math.round(ticket.priority_score)}%`,
                            background: ticket.priority_score > 70 ? 'var(--error)' : ticket.priority_score > 40 ? 'var(--warning)' : 'var(--accent)',
                          }}
                        />
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
