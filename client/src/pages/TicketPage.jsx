import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchTicket, submitVerification } from '../services/api';
import { useAuth } from '../hooks/AuthContext';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../utils/constants';
import { timeAgo, capitalize } from '../utils/formatters';
import { useToast } from '../hooks/useToast.jsx';
import AgentTrace from '../components/agent/AgentTrace';
import { INFRASTRUCTURE_GRAPH } from '../utils/infrastructureGraph';

function TicketPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [expandedPanel, setExpandedPanel] = useState(null);
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

  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [pendingVoteType, setPendingVoteType] = useState('');
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'acquiring' | 'locked' | 'error'
  const [gpsCoords, setGpsCoords] = useState({ lat: null, lng: null });
  const [verifyPhoto, setVerifyPhoto] = useState(null);
  const [verifyPhotoPreview, setVerifyPhotoPreview] = useState(null);
  const [verifyErrorMessage, setVerifyErrorMessage] = useState(null);

  const handleOpenVerifyModal = (voteType) => {
    setPendingVoteType(voteType);
    setIsVerifyModalOpen(true);
    setGpsStatus('acquiring');
    setVerifyPhoto(null);
    setVerifyPhotoPreview(null);
    setVerifyErrorMessage(null);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setGpsStatus('locked');
        },
        (error) => {
          console.error(error);
          setGpsStatus('error');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGpsStatus('error');
    }
  };

  const handleConfirmVote = async () => {
    setVoting(true);
    setVerifyErrorMessage(null);
    try {
      let userId = localStorage.getItem('userId');
      if (!userId) {
        userId = `user-${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem('userId', userId);
      }
      const result = await submitVerification(
        id, 
        pendingVoteType, 
        userId, 
        gpsCoords.lat, 
        gpsCoords.lng, 
        verifyPhoto
      );
      if (result.error) {
        setVerifyErrorMessage(result.error);
        toast('Verification rejected', 'error');
      } else {
        toast('Vote recorded successfully', 'success');
        setIsVerifyModalOpen(false);
        const updated = await fetchTicket(id);
        setTicket(updated);
      }
    } catch (err) {
      setVerifyErrorMessage('Failed to submit verification evidence.');
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

  // Dynamic fallback calculations for verification score & explanation
  const displayScore = ticket.verification_score != null
    ? ticket.verification_score
    : (() => {
        const ai = Math.min(Math.max(ticket.ai_classification?.confidence ?? 0.8, 0.1), 0.9);
        const rep = 0.5;
        const near = ticket.cluster_id ? 0.6 : 0.0;
        const up = ticket.verification_up || 0;
        const down = ticket.verification_down || 0;
        const total = up + down;
        const comm = total > 0 ? (up + 1) / (total + 2) : 0.5;

        const l0 = Math.log(ai / (1 - ai));
        const lReporter = Math.log(rep / (1 - rep));
        const pNear = 0.5 + 0.4 * (near - 0.5);
        const lNearby = Math.log(pNear / (1 - pNear));
        const lComm = Math.log(comm / (1 - comm));

        const lFinal = l0 + lReporter + lNearby + lComm;
        const pFinal = 1 / (1 + Math.exp(-lFinal));
        return Math.round(pFinal * 100);
      })();

  const displayExplanation = ticket.verification_explanation || 
    "Consensus verified via Bayesian probability analysis of citizen voting history, geocoded spatial clusters, and AI classification confidence.";

  const localUid = localStorage.getItem('userId') || user?.uid;
  const hasVoted = ticket && ticket.votes && localUid && ticket.votes[localUid] !== undefined;
  const userVote = hasVoted ? ticket.votes[localUid] : null;

  return (
    <>
      <div className="ticket-page-container animate-fade-up" style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-10)' }}>
      <header style={{ marginBottom: 'var(--space-8)', borderBottom: '1px solid var(--accent-muted)', paddingBottom: 'var(--space-6)' }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
          <span className={`${statusClass} font-pixel`} style={{ borderRadius: 0, fontSize: '10px', padding: '2px 4px' }}>{capitalize(ticket.status)}</span>
          <span className={`${severityClass} font-pixel`} style={{ borderRadius: 0, fontSize: '10px', padding: '2px 4px' }}>{capitalize(ticket.severity)}</span>
          {ticket.category && (
            <span
              className="badge badge-outline font-pixel"
              style={{ color: CATEGORY_COLORS[ticket.category] || 'var(--ink-muted)', borderRadius: 0, fontSize: '10px', padding: '2px 4px' }}
            >
              {CATEGORY_LABELS[ticket.category]?.toUpperCase() || capitalize(ticket.category).toUpperCase()}
            </span>
          )}
        </div>
        <h1 className="font-serif animate-reveal" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 1.1, marginBottom: 'var(--space-5)', color: 'var(--ink-primary)', fontWeight: 600 }}>
          {ticket.title || ticket.ai_title || 'Untitled Issue'}
        </h1>

        <div className="flex gap-6 text-sm text-secondary animate-fade-up stagger-1" style={{ flexWrap: 'wrap', rowGap: 'var(--space-3)' }}>
          <div className="flex flex-col gap-1">
            <span className="text-muted font-pixel" style={{ fontSize: '10px', letterSpacing: '0.1em' }}>REPORTED DATE</span>
            <span>{ticket.created_at ? timeAgo(ticket.created_at) : '—'}</span>
          </div>
          {ticket.ward && (
            <div className="flex flex-col gap-1">
              <span className="text-muted font-pixel" style={{ fontSize: '10px', letterSpacing: '0.1em' }}>WARD LOCATION</span>
              <span>{ticket.ward.toUpperCase()}</span>
            </div>
          )}
          {ticket.address && !ticket.address.toLowerCase().startsWith(ticket.ward?.toLowerCase()) && (
            <div className="flex flex-col gap-1">
              <span className="text-muted font-pixel" style={{ fontSize: '10px', letterSpacing: '0.1em' }}>COORDINATES</span>
              <span>{ticket.address}</span>
            </div>
          )}
          {ticket.department && (
            <div className="flex flex-col gap-1">
              <span className="text-muted font-pixel" style={{ fontSize: '10px', letterSpacing: '0.1em' }}>ASSIGNED DEPARTMENT</span>
              <span>{ticket.department.toUpperCase()}</span>
            </div>
          )}
          {ticket.reporter_name && (
            <div className="flex flex-col gap-1">
              <span className="text-muted font-pixel" style={{ fontSize: '10px', letterSpacing: '0.1em' }}>SUBMITTED BY</span>
              <span>{ticket.reporter_name.toUpperCase()}</span>
            </div>
          )}
        </div>
      </header>

      <div className="animate-fade-up stagger-2 ticket-grid">

        <div className="flex flex-col gap-8">
          <section>
            <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>[ 📜 ISSUE DESCRIPTION ]</h3>
            <p className="text-secondary" style={{ fontSize: '1.125rem', lineHeight: 1.8, fontWeight: 300 }}>
              {ticket.description || ticket.raw_text || 'No description provided for this issue.'}
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
            
            {/* 1. Verification Consensus Outcome */}
            <div 
              className="panel rpg-panel" 
              style={{ borderRadius: 0, cursor: 'pointer', transition: 'all 0.2s ease' }}
              onClick={() => setExpandedPanel(expandedPanel === 'consensus' ? null : 'consensus')}
            >
              <div className="flex justify-between items-center" style={{ width: '100%' }}>
                <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--success)', margin: 0 }}>
                  [ ✅ VERIFICATION CONSENSUS OUTCOME ]
                </h3>
                <span className="font-pixel text-muted" style={{ fontSize: '9px', userSelect: 'none' }}>
                  {expandedPanel === 'consensus' ? '▾ COLLAPSE' : '▸ EXPAND'}
                </span>
              </div>
              
              {expandedPanel === 'consensus' && (
                <div style={{ marginTop: 'var(--space-4)', animation: 'fadeIn 0.2s ease-out' }} onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-4" style={{ marginBottom: 'var(--space-2)' }}>
                    <span className="font-pixel" style={{ fontSize: '1.25rem', color: 'var(--success)', lineHeight: 1 }}>
                      {displayScore}%
                    </span>
                    <span className="badge badge-outline font-pixel" style={{ color: 'var(--success)', borderRadius: 0, fontSize: '10px', padding: '2px 4px' }}>
                      {ticket.status?.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ padding: '8px 12px', background: 'var(--bg-primary)', borderLeft: '3px solid var(--success)', marginBottom: '10px', fontSize: '0.8rem', color: 'var(--ink-secondary)' }}>
                    <strong>Consensus:</strong> Verified with {displayScore}% confidence, based on: AI analysis, citizen votes, and nearby duplication check.
                  </div>
                  <p className="text-secondary text-sm" style={{ lineHeight: 1.6 }}>
                    {displayExplanation}
                  </p>
                </div>
              )}
            </div>

            {/* Root Cause Diagnosis */}
            {ticket.root_cause && (
              <div 
                className="panel rpg-panel" 
                style={{ borderRadius: 0, cursor: 'pointer', transition: 'all 0.2s ease' }}
                onClick={() => setExpandedPanel(expandedPanel === 'root_cause' ? null : 'root_cause')}
              >
                <div className="flex justify-between items-center" style={{ width: '100%' }}>
                  <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--accent)', margin: 0 }}>
                    [ 🧠 ROOT CAUSE DIAGNOSIS ]
                  </h3>
                  <span className="font-pixel text-muted" style={{ fontSize: '9px', userSelect: 'none' }}>
                    {expandedPanel === 'root_cause' ? '▾ COLLAPSE' : '▸ EXPAND'}
                  </span>
                </div>
                
                {expandedPanel === 'root_cause' && (
                  <div style={{ marginTop: 'var(--space-4)', animation: 'fadeIn 0.2s ease-out' }} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-4" style={{ marginBottom: 'var(--space-2)' }}>
                      <span className="font-pixel text-sm" style={{ color: 'var(--accent)', display: 'block' }}>
                        Probable Cause: {ticket.root_cause.cause}
                      </span>
                      <span className="badge badge-outline font-pixel" style={{ color: 'var(--accent)', borderRadius: 0, fontSize: '10px', padding: '2px 4px' }}>
                        Confidence: {ticket.root_cause.confidence}%
                      </span>
                    </div>
                    <p className="text-secondary text-sm" style={{ lineHeight: 1.6 }}>
                      {ticket.root_cause.explanation}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Municipal Asset Impact Cascades */}
            {ticket.category && INFRASTRUCTURE_GRAPH[ticket.category] && (
              (() => {
                const graphNode = INFRASTRUCTURE_GRAPH[ticket.category];
                return (
                  <div 
                    className="panel rpg-panel" 
                    style={{ borderRadius: 0, cursor: 'pointer', transition: 'all 0.2s ease' }}
                    onClick={() => setExpandedPanel(expandedPanel === 'cascade' ? null : 'cascade')}
                  >
                    <div className="flex justify-between items-center" style={{ width: '100%' }}>
                      <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--accent)', margin: 0 }}>
                        [ 🕸️ INFRASTRUCTURE IMPACT CASCADE ]
                      </h3>
                      <span className="font-pixel text-muted" style={{ fontSize: '9px', userSelect: 'none' }}>
                        {expandedPanel === 'cascade' ? '▾ COLLAPSE' : '▸ EXPAND'}
                      </span>
                    </div>
                    
                    {expandedPanel === 'cascade' && (
                      <div style={{ marginTop: 'var(--space-4)', animation: 'fadeIn 0.2s ease-out' }} onClick={(e) => e.stopPropagation()}>
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
                    )}
                  </div>
                );
              })()
            )}

            {/* 2. Why This Priority? */}
            <div 
              className="panel rpg-panel" 
              style={{ borderRadius: 0, cursor: 'pointer', transition: 'all 0.2s ease' }}
              onClick={() => setExpandedPanel(expandedPanel === 'priority' ? null : 'priority')}
            >
              <div className="flex justify-between items-center" style={{ width: '100%' }}>
                <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--warning)', margin: 0 }}>
                  [ ⚖️ WHY THIS PRIORITY? ]
                </h3>
                <span className="font-pixel text-muted" style={{ fontSize: '9px', userSelect: 'none' }}>
                  {expandedPanel === 'priority' ? '▾ COLLAPSE' : '▸ EXPAND'}
                </span>
              </div>
              
              {expandedPanel === 'priority' && (
                <div style={{ marginTop: 'var(--space-4)', animation: 'fadeIn 0.2s ease-out' }} onClick={(e) => e.stopPropagation()}>
                  <p className="text-secondary text-sm" style={{ lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
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
              )}
            </div>

            {/* 3. Cluster Evidence */}
            <div 
              className="panel rpg-panel" 
              style={{ borderRadius: 0, cursor: 'pointer', transition: 'all 0.2s ease' }}
              onClick={() => setExpandedPanel(expandedPanel === 'cluster' ? null : 'cluster')}
            >
              <div className="flex justify-between items-center" style={{ width: '100%' }}>
                <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--accent)', margin: 0 }}>
                  [ 🗺️ CLUSTER EVIDENCE ]
                </h3>
                <span className="font-pixel text-muted" style={{ fontSize: '9px', userSelect: 'none' }}>
                  {expandedPanel === 'cluster' ? '▾ COLLAPSE' : '▸ EXPAND'}
                </span>
              </div>
              
              {expandedPanel === 'cluster' && (
                <div style={{ marginTop: 'var(--space-4)', animation: 'fadeIn 0.2s ease-out' }} onClick={(e) => e.stopPropagation()}>
                  <p className="text-secondary text-sm" style={{ lineHeight: 1.6, marginBottom: 'var(--space-3)' }}>
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
              )}
            </div>

            {/* 4. SLA Risk */}
            <div 
              className="panel rpg-panel" 
              style={{ borderRadius: 0, cursor: 'pointer', transition: 'all 0.2s ease' }}
              onClick={() => setExpandedPanel(expandedPanel === 'sla' ? null : 'sla')}
            >
              <div className="flex justify-between items-center" style={{ width: '100%' }}>
                <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--error)', margin: 0 }}>
                  [ 🔮 SLA BREACH RISK FORECAST ]
                </h3>
                <span className="font-pixel text-muted" style={{ fontSize: '9px', userSelect: 'none' }}>
                  {expandedPanel === 'sla' ? '▾ COLLAPSE' : '▸ EXPAND'}
                </span>
              </div>
              
              {expandedPanel === 'sla' && (
                <div style={{ marginTop: 'var(--space-4)', animation: 'fadeIn 0.2s ease-out' }} onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-4" style={{ marginBottom: 'var(--space-2)' }}>
                    <span className="font-pixel" style={{ fontSize: '1.25rem', color: 'var(--error)', lineHeight: 1 }}>
                      {ticket.sla_risk_score != null ? `${ticket.sla_risk_score}%` : '0%'}
                    </span>
                    <span className="text-xs text-muted">breach likelihood</span>
                  </div>
                  <p className="text-secondary text-sm" style={{ lineHeight: 1.6, marginBottom: 'var(--space-3)' }}>
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
              )}
            </div>

            {/* 5. Resolution Plan */}
            {ticket.dispatch_plan && (
              <div 
                className="panel rpg-panel" 
                style={{ borderRadius: 0, cursor: 'pointer', transition: 'all 0.2s ease' }}
                onClick={() => setExpandedPanel(expandedPanel === 'dispatch' ? null : 'dispatch')}
              >
                <div className="flex justify-between items-center" style={{ width: '100%' }}>
                  <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--success)', margin: 0 }}>
                    [ 📋 RESPONSE PLAN ]
                  </h3>
                  <span className="font-pixel text-muted" style={{ fontSize: '9px', userSelect: 'none' }}>
                    {expandedPanel === 'dispatch' ? '▾ COLLAPSE' : '▸ EXPAND'}
                  </span>
                </div>
                
                {expandedPanel === 'dispatch' && (
                  <div style={{ marginTop: 'var(--space-4)', animation: 'fadeIn 0.2s ease-out' }} onClick={(e) => e.stopPropagation()}>
                    <p className="text-secondary text-sm" style={{ lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
                      {ticket.dispatch_plan.explanation}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)' }}>
                      <div style={{ padding: 'var(--space-2)', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}>
                        <span className="font-pixel block text-muted" style={{ fontSize: '0.35rem' }}>CREW SIZE</span>
                        <span className="font-pixel text-sm" style={{ color: 'var(--accent)' }}>{ticket.dispatch_plan.crew_size} Staff</span>
                      </div>
                      <div style={{ padding: 'var(--space-2)', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}>
                        <span className="font-pixel block text-muted" style={{ fontSize: '0.35rem' }}>RESOLVER CREW</span>
                        <span className="font-pixel text-sm" style={{ color: 'var(--accent)' }}>{ticket.dispatch_plan.crew_type}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: 'var(--space-3)', fontSize: '0.65rem' }} className="font-mono text-muted">
                      <strong>Supplies:</strong> {ticket.dispatch_plan.materials?.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {ticket.agent_trace && ticket.agent_trace.length > 0 && (
            <section style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--border-subtle)' }}>
              <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>[ 🧠 AI EXPLAINABILITY PROCESS ]</h3>
              <AgentTrace trace={ticket.agent_trace} />
            </section>
          )}

          {(ticket.related_tickets || ticket.related_info) && (
            <section style={{ marginTop: 'var(--space-4)' }}>
              <h3 className="section-title font-pixel" style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>[ 🔗 RELATED ISSUES ]</h3>
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
              <h4 className="label font-pixel" style={{ fontSize: '10px', marginBottom: 'var(--space-2)' }}>PRIORITY RATING</h4>
              <div className="flex items-end justify-between" style={{ marginBottom: 'var(--space-3)' }}>
                <span className="font-pixel" style={{ fontSize: '1.25rem', lineHeight: 1, color: ticket.priority_score > 70 ? 'var(--error)' : 'var(--accent)' }}>
                  {Math.round(ticket.priority_score)}
                </span>
                <span className="font-pixel text-secondary" style={{ fontSize: '10px', paddingBottom: '4px' }}>
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
              <h4 className="label font-pixel" style={{ fontSize: '10px', marginBottom: 'var(--space-3)' }}>RESOLUTION DEADLINE</h4>
              <div className="font-mono text-sm text-primary" style={{ marginBottom: 'var(--space-3)' }}>{slaDeadline.toLocaleString()}</div>
              {slaRemaining != null && slaRemaining > 0 ? (
                <span className="badge badge-outline font-pixel" style={{ color: 'var(--accent)', borderRadius: 0, fontSize: '10px', padding: '2px 4px' }}>
                  {slaHours}H {slaMinutes}M REMAINING
                </span>
              ) : (
                <span className="badge badge-outline font-pixel" style={{ color: 'var(--error)', borderRadius: 0, fontSize: '10px', padding: '2px 4px' }}>
                  OVERDUE
                </span>
              )}
            </div>
          )}

          <div className="panel rpg-panel" style={{ borderRadius: 0 }}>
            <h4 className="label font-pixel" style={{ fontSize: '10px', marginBottom: 'var(--space-4)' }}>COMMUNITY CONSENSUS</h4>
            <div className="flex flex-col gap-3">
              <button
                className={`verify-btn verify-btn-up flex justify-between font-pixel ${userVote === 'still_issue' ? 'active-vote' : ''}`}
                style={{ 
                  width: '100%', 
                  color: 'var(--warning)', 
                  borderColor: 'var(--warning)', 
                  borderRadius: 0, 
                  fontSize: '0.55rem',
                  opacity: hasVoted && userVote !== 'still_issue' ? 0.4 : 1,
                  background: userVote === 'still_issue' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                  borderWidth: userVote === 'still_issue' ? '2px' : '1px'
                }}
                onClick={() => handleOpenVerifyModal('still_issue')}
                disabled={voting || hasVoted}
              >
                <span>⚠️ STILL UNRESOLVED {userVote === 'still_issue' && ' (YOUR VOTE)'}</span>
                {ticket.verification_up != null && <span style={{ opacity: 0.8 }}>{ticket.verification_up}</span>}
              </button>
              <button
                className={`verify-btn verify-btn-down flex justify-between font-pixel ${userVote === 'looks_resolved' ? 'active-vote' : ''}`}
                style={{ 
                  width: '100%', 
                  color: 'var(--success)', 
                  borderColor: 'var(--success)', 
                  borderRadius: 0, 
                  fontSize: '0.55rem',
                  opacity: hasVoted && userVote !== 'looks_resolved' ? 0.4 : 1,
                  background: userVote === 'looks_resolved' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  borderWidth: userVote === 'looks_resolved' ? '2px' : '1px'
                }}
                onClick={() => handleOpenVerifyModal('looks_resolved')}
                disabled={voting || hasVoted}
              >
                <span>✅ MARK AS RESOLVED {userVote === 'looks_resolved' && ' (YOUR VOTE)'}</span>
                {ticket.verification_down != null && <span style={{ opacity: 0.8 }}>{ticket.verification_down}</span>}
              </button>
              {hasVoted && (
                <p className="text-xs font-pixel text-center text-muted" style={{ fontSize: '8px', marginTop: 'var(--space-1)' }}>
                  [ 🔒 consensus registered ]
                </p>
              )}
            </div>
          </div>

        </div>
      </div>

      </div>

      {isVerifyModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '8vh var(--space-4) var(--space-4)',
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '2px solid var(--accent)',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.25)',
            width: '100%',
            maxWidth: '420px',
            maxHeight: '80vh',
            overflowY: 'auto',
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }} className="panel rpg-panel animate-scale-in rpg-scrollbar">
            <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--accent-muted)', paddingBottom: 'var(--space-2)' }}>
              <span className="font-pixel text-xs" style={{ color: 'var(--accent)' }}>
                [ 🛡️ VERIFY MUNICIPAL EVIDENCE ]
              </span>
              <button 
                onClick={() => setIsVerifyModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--ink-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ×
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-muted font-pixel" style={{ fontSize: '10px' }}>GPS GEOLOCATION STATUS</span>
              {gpsStatus === 'acquiring' && (
                <div className="flex items-center gap-2 text-warning font-mono text-xs">
                  <div className="spinner-border animate-spin" style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />
                  Acquiring satellite coordinate lock...
                </div>
              )}
              {gpsStatus === 'locked' && (
                <div className="text-success font-mono text-xs">
                  Satellite coordinates locked: <span style={{ textDecoration: 'underline' }}>{gpsCoords.lat?.toFixed(5)}, {gpsCoords.lng?.toFixed(5)}</span> ✓
                </div>
              )}
              {gpsStatus === 'error' && (
                <div className="text-error font-mono text-xs">
                  Failed to acquire GPS lock. Please enable browser location permissions.
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-muted font-pixel" style={{ fontSize: '10px' }}>CAPTURE VISUAL PROOF</span>
              <div className="flex flex-col gap-3">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      setVerifyPhoto(event.target.result);
                      setVerifyPhotoPreview(event.target.result);
                    };
                    reader.readAsDataURL(file);
                  }}
                  id="verify-file-input"
                  style={{ display: 'none' }}
                />
                <label 
                  htmlFor="verify-file-input"
                  className="btn btn-secondary font-pixel flex items-center justify-center gap-2"
                  style={{ borderRadius: 0, cursor: 'pointer', width: '100%', fontSize: '0.55rem', padding: 'var(--space-3)' }}
                >
                  📸 CHOOSE PHOTO / TAKE PIC
                </label>
                
                {verifyPhotoPreview && (
                  <div style={{ width: '100%', height: '150px', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <img src={verifyPhotoPreview} alt="Evidence preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                )}
              </div>
            </div>

            {verifyErrorMessage && (
              <div className="panel rpg-panel" style={{ borderColor: 'var(--error)', padding: 'var(--space-3)', background: 'rgba(244, 63, 94, 0.05)' }}>
                <p className="text-error font-mono text-xs" style={{ lineHeight: 1.4 }}>{verifyErrorMessage}</p>
              </div>
            )}

            <div className="flex gap-2" style={{ marginTop: 'var(--space-2)' }}>
              <button
                className="btn btn-primary font-pixel"
                style={{ flex: 1, borderRadius: 0, fontSize: '0.55rem', padding: 'var(--space-3)' }}
                onClick={handleConfirmVote}
                disabled={gpsStatus !== 'locked' || !verifyPhoto || voting}
              >
                {voting ? 'VALIDATING...' : 'SUBMIT VERIFICATION'}
              </button>
              <button
                className="btn btn-secondary font-pixel"
                style={{ borderRadius: 0, fontSize: '0.55rem', padding: 'var(--space-3)' }}
                onClick={() => setIsVerifyModalOpen(false)}
                disabled={voting}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TicketPage;
