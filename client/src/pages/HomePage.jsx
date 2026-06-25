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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)', height: '100%' }}>
      <div className="map-container flex items-center" style={{ justifyContent: 'center', background: 'var(--bg-surface)', color: 'var(--ink-muted)' }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: 'var(--space-3)' }}>🗺️</span>
          <p className="font-medium">Map View</p>
          <p className="text-sm text-muted">Google Maps integration</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex gap-3 items-center">
          <select
            value={filters.status}
            onChange={e => handleFilter('status', e.target.value)}
            style={{ flex: 1 }}
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
            style={{ flex: 1 }}
          >
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filters.ward}
            onChange={e => handleFilter('ward', e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">All Wards</option>
            {WARD_LIST.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>

        <div className="card flex-col" style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {loading ? (
            <div style={{ padding: 'var(--space-5)' }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="skeleton" style={{ height: 60, marginBottom: 'var(--space-3)', borderRadius: 'var(--radius-md)' }} />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
              <p className="text-muted">No tickets found</p>
            </div>
          ) : (
            tickets.map(ticket => (
              <div
                key={ticket.id}
                className="ticket-item"
                onClick={() => navigate(`/ticket/${ticket.id}`)}
              >
                <div className="flex flex-col gap-2" style={{ flex: 1 }}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{ticket.title || ticket.ai_title || 'Untitled'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="badge"
                      style={{
                        background: CATEGORY_COLORS[ticket.category] + '22',
                        color: CATEGORY_COLORS[ticket.category],
                      }}
                    >
                      {CATEGORY_LABELS[ticket.category] || capitalize(ticket.category)}
                    </span>
                    <span className={severityClass(ticket.severity)}>
                      {capitalize(ticket.severity)}
                    </span>
                    <span className={statusClass(ticket.status)}>
                      {capitalize(ticket.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span>{ticket.ward || '—'}</span>
                    <span>{timeAgo(ticket.created_at)}</span>
                  </div>
                  {ticket.priority_score != null && (
                    <div className="priority-bar" style={{ maxWidth: 200 }}>
                      <div
                        className="priority-bar-fill"
                        style={{
                          width: `${Math.round(ticket.priority_score * 100)}%`,
                          background: ticket.priority_score > 0.7 ? 'var(--error)' : ticket.priority_score > 0.4 ? 'var(--warning)' : 'var(--accent)',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default HomePage;
