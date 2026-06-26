import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchTicket, submitVerification } from '../services/api';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../utils/constants';
import { timeAgo, capitalize } from '../utils/formatters';
import { useToast } from '../hooks/useToast.jsx';
import AgentTrace from '../components/agent/AgentTrace';

function TicketPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setLoading(true);
    fetchTicket(id)
      .then(data => setTicket(data))
      .catch(() => {
        setTicket(null);
        toast('Failed to load ticket', 'error');
      })
      .finally(() => setLoading(false));
  }, [id, toast]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleVote = async (voteType) => {
    setVoting(true);
    try {
      let userId = localStorage.getItem('userId');
      if (!userId) {
        userId = `user-${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem('userId', userId);
      }
      const result = await submitVerification(id, voteType, userId);
      if (result.error) {
        toast(result.error, 'error');
      } else {
        toast('Vote recorded', 'success');
      }
      const updated = await fetchTicket(id);
      setTicket(updated);
    } catch {
      toast('Failed to record vote', 'error');
    }
    setVoting(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading ticket details" style={{ maxWidth: 800 }}>
        <div className="skeleton" style={{ height: 32, width: 300 }} />
        <div className="skeleton" style={{ height: 20, width: 200 }} />
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col gap-4" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
        <h2>Ticket not found</h2>
        <p className="text-muted">The requested ticket could not be loaded.</p>
        <div className="flex justify-center gap-3" style={{ marginTop: 'var(--space-4)' }}>
          <Link to="/" className="btn btn-primary">Back to Map</Link>
          <Link to="/report" className="btn btn-secondary">Report an Issue</Link>
        </div>
      </div>
    );
  }

  const slaDeadline = ticket.sla_deadline ? new Date(ticket.sla_deadline) : null;
  const slaRemaining = slaDeadline ? Math.max(0, slaDeadline.getTime() - now) : null;
  const slaHours = slaRemaining != null ? Math.floor(slaRemaining / 3600000) : null;
  const slaMinutes = slaRemaining != null ? Math.floor((slaRemaining % 3600000) / 60000) : null;

  const severityClass = `badge badge-outline badge-severity-${(ticket.severity || 'low').toLowerCase()}`;
  const statusClass = `badge badge-outline badge-status-${(ticket.status || 'reported').toLowerCase().replace(/ /g, '-')}`;

  return (
    <div className="ticket-page-container animate-fade-up" style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 'var(--space-10)' }}>
      <header style={{ marginBottom: 'var(--space-8)', borderBottom: '1px solid var(--accent-muted)', paddingBottom: 'var(--space-6)' }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
          <span className={statusClass}>{capitalize(ticket.status)}</span>
          <span className={severityClass}>{capitalize(ticket.severity)}</span>
          {ticket.category && (
            <span
              className="badge badge-outline"
              style={{ color: CATEGORY_COLORS[ticket.category] || 'var(--ink-muted)' }}
            >
              {CATEGORY_LABELS[ticket.category] || capitalize(ticket.category)}
            </span>
          )}
        </div>
        <h1 className="font-serif animate-reveal" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 1.1, marginBottom: 'var(--space-5)', color: 'var(--ink-primary)' }}>
          {ticket.title || ticket.ai_title || 'Untitled Ticket'}
        </h1>

        <div className="flex gap-6 text-sm text-secondary animate-fade-up stagger-1" style={{ flexWrap: 'wrap', rowGap: 'var(--space-3)' }}>
          <div className="flex flex-col gap-1">
            <span className="text-muted text-xs" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>Reported</span>
            <span>{ticket.created_at ? timeAgo(ticket.created_at) : '—'}</span>
          </div>
          {ticket.ward && (
            <div className="flex flex-col gap-1">
              <span className="text-muted text-xs" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>Ward</span>
              <span>{ticket.ward}</span>
            </div>
          )}
          {ticket.address && !ticket.address.toLowerCase().startsWith(ticket.ward?.toLowerCase()) && (
            <div className="flex flex-col gap-1">
              <span className="text-muted text-xs" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>Address</span>
              <span>{ticket.address}</span>
            </div>
          )}
          {ticket.department && (
            <div className="flex flex-col gap-1">
              <span className="text-muted text-xs" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>Department</span>
              <span>{ticket.department}</span>
            </div>
          )}
        </div>
      </header>

      <div className="animate-fade-up stagger-2 ticket-grid">

        <div className="flex flex-col gap-8">
          <section>
            <h3 className="section-title">Description</h3>
            <p className="text-secondary" style={{ fontSize: '1.125rem', lineHeight: 1.8, fontWeight: 300 }}>
              {ticket.description || ticket.raw_text || 'No description provided for this incident.'}
            </p>
          </section>

          {ticket.media_urls && ticket.media_urls.length > 0 && (
            <section style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-6)' }}>
              <h3 className="section-title">Attachments</h3>
              <div className="flex flex-col gap-4">
                {ticket.media_urls.map((url, i) => {
                  const type = ticket.media_type || (
                    /\.(mp4|webm|mov|avi)$/i.test(url) ? 'video' :
                    /\.(mp3|wav|webm|ogg|m4a)$/i.test(url) ? 'audio' : 'image'
                  );
                  if (type === 'video') return (
                    <div key={i} style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                      <video
                        src={url}
                        controls
                        style={{ width: '100%', maxHeight: 400, display: 'block', borderRadius: 'var(--radius-md)' }}
                      />
                    </div>
                  );
                  if (type === 'audio') return (
                    <div key={i} className="panel flex items-center gap-4" style={{ padding: 'var(--space-4)' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                      </div>
                      <audio src={url} controls style={{ flex: 1, minWidth: 0 }} />
                    </div>
                  );
                  // image (default)
                  return (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                      <img
                        src={url}
                        alt={`Attachment ${i + 1}`}
                        style={{ width: '100%', maxHeight: 480, objectFit: 'cover', display: 'block' }}
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {ticket.agent_trace && ticket.agent_trace.length > 0 && (
            <section style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--border-subtle)' }}>
              <h3 className="section-title">Intelligence Trace</h3>
              <AgentTrace trace={ticket.agent_trace} />
            </section>
          )}

          {(ticket.related_tickets || ticket.related_info) && (
            <section style={{ marginTop: 'var(--space-4)' }}>
              <h3 className="section-title">Contextual Data</h3>
              {ticket.related_info && (
                <p className="text-secondary" style={{ fontStyle: 'italic', marginBottom: 'var(--space-4)' }}>{ticket.related_info}</p>
              )}
              {ticket.related_tickets && ticket.related_tickets.length > 0 && (
                <div className="flex flex-col gap-3">
                  {ticket.related_tickets.map((rt, i) => (
                    <Link key={rt.id || i} to={`/ticket/${rt.id}`} className="link-row" style={{ textDecoration: 'none' }}>
                      <span className="text-sm font-medium">{rt.title || rt.id}</span>
                      {rt.status && <span className={`badge badge-status-${rt.status}`} style={{ background: 'transparent', border: '1px solid currentColor' }}>{capitalize(rt.status)}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        <div className="flex flex-col gap-6">

          {ticket.priority_score != null && !isNaN(ticket.priority_score) && (
            <div className="panel" style={{ borderColor: 'var(--accent-muted)' }}>
              <h4 className="label" style={{ marginBottom: 'var(--space-2)' }}>Urgency Score</h4>
              <div className="flex items-end justify-between" style={{ marginBottom: 'var(--space-3)' }}>
                <span className="font-serif" style={{ fontSize: '2.5rem', lineHeight: 1, color: ticket.priority_score > 70 ? 'var(--error)' : 'var(--accent)' }}>
                  {Math.round(ticket.priority_score)}
                </span>
                <span className="text-sm text-secondary" style={{ paddingBottom: '4px' }}>
                  {ticket.priority_score > 70 ? '🔴 Critical' : ticket.priority_score > 40 ? '🟡 Moderate' : '🟢 Low'} · out of 100
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

          {slaDeadline && (
            <div className="panel">
              <h4 className="label" style={{ marginBottom: 'var(--space-3)' }}>SLA Deadline</h4>
              <div className="text-sm text-primary" style={{ marginBottom: 'var(--space-3)' }}>{slaDeadline.toLocaleString()}</div>
              {slaRemaining != null && slaRemaining > 0 ? (
                <span className="badge badge-outline" style={{ color: 'var(--accent)' }}>
                  {slaHours}h {slaMinutes}m remaining
                </span>
              ) : (
                <span className="badge badge-outline" style={{ color: 'var(--error)' }}>
                  Overdue
                </span>
              )}
            </div>
          )}

          <div className="panel">
            <h4 className="label" style={{ marginBottom: 'var(--space-4)' }}>Community Verification</h4>
            <div className="flex flex-col gap-3">
              <button
                className="verify-btn verify-btn-up flex justify-between"
                style={{ width: '100%', color: 'var(--warning)', borderColor: 'var(--warning)' }}
                onClick={() => handleVote('still_issue')}
                disabled={voting}
              >
                <span>Still an issue</span>
                {ticket.verification_up != null && <span style={{ opacity: 0.8 }}>{ticket.verification_up}</span>}
              </button>
              <button
                className="verify-btn verify-btn-down flex justify-between"
                style={{ width: '100%', color: 'var(--success)', borderColor: 'var(--success)' }}
                onClick={() => handleVote('looks_resolved')}
                disabled={voting}
              >
                <span>Looks resolved</span>
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
