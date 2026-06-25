import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTickets } from '../services/api';
import { CATEGORY_LABELS, CATEGORY_COLORS, WARD_LIST } from '../utils/constants';
import { timeAgo, formatPriority } from '../utils/formatters';
import { capitalize } from '../utils/formatters';

function HomePage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', category: '', ward: '' });
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
          <div className="map-container flex items-center" style={{ minHeight: '350px', background: 'var(--bg-secondary)', border: '1px solid oklch(1 0 0 / 0.05)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ textAlign: 'center', width: '100%' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 'var(--space-3)' }}>🗺️</span>
              <p className="font-medium" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem' }}>Live Map</p>
              <p className="text-sm text-muted">Aesthetic map placeholder</p>
            </div>
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
                    background: 'var(--bg-primary)', 
                    border: '1px solid oklch(1 0 0 / 0.05)',
                    transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), background 0.4s ease',
                    animationDelay: `${i * 0.05}s`
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'var(--bg-primary)'; }}
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
                        <span style={{ color: ticket.priority_score > 0.7 ? 'var(--error)' : 'var(--accent)' }}>
                          {Math.round(ticket.priority_score * 100)}%
                        </span>
                      </div>
                      <div className="priority-bar" style={{ height: '2px', background: 'var(--bg-surface)' }}>
                        <div
                          className="priority-bar-fill"
                          style={{
                            width: `${Math.round(ticket.priority_score * 100)}%`,
                            background: ticket.priority_score > 0.7 ? 'var(--error)' : ticket.priority_score > 0.4 ? 'var(--warning)' : 'var(--accent)',
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
