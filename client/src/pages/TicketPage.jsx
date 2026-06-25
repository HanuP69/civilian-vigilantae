import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchTicket, submitVerification } from '../services/api';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../utils/constants';
import { timeAgo, formatPriority, capitalize } from '../utils/formatters';
import AgentTrace from '../components/agent/AgentTrace';

function TicketPage() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchTicket(id)
      .then(data => setTicket(data))
      .catch(() => setTicket(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleVote = async (voteType) => {
    setVoting(true);
    try {
      const userId = localStorage.getItem('userId') || `user-${Math.random().toString(36).substr(2, 6)}`;
      localStorage.setItem('userId', userId);
      await submitVerification(id, voteType, userId);
      const updated = await fetchTicket(id);
      setTicket(updated);
    } catch {}
    setVoting(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4" style={{ maxWidth: 800 }}>
        <div className="skeleton" style={{ height: 32, width: 300 }} />
        <div className="skeleton" style={{ height: 20, width: 200 }} />
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
        <h2>Ticket not found</h2>
        <p className="text-muted">The requested ticket could not be loaded.</p>
      </div>
    );
  }

  const slaDeadline = ticket.sla_deadline ? new Date(ticket.sla_deadline) : null;
  const slaRemaining = slaDeadline ? Math.max(0, slaDeadline.getTime() - Date.now()) : null;
  const slaHours = slaRemaining != null ? Math.floor(slaRemaining / 3600000) : null;
  const slaMinutes = slaRemaining != null ? Math.floor((slaRemaining % 3600000) / 60000) : null;

  const severityClass = `badge badge-severity-${(ticket.severity || 'low').toLowerCase()}`;
  const statusClass = `badge badge-status-${(ticket.status || 'reported').toLowerCase().replace(/ /g, '-')}`;

  return (
    <div className="ticket-page-container animate-fade-up" style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 'var(--space-10)' }}>
      {/* Header Section */}
      <header style={{ marginBottom: 'var(--space-8)', borderBottom: '1px solid var(--accent-muted)', paddingBottom: 'var(--space-6)' }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-4)' }}>
          <span className={statusClass} style={{ background: 'transparent', border: `1px solid currentColor` }}>{capitalize(ticket.status)}</span>
          <span className={severityClass} style={{ background: 'transparent', border: `1px solid currentColor` }}>{capitalize(ticket.severity)}</span>
          {ticket.category && (
            <span
              className="badge"
              style={{
                background: 'transparent',
                border: '1px solid currentColor',
                color: CATEGORY_COLORS[ticket.category] || '#95a5a6',
              }}
            >
              {CATEGORY_LABELS[ticket.category] || capitalize(ticket.category)}
            </span>
          )}
        </div>
        <h1 className="font-serif animate-reveal" style={{ fontSize: '3.5rem', lineHeight: 1.1, marginBottom: 'var(--space-5)', color: 'var(--ink-primary)' }}>
          {ticket.title || ticket.ai_title || 'Untitled Ticket'}
        </h1>
        
        <div className="flex gap-8 text-sm text-secondary animate-fade-up stagger-1" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          <div className="flex flex-col gap-1">
            <span className="text-muted text-xs">Reported</span>
            <span>{ticket.created_at ? timeAgo(ticket.created_at) : '—'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted text-xs">Location</span>
            <span>{ticket.ward || '—'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted text-xs">Address</span>
            <span>{ticket.address || '—'}</span>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="animate-fade-up stagger-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-10)' }}>
        
        {/* Left Column (Description & Trace) */}
        <div className="flex flex-col gap-8">
          <section>
            <h3 className="font-serif" style={{ fontSize: '1.5rem', marginBottom: 'var(--space-4)', color: 'var(--accent)' }}>Description</h3>
            <p className="text-secondary" style={{ fontSize: '1.125rem', lineHeight: 1.8, fontWeight: 300 }}>
              {ticket.description || ticket.raw_text || 'No description provided for this incident.'}
            </p>
          </section>

          {ticket.agent_trace && ticket.agent_trace.length > 0 && (
            <section style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)', borderTop: '1px solid oklch(1 0 0 / 0.05)' }}>
              <h3 className="font-serif" style={{ fontSize: '1.5rem', marginBottom: 'var(--space-5)' }}>Intelligence Trace</h3>
              <AgentTrace trace={ticket.agent_trace} />
            </section>
          )}

          {(ticket.related_tickets || ticket.related_info) && (
            <section style={{ marginTop: 'var(--space-4)' }}>
              <h3 className="font-serif" style={{ fontSize: '1.5rem', marginBottom: 'var(--space-4)' }}>Contextual Data</h3>
              {ticket.related_info && (
                <p className="text-secondary" style={{ fontStyle: 'italic', marginBottom: 'var(--space-4)' }}>{ticket.related_info}</p>
              )}
              {ticket.related_tickets && ticket.related_tickets.length > 0 && (
                <div className="flex flex-col gap-3">
                  {ticket.related_tickets.map((rt, i) => (
                    <div key={i} className="flex items-center justify-between" style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid oklch(1 0 0 / 0.05)' }}>
                      <span className="text-sm font-medium">{rt.title || rt.id}</span>
                      {rt.status && <span className={`badge badge-status-${rt.status}`} style={{ background: 'transparent', border: '1px solid currentColor' }}>{capitalize(rt.status)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right Column (Metrics & Actions) */}
        <div className="flex flex-col gap-6">
          
          {/* Priority Block */}
          {ticket.priority_score != null && (
            <div style={{ padding: 'var(--space-5)', background: 'var(--bg-secondary)', border: '1px solid var(--accent-muted)', borderRadius: 'var(--radius-lg)' }}>
              <h4 className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-2)' }}>Computed Priority</h4>
              <div className="flex items-end justify-between" style={{ marginBottom: 'var(--space-3)' }}>
                <span className="font-serif" style={{ fontSize: '2.5rem', lineHeight: 1, color: ticket.priority_score > 0.7 ? 'var(--error)' : 'var(--accent)' }}>
                  {Math.round(ticket.priority_score * 100)}%
                </span>
                <span className="text-sm text-secondary" style={{ paddingBottom: '4px' }}>{formatPriority(ticket.priority_score)}</span>
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

          {/* SLA Block */}
          {slaDeadline && (
            <div style={{ padding: 'var(--space-5)', background: 'var(--bg-secondary)', border: '1px solid oklch(1 0 0 / 0.05)', borderRadius: 'var(--radius-lg)' }}>
              <h4 className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-3)' }}>SLA Deadline</h4>
              <div className="text-sm text-primary" style={{ marginBottom: 'var(--space-3)' }}>{slaDeadline.toLocaleString()}</div>
              {slaRemaining != null && slaRemaining > 0 ? (
                <span className="badge" style={{ background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                  {slaHours}h {slaMinutes}m remaining
                </span>
              ) : (
                <span className="badge" style={{ background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)' }}>
                  Overdue
                </span>
              )}
            </div>
          )}

          {/* Verification Block */}
          <div style={{ padding: 'var(--space-5)', background: 'var(--bg-secondary)', border: '1px solid oklch(1 0 0 / 0.05)', borderRadius: 'var(--radius-lg)' }}>
            <h4 className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-4)' }}>Community Verification</h4>
            <div className="flex flex-col gap-3">
              <button
                className="verify-btn flex justify-between"
                style={{ width: '100%', background: 'transparent', border: '1px solid var(--warning)', color: 'var(--warning)' }}
                onClick={() => handleVote('still_issue')}
                disabled={voting}
              >
                <span>🔺 Still an issue</span>
                {ticket.verification_up != null && <span style={{ opacity: 0.8 }}>{ticket.verification_up}</span>}
              </button>
              <button
                className="verify-btn flex justify-between"
                style={{ width: '100%', background: 'transparent', border: '1px solid var(--success)', color: 'var(--success)' }}
                onClick={() => handleVote('looks_resolved')}
                disabled={voting}
              >
                <span>✅ Looks resolved</span>
                {ticket.verification_down != null && <span style={{ opacity: 0.8 }}>{ticket.verification_down}</span>}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default TicketPage;
