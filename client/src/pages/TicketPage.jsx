import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchTicket, submitVerification } from '../services/api';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../utils/constants';
import { timeAgo, capitalize } from '../utils/formatters';
import { useToast } from '../hooks/useToast.jsx';
import AgentTrace from '../components/agent/AgentTrace';
import { INFRASTRUCTURE_GRAPH } from '../utils/infrastructureGraph';

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
          <span className={`${statusClass} font-pixel`} style={{ borderRadius: 0, fontSize: '0.45rem', padding: '2px 4px' }}>{capitalize(ticket.status)}</span>
          <span className={`${severityClass} font-pixel`} style={{ borderRadius: 0, fontSize: '0.45rem', padding: '2px 4px' }}>{capitalize(ticket.severity)}</span>
          {ticket.category && (
            <span
              className="badge badge-outline font-pixel"
              style={{ color: CATEGORY_COLORS[ticket.category] || 'var(--ink-muted)', borderRadius: 0, fontSize: '0.45rem', padding: '2px 4px' }}
            >
              {CATEGORY_LABELS[ticket.category]?.toUpperCase() || capitalize(ticket.category).toUpperCase()}
            </span>
          )}
        </div>
        <h1 className="font-serif animate-reveal" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 1.1, marginBottom: 'var(--space-5)', color: 'var(--ink-primary)', fontWeight: 600 }}>
          {ticket.title || ticket.ai_title || 'Untitled Quest'}
        </h1>

        <div className="flex gap-6 text-sm text-secondary animate-fade-up stagger-1" style={{ flexWrap: 'wrap', rowGap: 'var(--space-3)' }}>
          <div className="flex flex-col gap-1">
            <span className="text-muted font-pixel" style={{ fontSize: '0.45rem', letterSpacing: '0.1em' }}>QUEST DISPATCHED</span>
            <span>{ticket.created_at ? timeAgo(ticket.created_at) : '—'}</span>
          </div>
          {ticket.ward && (
            <div className="flex flex-col gap-1">
              <span className="text-muted font-pixel" style={{ fontSize: '0.45rem', letterSpacing: '0.1em' }}>WARD REALM</span>
              <span>{ticket.ward.toUpperCase()}</span>
            </div>
          )}
          {ticket.address && !ticket.address.toLowerCase().startsWith(ticket.ward?.toLowerCase()) && (
            <div className="flex flex-col gap-1">
              <span className="text-muted font-pixel" style={{ fontSize: '0.45rem', letterSpacing: '0.1em' }}>COORDINATES</span>
              <span>{ticket.address}</span>
            </div>
          )}
          {ticket.department && (
            <div className="flex flex-col gap-1">
              <span className="text-muted font-pixel" style={{ fontSize: '0.45rem', letterSpacing: '0.1em' }}>ASSIGNED GUILD</span>
              <span>{ticket.department.toUpperCase()}</span>
            </div>
          )}
          {ticket.reporter_name && (
            <div className="flex flex-col gap-1">
              <span className="text-muted font-pixel" style={{ fontSize: '0.45rem', letterSpacing: '0.1em' }}>REPORTER HERO</span>
              <span>{ticket.reporter_name.toUpperCase()}</span>
            </div>
          )}
        </div>
      </header>

      <div className="animate-fade-up stagger-2 ticket-grid">

        <div className="flex flex-col gap-8">
          <section>
            <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>[ 📜 QUEST LOG DETAIL ]</h3>
            <p className="text-secondary" style={{ fontSize: '1.125rem', lineHeight: 1.8, fontWeight: 300 }}>
              {ticket.description || ticket.raw_text || 'No description provided for this quest.'}
            </p>
          </section>

          {ticket.media_urls && ticket.media_urls.length > 0 && (
            <section style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-6)' }}>
              <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>[ 📷 VISUAL EVIDENCE ]</h3>
              <div className="flex flex-col gap-4">
                {ticket.media_urls.map((url, i) => {
                  const type = ticket.media_type || (
                    /\.(mp4|webm|mov|avi)$/i.test(url) ? 'video' :
                    /\.(mp3|wav|webm|ogg|m4a)$/i.test(url) ? 'audio' : 'image'
                  );
                  if (type === 'video') return (
                    <div key={i} style={{ borderRadius: 0, overflow: 'hidden', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                      <video
                        src={url}
                        controls
                        style={{ width: '100%', maxHeight: 400, display: 'block', borderRadius: 0 }}
                      />
                    </div>
                  );
                  if (type === 'audio') return (
                    <div key={i} className="panel rpg-panel flex items-center gap-4" style={{ padding: 'var(--space-4)', borderRadius: 0 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 0, background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                      </div>
                      <audio src={url} controls style={{ flex: 1, minWidth: 0 }} />
                    </div>
                  );
                  // image (default)
                  return (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: 0, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
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

          {/* Phase 6: UI Explainability Panels */}
          <div className="flex flex-col gap-6" style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--border-subtle)' }}>
            
            {/* 1. Why Verified? */}
            <div className="panel rpg-panel" style={{ borderRadius: 0 }}>
              <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--success)', marginBottom: 'var(--space-3)' }}>
                [ 🔍 WHY VERIFIED? ]
              </h3>
              <div className="flex items-center gap-4" style={{ marginBottom: 'var(--space-2)' }}>
                <span className="font-pixel" style={{ fontSize: '1.25rem', color: 'var(--success)', lineHeight: 1 }}>
                  {ticket.verification_score != null ? `${ticket.verification_score}%` : 'N/A'}
                </span>
                <span className="badge badge-outline font-pixel" style={{ color: 'var(--success)', borderRadius: 0, fontSize: '0.45rem', padding: '2px 4px' }}>
                  {ticket.status?.toUpperCase()}
                </span>
              </div>
              <p className="text-secondary text-xs" style={{ lineHeight: 1.6 }}>
                {ticket.verification_explanation || 'Verification assessment is pending.'}
              </p>
            </div>

            {/* Root Cause Diagnosis */}
            {ticket.root_cause && (
              <div className="panel rpg-panel" style={{ borderRadius: 0 }}>
                <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--accent)', marginBottom: 'var(--space-3)' }}>
                  [ 🧠 ROOT CAUSE DIAGNOSIS ]
                </h3>
                <div className="flex items-center gap-4" style={{ marginBottom: 'var(--space-2)' }}>
                  <span className="font-pixel text-sm" style={{ color: 'var(--accent)', display: 'block' }}>
                    Probable Cause: {ticket.root_cause.cause}
                  </span>
                  <span className="badge badge-outline font-pixel" style={{ color: 'var(--accent)', borderRadius: 0, fontSize: '0.45rem', padding: '2px 4px' }}>
                    Confidence: {ticket.root_cause.confidence}%
                  </span>
                </div>
                <p className="text-secondary text-xs" style={{ lineHeight: 1.6 }}>
                  {ticket.root_cause.explanation}
                </p>
              </div>
            )}

            {/* Municipal Asset Impact Cascades */}
            {ticket.category && INFRASTRUCTURE_GRAPH[ticket.category] && (
              (() => {
                const graphNode = INFRASTRUCTURE_GRAPH[ticket.category];
                return (
                  <div className="panel rpg-panel" style={{ borderRadius: 0 }}>
                    <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--accent)', marginBottom: 'var(--space-4)' }}>
                      [ 🕸️ INFRASTRUCTURE IMPACT CASCADE ]
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', position: 'relative' }}>
                      {[
                        { label: 'CIVIC CATEGORY', val: capitalize(ticket.category), icon: graphNode.icon || '📌', color: 'var(--ink-primary)' },
                        { label: 'MUNICIPAL ASSET', val: graphNode.asset, icon: '🏢', color: 'var(--accent)' },
                        { label: 'DIRECT IMPACT', val: graphNode.directImpact, icon: '💥', color: 'var(--warning)' },
                        { label: 'CASCADING RISK', val: graphNode.cascadingRisk, icon: '⚠️', color: 'var(--error)' },
                        { label: 'VULNERABILITY LEVEL', val: graphNode.vulnerability, icon: '🛡️', color: 'oklch(0.55 0.18 300)' }
                      ].map((step, idx, arr) => (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                          <div 
                            className="flex items-center gap-3" 
                            style={{ 
                              width: '100%', 
                              padding: 'var(--space-2) var(--space-3)', 
                              border: '1px solid var(--border-subtle)', 
                              background: 'var(--bg-primary)',
                              boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.05)',
                              position: 'relative'
                            }}
                          >
                            <span style={{ fontSize: '1.2rem' }}>{step.icon}</span>
                            <div>
                              <span className="font-pixel block text-muted" style={{ fontSize: '0.35rem', letterSpacing: '0.05em' }}>
                                {step.label}
                              </span>
                              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: step.color }}>
                                {step.val.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          {idx < arr.length - 1 && (
                            <div 
                              className="font-pixel text-muted animate-pulse" 
                              style={{ 
                                fontSize: '0.75rem', 
                                margin: '2px 0',
                                color: 'var(--accent)'
                              }}
                            >
                              ↓
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()
            )}

            {/* 2. Why This Priority? */}
            <div className="panel rpg-panel" style={{ borderRadius: 0 }}>
              <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--warning)', marginBottom: 'var(--space-3)' }}>
                [ ⚖️ WHY THIS PRIORITY? ]
              </h3>
              <p className="text-secondary text-xs" style={{ lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
                {ticket.priority_explanation || 'Priority calculations loading.'}
              </p>
              {ticket.priority_detail && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
                  {Object.entries(ticket.priority_detail).map(([key, val]) => (
                    <div key={key} style={{ padding: 'var(--space-2)', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}>
                      <span className="font-pixel block text-muted" style={{ fontSize: '0.35rem', letterSpacing: '0.05em' }}>
                        {key.toUpperCase().replace('_', ' ')}
                      </span>
                      <span className="font-pixel text-sm" style={{ color: 'var(--accent)' }}>
                        +{val}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Cluster Evidence */}
            <div className="panel rpg-panel" style={{ borderRadius: 0 }}>
              <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--accent)', marginBottom: 'var(--space-3)' }}>
                [ 🗺️ CLUSTER EVIDENCE ]
              </h3>
              <p className="text-secondary text-xs" style={{ lineHeight: 1.6, marginBottom: 'var(--space-3)' }}>
                {ticket.cluster_explanation || 'Duplicate detection summary details loading.'}
              </p>
              {ticket.cluster_detail && ticket.cluster_detail.found && (
                <div className="text-xs font-mono" style={{ padding: 'var(--space-3)', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                  <div><strong>Cluster Match:</strong> Swarm ID #{ticket.cluster_detail.ticket_id}</div>
                  <div><strong>Group Size:</strong> {ticket.cluster_detail.cluster_size} tickets</div>
                  {ticket.cluster_detail.neighbors && ticket.cluster_detail.neighbors.length > 0 && (
                    <div style={{ wordBreak: 'break-all', marginTop: '4px' }}>
                      <strong>Co-neighbors:</strong> {ticket.cluster_detail.neighbors.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. SLA Risk */}
            <div className="panel rpg-panel" style={{ borderRadius: 0 }}>
              <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--error)', marginBottom: 'var(--space-3)' }}>
                [ 🔮 SLA BREACH RISK FORECAST ]
              </h3>
              <div className="flex items-center gap-4" style={{ marginBottom: 'var(--space-2)' }}>
                <span className="font-pixel" style={{ fontSize: '1.25rem', color: 'var(--error)', lineHeight: 1 }}>
                  {ticket.sla_risk_score != null ? `${ticket.sla_risk_score}%` : '0%'}
                </span>
                <span className="text-xs text-muted">breach likelihood</span>
              </div>
              <p className="text-secondary text-xs" style={{ lineHeight: 1.6, marginBottom: 'var(--space-3)' }}>
                {ticket.sla_risk_explanation || 'Weibull time-to-resolution forecasting loading.'}
              </p>
              {ticket.sla_params && (
                <div className="text-xs font-mono" style={{ padding: 'var(--space-3)', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                  <div><strong>Weibull scale (&lambda;):</strong> {ticket.sla_params.lambda} hours</div>
                  <div><strong>Weibull shape (k):</strong> {ticket.sla_params.k}</div>
                  <div><strong>Consensus level:</strong> {ticket.sla_params.localizedUsed ? 'Localized MLE converges' : 'Category default parameters fallback'}</div>
                </div>
              )}
            </div>

            {/* 5. Resolution Plan */}
            {ticket.dispatch_plan && (
              <div className="panel rpg-panel" style={{ borderRadius: 0 }}>
                <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--success)', marginBottom: 'var(--space-3)' }}>
                  [ ⚔️ OPERATION DISPATCH PLAN ]
                </h3>
                <p className="text-secondary text-xs" style={{ lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
                  {ticket.dispatch_plan.explanation}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)' }}>
                  <div style={{ padding: 'var(--space-2)', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}>
                    <span className="font-pixel block text-muted" style={{ fontSize: '0.35rem' }}>CREW SIZE</span>
                    <span className="font-pixel text-sm" style={{ color: 'var(--accent)' }}>{ticket.dispatch_plan.crew_size} Rangers</span>
                  </div>
                  <div style={{ padding: 'var(--space-2)', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}>
                    <span className="font-pixel block text-muted" style={{ fontSize: '0.35rem' }}>ESTIMATED COST</span>
                    <span className="font-pixel text-sm" style={{ color: 'var(--success)' }}>₹{ticket.dispatch_plan.estimated_cost}</span>
                  </div>
                  <div style={{ padding: 'var(--space-2)', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}>
                    <span className="font-pixel block text-muted" style={{ fontSize: '0.35rem' }}>ESTIMATED ETA</span>
                    <span className="font-pixel text-sm" style={{ color: 'var(--accent)' }}>{ticket.dispatch_plan.eta}</span>
                  </div>
                </div>
                <div style={{ marginTop: 'var(--space-3)', fontSize: '0.65rem' }} className="font-mono text-muted">
                  <strong>Supplies:</strong> {ticket.dispatch_plan.materials?.join(', ')}
                </div>
              </div>
            )}

          </div>

          {ticket.agent_trace && ticket.agent_trace.length > 0 && (
            <section style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--border-subtle)' }}>
              <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>[ 🧠 MULTI-AGENT INVESTIGATION ]</h3>
              <AgentTrace trace={ticket.agent_trace} />
            </section>
          )}

          {(ticket.related_tickets || ticket.related_info) && (
            <section style={{ marginTop: 'var(--space-4)' }}>
              <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>[ 🔗 CONTEXTUAL ANOMALIES ]</h3>
              {ticket.related_info && (
                <p className="text-secondary" style={{ fontStyle: 'italic', marginBottom: 'var(--space-4)' }}>{ticket.related_info}</p>
              )}
              {ticket.related_tickets && ticket.related_tickets.length > 0 && (
                <div className="flex flex-col gap-3">
                  {ticket.related_tickets.map((rt, i) => (
                    <Link key={rt.id || i} to={`/ticket/${rt.id}`} className="link-row" style={{ textDecoration: 'none' }}>
                      <span className="text-sm font-medium">{rt.title || rt.id}</span>
                      {rt.status && <span className={`badge badge-status-${rt.status}`} style={{ background: 'transparent', border: '1px solid currentColor', borderRadius: 0 }}>{capitalize(rt.status)}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        <div className="flex flex-col gap-6">

          {ticket.priority_score != null && !isNaN(ticket.priority_score) && (
            <div className="panel rpg-panel" style={{ borderColor: 'var(--accent-muted)', borderRadius: 0 }}>
              <h4 className="label font-pixel" style={{ fontSize: '0.45rem', marginBottom: 'var(--space-2)' }}>THREAT RATING</h4>
              <div className="flex items-end justify-between" style={{ marginBottom: 'var(--space-3)' }}>
                <span className="font-pixel" style={{ fontSize: '1.25rem', lineHeight: 1, color: ticket.priority_score > 70 ? 'var(--error)' : 'var(--accent)' }}>
                  {Math.round(ticket.priority_score)}
                </span>
                <span className="font-pixel text-secondary" style={{ fontSize: '0.45rem', paddingBottom: '4px' }}>
                  {ticket.priority_score > 70 ? '🔴 CRITICAL' : ticket.priority_score > 40 ? '🟡 MODERATE' : '🟢 LOW'}
                </span>
              </div>
              <div className="priority-bar" style={{ height: '3px', borderRadius: 0 }}>
                <div
                  className="priority-bar-fill"
                  style={{
                    width: `${Math.round(ticket.priority_score)}%`,
                    background: ticket.priority_score > 70 ? 'var(--error)' : ticket.priority_score > 40 ? 'var(--warning)' : 'var(--accent)',
                    borderRadius: 0,
                  }}
                />
              </div>
            </div>
          )}

          {slaDeadline && (
            <div className="panel rpg-panel" style={{ borderRadius: 0 }}>
              <h4 className="label font-pixel" style={{ fontSize: '0.45rem', marginBottom: 'var(--space-3)' }}>TIME-LIMIT DEADLINE</h4>
              <div className="font-mono text-sm text-primary" style={{ marginBottom: 'var(--space-3)' }}>{slaDeadline.toLocaleString()}</div>
              {slaRemaining != null && slaRemaining > 0 ? (
                <span className="badge badge-outline font-pixel" style={{ color: 'var(--accent)', borderRadius: 0, fontSize: '0.45rem', padding: '2px 4px' }}>
                  {slaHours}H {slaMinutes}M REMAINING
                </span>
              ) : (
                <span className="badge badge-outline font-pixel" style={{ color: 'var(--error)', borderRadius: 0, fontSize: '0.45rem', padding: '2px 4px' }}>
                  OVERDUE
                </span>
              )}
            </div>
          )}

          <div className="panel rpg-panel" style={{ borderRadius: 0 }}>
            <h4 className="label font-pixel" style={{ fontSize: '0.45rem', marginBottom: 'var(--space-4)' }}>COMMUNITY CONSENSUS</h4>
            <div className="flex flex-col gap-3">
              <button
                className="verify-btn verify-btn-up flex justify-between font-pixel"
                style={{ width: '100%', color: 'var(--warning)', borderColor: 'var(--warning)', borderRadius: 0, fontSize: '0.55rem' }}
                onClick={() => handleVote('still_issue')}
                disabled={voting}
              >
                <span>⚠️ STILL AN ANOMALY</span>
                {ticket.verification_up != null && <span style={{ opacity: 0.8 }}>{ticket.verification_up}</span>}
              </button>
              <button
                className="verify-btn verify-btn-down flex justify-between font-pixel"
                style={{ width: '100%', color: 'var(--success)', borderColor: 'var(--success)', borderRadius: 0, fontSize: '0.55rem' }}
                onClick={() => handleVote('looks_resolved')}
                disabled={voting}
              >
                <span>⚔️ MARK AS PURGED</span>
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
