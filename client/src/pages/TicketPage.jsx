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
      await submitVerification(id, voteType, 'user-1');
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
    <div style={{ maxWidth: 800, margin: '0 auto' }} className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h1>{ticket.title || ticket.ai_title || 'Untitled Ticket'}</h1>
        <div className="flex items-center gap-2">
          <span className={statusClass}>{capitalize(ticket.status)}</span>
          <span className={severityClass}>{capitalize(ticket.severity)}</span>
          {ticket.category && (
            <span
              className="badge"
              style={{
                background: (CATEGORY_COLORS[ticket.category] || '#95a5a6') + '22',
                color: CATEGORY_COLORS[ticket.category] || '#95a5a6',
              }}
            >
              {CATEGORY_LABELS[ticket.category] || capitalize(ticket.category)}
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Description</h3>
        <p className="text-secondary">{ticket.description || ticket.raw_text || 'No description available.'}</p>
      </div>

      <div className="card">
        <div className="flex gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">Address</span>
            <span className="text-sm">{ticket.address || '—'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">Ward</span>
            <span className="text-sm">{ticket.ward || '—'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">Created</span>
            <span className="text-sm">{ticket.created_at ? timeAgo(ticket.created_at) : '—'}</span>
          </div>
        </div>
      </div>

      {ticket.priority_score != null && (
        <div className="card">
          <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-3)' }}>
            <h3>Priority Score</h3>
            <span className="font-semibold">{formatPriority(ticket.priority_score)}</span>
          </div>
          <div className="priority-bar">
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

      {slaDeadline && (
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-2)' }}>SLA Deadline</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm text-secondary">
              {slaDeadline.toLocaleString()}
            </span>
            {slaRemaining != null && slaRemaining > 0 ? (
              <span className="badge" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                {slaHours}h {slaMinutes}m remaining
              </span>
            ) : (
              <span className="badge badge-severity-critical">Overdue</span>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-4)' }}>Verification</h3>
        <div className="flex gap-3">
          <button
            className="verify-btn verify-btn-down"
            onClick={() => handleVote('still_issue')}
            disabled={voting}
          >
            🔺 Still an issue
            {ticket.verification_upvotes != null && (
              <span className="text-xs text-muted">{ticket.verification_upvotes}</span>
            )}
          </button>
          <button
            className="verify-btn verify-btn-up"
            onClick={() => handleVote('resolved')}
            disabled={voting}
          >
            ✅ Looks resolved
            {ticket.verification_downvotes != null && (
              <span className="text-xs text-muted">{ticket.verification_downvotes}</span>
            )}
          </button>
        </div>
      </div>

      {ticket.agent_trace && ticket.agent_trace.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-4)' }}>Agent Trace</h3>
          <AgentTrace trace={ticket.agent_trace} />
        </div>
      )}

      {(ticket.related_tickets || ticket.related_info) && (
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-3)' }}>Related Information</h3>
          {ticket.related_info && (
            <p className="text-sm text-secondary">{ticket.related_info}</p>
          )}
          {ticket.related_tickets && ticket.related_tickets.length > 0 && (
            <div className="flex flex-col gap-2" style={{ marginTop: 'var(--space-3)' }}>
              {ticket.related_tickets.map((rt, i) => (
                <div key={i} className="card card-compact flex items-center gap-3">
                  <span className="text-sm">{rt.title || rt.id}</span>
                  {rt.status && <span className={`badge badge-status-${rt.status}`}>{capitalize(rt.status)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TicketPage;
