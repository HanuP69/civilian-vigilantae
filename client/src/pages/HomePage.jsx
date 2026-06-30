import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { fetchTickets, fetchRecurrenceRisk, fetchMissions } from '../services/api';
import { useSSE } from '../hooks/useSSE';
import { useToast } from '../hooks/useToast.jsx';
import { CATEGORY_LABELS, CATEGORY_COLORS, WARD_LIST, WARD_CENTERS } from '../utils/constants';
import { timeAgo, capitalize } from '../utils/formatters';
import ConfigurableMap from '../components/map/ConfigurableMap';
import { Panel, Eyebrow, Button, StatBar, Tag, QuestCard, EmptyState, PageShell } from '../components/ui/PixelKit';
import { ScrollIcon, BoltIcon, RobotIcon, TargetIcon, PinIcon, CrosshairIcon } from '../components/ui/PixelIcons';
import './HomePage.v2.css';

const getTimestampMs = (val) => {
  if (!val) return 0;
  if (val.toDate && typeof val.toDate === 'function') {
    return val.toDate().getTime();
  }
  if (typeof val === 'object' && val.seconds !== undefined) {
    return val.seconds * 1000;
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

const LAYERS = [
  { key: 'reports', label: 'ACTIVE QUESTS' },
  { key: 'verified', label: 'CONFIRMED THREATS' },
  { key: 'clusters', label: 'THREAT CLUSTERS' },
  { key: 'sla', label: 'URGENT QUESTS' },
  { key: 'recurrence', label: 'DANGER ZONES' },
];



const haversineApprox = (a, b) => {
  const R = 6371000;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const lat1 = a[0] * Math.PI / 180;
  const lat2 = b[0] * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [recurrence, setRecurrence] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    category: searchParams.get('category') || '',
    ward: searchParams.get('ward') || ''
  });
  const [activeTicketId, setActiveTicketId] = useState(null);
  const [map, setMap] = useState(null);
  const [layer, setLayer] = useState(() => {
    return searchParams.get('isHotspot') === 'true' ? 'recurrence' : 'reports';
  });
  const focusCoords = useMemo(() => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    if (lat && lng) {
      return {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        isHotspot: searchParams.get('isHotspot') === 'true'
      };
    }
    return null;
  }, [searchParams]);

  useEffect(() => {
    setFilters({
      status: '',
      category: searchParams.get('category') || '',
      ward: searchParams.get('ward') || ''
    });
    setLayer(searchParams.get('isHotspot') === 'true' ? 'recurrence' : 'reports');
  }, [searchParams]);

  const mapProvider = import.meta.env.VITE_MAP_PROVIDER || 'maps';
  const { events } = useSSE();
  const { toast } = useToast();
  const navigate = useNavigate();

  const feedRef = useRef(null);
  const insightsRef = useRef(null);
  const scrollFeed = (direction) => {
    if (feedRef.current) {
      const scrollAmount = 180;
      feedRef.current.scrollBy({
        top: direction === 'up' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

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
    fetchMissions()
      .then(data => setMissions(data))
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
          }
          if (lastEvent.data.status) updatedFields.status = lastEvent.data.status;
          // Always merge priority_score if present and valid
          if (lastEvent.data.priority_score != null && !isNaN(lastEvent.data.priority_score)) {
            updatedFields.priority_score = lastEvent.data.priority_score;
          }
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

  const handleFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setSearchParams(new URLSearchParams());
  };
  const handleHover = (ticket) => {
    setActiveTicketId(ticket?.id || null);
    if (map && ticket?.lat && ticket?.lng) {
      if (mapProvider === 'maps') {
        map.panTo({ lat: Number(ticket.lat), lng: Number(ticket.lng) });
        map.setZoom(15);
      } else {
        map.flyTo([Number(ticket.lat), Number(ticket.lng)], 15, { duration: 1.2, easeLinearity: 0.25 });
      }
    }
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
      if (t.status !== 'resolved' && getTimestampMs(t.sla_deadline) < now) counts[t.ward].breached++;
    }
    return counts;
  }, [tickets]);

  const activeIssues = useMemo(() => tickets.filter(t => t.status !== 'resolved'), [tickets]);
  const resolvedCount = useMemo(() => tickets.filter(t => t.status === 'resolved').length, [tickets]);
  const activeCount = useMemo(() => activeIssues.length, [activeIssues]);
  const criticalCount = useMemo(() => activeIssues.filter(t => t.priority_score > 70).length, [activeIssues]);
  const slaBreachCount = useMemo(() => {
    const now = Date.now();
    return activeIssues.filter(t => t.sla_deadline && getTimestampMs(t.sla_deadline) < now).length;
  }, [activeIssues]);

  const communityHealthIndex = useMemo(() => {
    if (tickets.length === 0) return 100;
    const activePenalty = activeCount * 1.5;
    const criticalPenalty = criticalCount * 3.0;
    const slaPenalty = slaBreachCount * 5.0;
    const rawIndex = 100 - (activePenalty + criticalPenalty + slaPenalty);
    return Math.max(10, Math.min(100, Math.round(rawIndex)));
  }, [tickets.length, activeCount, criticalCount, slaBreachCount]);

  const urgentTickets = criticalCount;
  const verifiedCount = useMemo(() => tickets.filter(t => t.status === 'verified').length, [tickets]);
  const topRisk = useMemo(() => recurrence.filter(r => (r.probability || 0) > 0.5)[0], [recurrence]);
  const hotspotCount = useMemo(() => recurrence.filter(r => (r.probability || 0) > 0.4).length, [recurrence]);



  const legendItems = () => {
    if (layer === 'reports' || layer === 'verified') return [
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
      { color: 'var(--error)', label: 'High SLA Risk (>50%)' }
    ];
    return [];
  };

  return (
    <PageShell wide>

      {/* ── Hero Banner ── */}
      <section className="story-banner-v2 animate-fade-up" aria-label="Citizen Vigilantae Overview">
        <Panel lg notched className="story-banner-v2-inner rpg-panel-sandstone">
          <div className="card pixel-border" style={{ background: '#fcf8ee', border: '2px solid #85613c', padding: 'var(--space-6)', width: '100%', color: '#291d12', margin: 0, boxPattern: 'none' }}>
            <div className="story-banner-v2-grid">
              <div>
                <Eyebrow>
                  <span style={{ color: '#6b5139', fontWeight: 600 }}>
                    © TANISHK · LIVE · LUCKNOW GUILD — {tickets.length > 0 ? `${tickets.length} ACTIVE QUESTS` : 'MONITORING REALM'}
                  </span>
                </Eyebrow>

                <h1 className="story-banner-v2-title" style={{ color: '#291d12', textShadow: 'none', margin: 'var(--space-3) 0 var(--space-4)' }}>
                  Troubles reported.<br />
                  Guild dispatched.<br />
                  <em style={{ color: '#b45309', textShadow: 'none' }}>Lucknow protected.</em>
                </h1>

                <p className="story-banner-v2-sub" style={{ color: '#4a3522', fontWeight: 500, lineHeight: 1.6, marginBottom: 0 }}>
                  Welcome to the Lucknow Watch Guild Board! Here, citizens post reports of local troubles,
                  the Town Council routes them to active wards, and brave heroes complete quests to earn gold and honor.
                </p>
              </div>

              <div className="story-banner-v2-side">
                <Link to="/report" aria-label="Report a new community trouble">
                  <Button variant="primary" size="lg" block style={{ background: '#b45309', borderColor: '#513a23', color: '#fff', padding: '12px var(--space-4)' }}>
                    <PinIcon width={14} height={14} /> REPORT TROUBLE
                  </Button>
                </Link>
                <Link to="/missions" aria-label="Browse active missions">
                  <Button block style={{ background: '#ecdcb9', borderColor: '#85613c', color: '#513a23', padding: '12px var(--space-4)' }}>
                    <TargetIcon width={14} height={14} /> ACTIVE MISSIONS
                  </Button>
                </Link>

                <div className="story-banner-v2-stats" aria-label="Community statistics" style={{ borderColor: '#85613c', marginTop: 'var(--space-1)' }}>
                  <div className="story-stat-v2">
                    <span className="story-stat-v2-num" style={{ color: '#b45309', textShadow: 'none', fontSize: '1.4rem' }}>{tickets.length}</span>
                    <span className="story-stat-v2-label" style={{ color: '#6b5139', fontSize: '0.6rem' }}>Active Quests</span>
                  </div>
                  <div className="story-stat-v2">
                    <span className="story-stat-v2-num" style={{ color: communityHealthIndex > 50 ? '#15803d' : '#b91c1c', textShadow: 'none', fontSize: '1.4rem' }}>{communityHealthIndex}%</span>
                    <span className="story-stat-v2-label" style={{ color: '#6b5139', fontSize: '0.6rem' }}>Town Health</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </section>

      {/* Section 1: Community Health KPI Header */}
      <div className="kpi-grid-v2 animate-fade-up stagger-2" role="region" aria-label="Community health statistics">
        <Panel className="kpi-card-v2 rpg-panel-sandstone" role="status" aria-label={`Community health: ${communityHealthIndex}%`}>
          <div className="card pixel-border" style={{ background: '#fcf8ee', color: '#291d12', padding: 'var(--space-3)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '2px solid #85613c', margin: 0, boxPattern: 'none' }}>
            <div className="kpi-card-v2-label" style={{ color: '#6b5139', fontSize: '0.55rem', marginBottom: '4px' }}>TOWN HEALTH</div>
            <div className="kpi-card-v2-num" style={{ color: communityHealthIndex > 80 ? '#15803d' : communityHealthIndex > 50 ? '#b45309' : '#b91c1c', fontSize: '1.6rem', textShadow: 'none', margin: '2px 0', lineHeight: 1 }}>
              {communityHealthIndex}%
            </div>
            <StatBar value={communityHealthIndex} color={communityHealthIndex > 80 ? 'leaf' : communityHealthIndex > 50 ? 'gold' : 'heart'} />
            <p className="kpi-card-v2-sub" style={{ color: '#4a3522', marginTop: '4px', fontSize: '0.65rem', margin: 0 }}>
              {communityHealthIndex > 80 ? 'Stable' : communityHealthIndex > 50 ? 'Warnings active' : 'Critical backlog'}
            </p>
          </div>
        </Panel>

        <Panel className="kpi-card-v2 rpg-panel-sandstone" role="status" aria-label={`${activeCount} active quests, ${urgentTickets} high priority`}>
          <div className="card pixel-border" style={{ background: '#fcf8ee', color: '#291d12', padding: 'var(--space-3)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '2px solid #85613c', margin: 0, boxPattern: 'none' }}>
            <div className="kpi-card-v2-label" style={{ color: '#6b5139', fontSize: '0.55rem', marginBottom: '4px' }}>ACTIVE QUESTS</div>
            <div className="kpi-card-v2-num" style={{ color: activeCount > 0 ? '#b45309' : '#15803d', fontSize: '1.6rem', textShadow: 'none', margin: '2px 0', lineHeight: 1 }}>
              {activeCount}
            </div>
            <p className="kpi-card-v2-sub" style={{ color: '#4a3522', marginTop: '4px', fontSize: '0.65rem', margin: 0 }}>
              {activeCount === 0 ? 'All clear' : <span><span style={{ color: '#b91c1c', fontWeight: 600 }}>{urgentTickets}</span> urgent threats</span>}
            </p>
          </div>
        </Panel>

        <Panel className="kpi-card-v2 rpg-panel-sandstone" role="status" aria-label={`${verifiedCount} verified threats`}>
          <div className="card pixel-border" style={{ background: '#fcf8ee', color: '#291d12', padding: 'var(--space-3)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '2px solid #85613c', margin: 0, boxPattern: 'none' }}>
            <div className="kpi-card-v2-label" style={{ color: '#6b5139', fontSize: '0.55rem', marginBottom: '4px' }}>CONFIRMED THREATS</div>
            <div className="kpi-card-v2-num" style={{ color: '#2563eb', fontSize: '1.6rem', textShadow: 'none', margin: '2px 0', lineHeight: 1 }}>
              {verifiedCount}
            </div>
            <p className="kpi-card-v2-sub" style={{ color: '#4a3522', marginTop: '4px', fontSize: '0.65rem', margin: 0 }}>Consensus confirmed</p>
          </div>
        </Panel>

        <Panel className="kpi-card-v2 rpg-panel-sandstone" role="status" aria-label={`${hotspotCount} danger zones`}>
          <div className="card pixel-border" style={{ background: '#fcf8ee', color: '#291d12', padding: 'var(--space-3)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '2px solid #85613c', margin: 0, boxPattern: 'none' }}>
            <div className="kpi-card-v2-label" style={{ color: '#6b5139', fontSize: '0.55rem', marginBottom: '4px' }}>DANGER ZONES</div>
            <div className="kpi-card-v2-num" style={{ color: hotspotCount > 0 ? '#b91c1c' : '#15803d', fontSize: '1.6rem', textShadow: 'none', margin: '2px 0', lineHeight: 1 }}>
              {hotspotCount}
            </div>
            <p className="kpi-card-v2-sub" style={{ color: '#4a3522', marginTop: '4px', fontSize: '0.65rem', margin: 0 }}>{hotspotCount > 0 ? 'Recurrence risk' : 'No hotspots'}</p>
          </div>
        </Panel>
      </div>

      {/* Section 2: Centerpiece Map */}
      <div className="animate-fade-up stagger-2" style={{ marginBottom: 'var(--space-6)' }}>
        <Panel flush className="map-wrapper-v2 rpg-panel-sandstone" style={{ position: 'relative' }}>
          <ConfigurableMap
            provider={mapProvider}
            center={[26.8467, 80.9462]}
            zoom={12}
            tickets={tickets}
            clusterGroups={clusterGroups}
            recurrence={recurrence}
            missions={missions}
            slaByWard={slaByWard}
            layer={layer}
            activeTicketId={activeTicketId}
            onMarkerHover={setActiveTicketId}
            onMarkerClick={(ticket) => navigate(`/ticket/${ticket.id}`)}
            onMapReady={setMap}
            wardCenters={WARD_CENTERS}
            categoryColors={CATEGORY_COLORS}
            categoryLabels={CATEGORY_LABELS}
            capitalize={capitalize}
            focusCoords={focusCoords}
          />
          <div className="layer-toggle-v2" role="tablist" aria-label="Map layers">
            {LAYERS.map(l => (
              <button
                key={l.key}
                role="tab"
                aria-selected={layer === l.key}
                className={`layer-chip-v2 ${layer === l.key ? 'active' : ''}`}
                onClick={() => setLayer(l.key)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="layer-legend-v2" aria-hidden="true">
            {legendItems().map((item, i) => (
              <div className="legend-item-v2" key={i}>
                <span className="legend-swatch-v2" style={{ background: item.color }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Section 3 & 4: Bottom Grid */}
      <div className="home-bottom-grid-v2 animate-fade-up stagger-2">
        {/* Left Column: Community Activity Feed */}
        <Panel className="home-feed-col-v2 rpg-panel-sandstone" style={{ padding: 0 }}>
          <div className="card pixel-border" style={{ background: '#fcf8ee', border: 'none', padding: 'var(--space-4)', height: '100%', display: 'flex', flexDirection: 'column', flex: 1, color: '#291d12', margin: 0, boxPattern: 'none' }}>
          <div className="hud-panel-header-v2">
            <Eyebrow icon={<ScrollIcon width={14} height={14} />}>COMMUNITY ACTIVITY FEED</Eyebrow>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => scrollFeed('up')}
                aria-label="Scroll feed up"
                style={{ background: '#1c130c', color: '#fcd34d', borderColor: '#d8a96d', textShadow: 'none', minWidth: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                ▲
              </Button>
              <Button
                size="sm"
                onClick={() => scrollFeed('down')}
                aria-label="Scroll feed down"
                style={{ background: '#1c130c', color: '#fcd34d', borderColor: '#d8a96d', textShadow: 'none', minWidth: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                ▼
              </Button>
            </div>
          </div>

          {/* Filter chips row */}
          <div className="home-filter-row-v2">
            <select
              value={filters.status}
              onChange={e => handleFilter('status', e.target.value)}
              className="hud-select"
            >
              <option value="">ALL STATUSES</option>
              <option value="reported">REPORTED</option>
              <option value="verified">VERIFIED</option>
              <option value="in_progress">IN PROGRESS</option>
              <option value="resolved">RESOLVED</option>
              <option value="reopened">REOPENED</option>
            </select>
            <select
              value={filters.category}
              onChange={e => handleFilter('category', e.target.value)}
              className="hud-select"
            >
              <option value="">ALL CATEGORIES</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.toUpperCase()}</option>
              ))}
            </select>
            <select
              value={filters.ward}
              onChange={e => handleFilter('ward', e.target.value)}
              className="hud-select"
            >
              <option value="">ALL WARDS</option>
              {WARD_LIST.map(w => (<option key={w} value={w}>{w.toUpperCase()}</option>))}
            </select>
            <span className="font-pixel text-muted home-issue-count-v2">
              {tickets.length} QUEST{tickets.length !== 1 ? 'S' : ''}
            </span>
          </div>

          {/* Feed list */}
          <div ref={feedRef} className="flex flex-col gap-3 hud-scroll" style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div aria-busy="true" aria-label="Loading reports" className="flex flex-col gap-3">
                {[1, 2, 3, 4].map(i => (<div key={i} className="skeleton" style={{ height: 110 }} />))}
              </div>
            ) : tickets.length === 0 ? (
              <EmptyState
                icon={<ScrollIcon width={36} height={36} />}
                title="NO QUESTS FOUND"
                action={<Link to="/report"><Button variant="primary">REPORT TROUBLE</Button></Link>}
              />
            ) : (
              tickets.map((ticket) => (
                <QuestCard
                  key={ticket.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/ticket/${ticket.id}`)}
                  onKeyDown={(e) => handleCardKey(e, ticket)}
                  accentColor={ticket.priority_score > 70 ? 'var(--hud-heart)' : ticket.priority_score > 40 ? 'var(--hud-gold)' : 'var(--hud-border-light)'}
                  style={{ background: activeTicketId === ticket.id ? 'var(--hud-card-active-bg, var(--hud-panel-light))' : 'var(--hud-card-bg, var(--hud-panel))' }}
                  onMouseEnter={() => handleHover(ticket)}
                  onMouseLeave={() => setActiveTicketId(null)}
                >
                  <div className="flex justify-between items-start" style={{ marginBottom: 'var(--space-2)' }}>
                    <span className="ticket-card-title-v2">
                      {ticket.title || ticket.ai_title || 'Untitled Issue'}
                    </span>
                    <span className="font-pixel text-muted ticket-card-time-v2">{timeAgo(ticket.created_at).toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                    <Tag color={CATEGORY_COLORS[ticket.category] || 'var(--hud-ink-dim)'}>
                      {CATEGORY_LABELS[ticket.category] || capitalize(ticket.category)}
                    </Tag>
                    <Tag color={`var(--severity-${(ticket.severity || 'low').toLowerCase()})`}>{capitalize(ticket.severity)}</Tag>
                    <Tag color={`var(--status-${(ticket.status || 'reported').toLowerCase().replace(/ /g, '-')})`}>{capitalize(ticket.status)}</Tag>
                    <span className="font-pixel text-muted ticket-card-ward-v2">{ticket.ward?.toUpperCase() || '—'}</span>
                  </div>
                  {ticket.priority_score != null && !isNaN(ticket.priority_score) && (
                    <StatBar
                      value={Math.round(ticket.priority_score)}
                      color={ticket.priority_score > 70 ? 'heart' : ticket.priority_score > 40 ? 'gold' : 'sky'}
                    />
                  )}
                </QuestCard>
              ))
            )}
          </div>
          </div>
        </Panel>

        {/* Right Column: Agent Insights Panel */}
        <Panel className="home-feed-col-v2 rpg-panel-sandstone" style={{ padding: 0 }}>
          <div className="card pixel-border" style={{ background: '#fcf8ee', border: 'none', padding: 'var(--space-4)', height: '100%', display: 'flex', flexDirection: 'column', flex: 1, color: '#291d12', margin: 0, boxPattern: 'none' }}>
          <div className="hud-panel-header-v2">
            <Eyebrow icon={<RobotIcon width={14} height={14} />}>AGENT INSIGHTS NETWORK</Eyebrow>
          </div>

          <div ref={insightsRef} className="flex flex-col gap-3 hud-scroll" style={{ overflowY: 'auto', flex: 1 }}>
            <div className="flex flex-col gap-3">
              {/* Insight 1: Active Clusters */}
              <div className="insight-row-v2">
                <span className="font-pixel insight-row-v2-label" style={{ color: 'var(--hud-gold)' }}>DBSCAN CLUSTERING ANALYSIS</span>
                <p className="text-secondary insight-row-v2-text">
                  {clusterGroups.length > 0
                    ? `Grouped ${tickets.length} issues into ${clusterGroups.length} high-density geographic clusters. Concentration monitored in ${topRisk?.ward || 'Lucknow'}.`
                    : `Scanning coordinates... No high-density issue clusters detected yet.`}
                </p>
              </div>

              {/* Insight 2: Recurrence Forecast */}
              <div className="insight-row-v2">
                <span className="font-pixel insight-row-v2-label" style={{ color: 'var(--hud-ember)' }}>RECURRENCE RISK FORECAST</span>
                <p className="text-secondary insight-row-v2-text">
                  {topRisk
                    ? `AI predicts elevated recurrence risk (${Math.round((topRisk.probability || 0) * 100)}%) for ${topRisk.ward} ward based on historical patterns.`
                    : `Weibull hazard model indicators stable across all Lucknow wards.`}
                </p>
              </div>

              {/* Insight 3: SLA Status */}
              <div className="insight-row-v2">
                <span className="font-pixel insight-row-v2-label" style={{ color: slaBreachCount > 0 ? 'var(--hud-heart)' : 'var(--hud-leaf)' }}>SLA COMPLIANCE MONITOR</span>
                <p className="text-secondary insight-row-v2-text">
                  {slaBreachCount > 0
                    ? `Alert: ${slaBreachCount} active issues have breached or are near their SLA resolution deadline.`
                    : `All active issues are within expected SLA response window.`}
                </p>
              </div>

              {/* Dynamic Consensus Logs from SSE events */}
              {events.filter(e => ['ticket_created', 'ticket_updated', 'verification_recorded'].includes(e.type)).length > 0 && (
                <div className="flex flex-col gap-2" style={{ marginTop: '4px' }}>
                  <span className="font-pixel insight-row-v2-label" style={{ color: 'var(--hud-leaf)' }}>LIVE AI-CONSENSUS FEED</span>
                  {events
                    .filter(e => ['ticket_created', 'ticket_updated', 'verification_recorded'].includes(e.type))
                    .slice(-5)
                    .reverse()
                    .map((ev, idx) => {
                      let message = "";
                      if (ev.type === 'ticket_created') {
                        message = `[AI Auto-Triage] Parsed report "${ev.data.title || 'Untitled'}". Assigned category: ${ev.data.category || 'General'}.`;
                      } else if (ev.type === 'ticket_updated') {
                        message = `[Escalation] Priority level updated for issue #${(ev.data.ticket_id || '').substring(0, 6)} based on community signals.`;
                      } else if (ev.type === 'verification_recorded') {
                        message = `[Consensus] Consensus updated for issue #${(ev.data.ticket_id || '').substring(0, 6)}: ${ev.data.up} approvals / ${ev.data.down} flags.`;
                      }
                      return (
                        <div key={idx} className="consensus-log-row-v2">
                          {message}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}

export default HomePage;