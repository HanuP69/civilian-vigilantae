import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTickets } from '../services/api';
import { CATEGORY_LABELS, CATEGORY_COLORS, WARD_LIST } from '../utils/constants';
import { timeAgo, formatPriority } from '../utils/formatters';
import { capitalize } from '../utils/formatters';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const createMarkerIcon = (priorityScore, isActive) => {
  const color = priorityScore > 70 ? '#E57373' : priorityScore > 40 ? '#FFB74D' : '#81C784';
  const scale = isActive ? 'scale(1.5)' : 'scale(1)';
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div style="
      width: 14px; height: 14px; 
      background-color: ${color}; 
      border: 2px solid #1A1A1A; 
      border-radius: 2px; /* Sharp corners instead of circle for sophisticated look */
      box-shadow: 2px 2px 8px rgba(0,0,0,0.8);
      transform: ${scale};
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

function HomePage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', category: '', ward: '' });
  const [activeTicketId, setActiveTicketId] = useState(null);
  const mapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const active = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v) active[k] = v;
    });
    fetchTickets(active)
      .then(data => setTickets(Array.isArray(data) ? data : data.tickets || []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, [filters]);

  const handleFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleHover = (ticket) => {
    setActiveTicketId(ticket.id);
    if (mapRef.current && ticket.lat && ticket.lng) {
      mapRef.current.flyTo([ticket.lat, ticket.lng], 15, { duration: 1.2, easeLinearity: 0.25 });
    }
  };

  const severityClass = (s) => `badge badge-severity-${(s || 'low').toLowerCase()}`;
  const statusClass = (s) => `badge badge-status-${(s || 'reported').toLowerCase().replace(/ /g, '-')}`;

  return (
    <div className="home-container" style={{ paddingBottom: 'var(--space-10)' }}>
      {/* Hero Section */}
      <section style={{ marginBottom: 'var(--space-10)', borderBottom: '1px solid oklch(1 0 0 / 0.05)', paddingBottom: 'var(--space-8)' }}>
        <h1 className="animate-reveal" style={{ fontSize: '4rem', letterSpacing: '-0.02em', maxWidth: '800px', lineHeight: '1.1' }}>
          Civic monitoring, <span style={{ color: 'var(--accent)' }}>reimagined</span>.
        </h1>
        <p className="animate-fade-up stagger-1 text-secondary" style={{ fontSize: '1.25rem', marginTop: 'var(--space-5)', maxWidth: '600px', fontWeight: 300 }}>
          Real-time visibility into urban infrastructure and community reports, powered by automated intelligence.
        </p>
      </section>

      {/* Asymmetric Grid */}
      <div className="animate-fade-up stagger-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 35%) 1fr', gap: 'var(--space-8)' }}>
        
        {/* Left Column: Map & Filters */}
        <div className="flex flex-col gap-6">
          <div className="map-container" style={{ height: '350px', background: 'var(--bg-secondary)', border: '1px solid oklch(1 0 0 / 0.05)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <MapContainer ref={mapRef} center={[26.8467, 80.9462]} zoom={11} style={{ height: '100%', width: '100%' }}>
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
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className="flex flex-col gap-4" style={{ padding: 'var(--space-5)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid oklch(1 0 0 / 0.05)' }}>
            <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-secondary)' }}>Filters</h3>
            <select
              value={filters.status}
              onChange={e => handleFilter('status', e.target.value)}
              style={{ background: 'var(--bg-primary)', border: '1px solid oklch(1 0 0 / 0.1)' }}
            >
              <option value="">All Statuses</option>
              <option value="reported">Reported</option>
              <option value="verified">Verified</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="reopened">Reopened</option>
            </select>
            <select
              value={filters.category}
              onChange={e => handleFilter('category', e.target.value)}
              style={{ background: 'var(--bg-primary)', border: '1px solid oklch(1 0 0 / 0.1)' }}
            >
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={filters.ward}
              onChange={e => handleFilter('ward', e.target.value)}
              style={{ background: 'var(--bg-primary)', border: '1px solid oklch(1 0 0 / 0.1)' }}
            >
              <option value="">All Wards</option>
              {WARD_LIST.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Column: Feed */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between" style={{ paddingBottom: 'var(--space-3)', borderBottom: '1px solid oklch(1 0 0 / 0.05)' }}>
            <h2 style={{ fontSize: '1.5rem' }}>Recent Reports</h2>
            <span className="text-sm text-muted">{tickets.length} incidents</span>
          </div>

          <div className="flex flex-col gap-4">
            {loading ? (
              [1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />
              ))
            ) : tickets.length === 0 ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
                <p className="text-muted font-serif" style={{ fontSize: '1.25rem' }}>No incidents found.</p>
              </div>
            ) : (
              tickets.map((ticket, i) => (
                <div
                  key={ticket.id}
                  onClick={() => navigate(`/ticket/${ticket.id}`)}
                  className="card flex-col gap-3"
                  style={{ 
                    cursor: 'pointer', 
                    background: activeTicketId === ticket.id ? 'var(--bg-secondary)' : 'var(--bg-primary)', 
                    border: '1px solid oklch(1 0 0 / 0.05)',
                    transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), background 0.4s ease',
                    animationDelay: `${i * 0.05}s`,
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
                    <span className="badge" style={{ background: 'var(--bg-surface)', border: '1px solid oklch(1 0 0 / 0.1)', color: 'var(--ink-secondary)' }}>
                      {CATEGORY_LABELS[ticket.category] || capitalize(ticket.category)}
                    </span>
                    <span className={severityClass(ticket.severity)} style={{ background: 'transparent', border: `1px solid currentColor` }}>
                      {capitalize(ticket.severity)}
                    </span>
                    <span className={statusClass(ticket.status)} style={{ background: 'transparent', border: `1px solid currentColor` }}>
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
                      <div className="priority-bar" style={{ height: '2px', background: 'var(--bg-surface)' }}>
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
