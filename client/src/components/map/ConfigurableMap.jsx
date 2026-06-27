import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, Circle, Tooltip, useMap } from 'react-leaflet';

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

const getSlaRisk = (t) => {
  if (!t) return 0;
  if (t.sla_risk_score !== undefined) return t.sla_risk_score;
  if (t.sla_probability !== undefined) return Math.round((1 - t.sla_probability) * 100);
  return 0;
};

const getWardCenterArray = (wardCenter) => {
  if (!wardCenter) return null;
  if (Array.isArray(wardCenter)) {
    return [Number(wardCenter[0]), Number(wardCenter[1])];
  }
  return [Number(wardCenter.lat), Number(wardCenter.lng)];
};

const getWardCenterObject = (wardCenter) => {
  if (!wardCenter) return null;
  if (Array.isArray(wardCenter)) {
    return { lat: Number(wardCenter[0]), lng: Number(wardCenter[1]) };
  }
  return { lat: Number(wardCenter.lat), lng: Number(wardCenter.lng) };
};

const DEFAULT_CENTER = { lat: 26.8467, lng: 80.9462 };

function loadGoogleMapsScript(apiKey, onLoad, onError) {
  if (typeof window === 'undefined') return;
  if (window.google?.maps) {
    onLoad();
    return;
  }

  if (document.getElementById('google-maps-script')) {
    const existing = document.getElementById('google-maps-script');
    existing.addEventListener('load', onLoad, { once: true });
    existing.addEventListener('error', onError, { once: true });
    return;
  }

  const script = document.createElement('script');
  script.id = 'google-maps-script';
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`;
  script.async = true;
  script.defer = true;
  script.addEventListener('load', onLoad, { once: true });
  script.addEventListener('error', onError, { once: true });
  document.head.appendChild(script);
}

function getMarkerColor(priorityScore) {
  if (priorityScore > 70) return '#ff4d4f';
  if (priorityScore > 40) return '#f59e0b';
  return '#10b981';
}

function createLeafletIcon(priorityScore, isActive, isVerified, isSla, currentLayer) {
  const color = currentLayer === 'sla' ? '#ff4d4f' : getMarkerColor(priorityScore);
  const activeClass = isActive ? 'active' : '';
  const glowClass = isVerified ? 'leaflet-verified-glow' : '';
  const slaClass = isSla ? 'leaflet-sla-pulse' : '';
  const svg = `
    <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 2h20v4h4v12h-4v8h-4v4h-4v8h-4v-8h-4v-4h-4v-8H2V6h4V2z" fill="#000000" />
      <path d="M8 4h16v4h4v8h-4v8h-4v4h-4v8h-4v-8H8v-4H4V8h4V4z" fill="${color}" />
      <path d="M12 28v4h8v-4h-4v-4h-4zm-4-8h4v4h-4zm12 0h4v4h-4z" fill="#000000" opacity="0.25" />
      <rect x="14" y="8" width="4" height="8" fill="#ffffff" />
      <rect x="14" y="18" width="4" height="4" fill="#ffffff" />
    </svg>
  `;
  return L.divIcon({
    className: `custom-leaflet-marker-wrapper ${glowClass} ${slaClass}`,
    html: `
      <div class="rpg-quest-pin-container ${activeClass}">
        <div class="rpg-quest-pin-shadow"></div>
        <div class="rpg-quest-pin" style="image-rendering: pixelated;">${svg}</div>
      </div>
    `,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40]
  });
}

function createTempMarkerIcon(isHotspot) {
  const mainColor = isHotspot ? '#ffc000' : '#00b0ff';
  const innerColor = isHotspot ? '#ff3b30' : '#00e5ff';
  const label = isHotspot ? '🔥 HOTSPOT TARGET' : '🧭 MISSION TARGET';
  const svg = `
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="none" stroke="${mainColor}" stroke-width="3" stroke-dasharray="3 3" />
      <circle cx="20" cy="20" r="10" fill="none" stroke="${innerColor}" stroke-width="2" />
      <circle cx="20" cy="20" r="4" fill="${innerColor}" />
      <path d="M20 2v6M20 32v6M2 20h6M32 20h6" stroke="${mainColor}" stroke-width="2" />
    </svg>
  `;
  return L.divIcon({
    className: 'custom-temp-marker-wrapper leaflet-temp-pulse',
    html: `
      <div class="rpg-temp-pin-container" style="display: flex; flex-direction: column; align-items: center; position: relative; width: 40px; height: 40px;">
        <div class="rpg-temp-pin-label font-pixel" style="background: rgba(0,0,0,0.9); color: ${mainColor}; border: 1px solid ${mainColor}; font-size: 7px; padding: 2px 4px; white-space: nowrap; position: absolute; top: -18px; left: 50%; transform: translateX(-50%); letter-spacing: 0.5px;">${label}</div>
        <div style="width: 40px; height: 40px;">${svg}</div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
}

function createGoogleMarkerIcon(priorityScore, isActive, currentLayer) {
  const color = currentLayer === 'sla' ? '#ff4d4f' : getMarkerColor(priorityScore);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path d="M6 2h20v4h4v12h-4v8h-4v4h-4v8h-4v-8h-4v-4h-4v-8H2V6h4V2z" fill="#000000" />
      <path d="M8 4h16v4h4v8h-4v8h-4v4h-4v8h-4v-8H8v-4H4V8h4V4z" fill="${color}" />
      <path d="M12 28v4h8v-4h-4v-4h-4zm-4-8h4v4h-4zm12 0h4v4h-4z" fill="#000000" opacity="0.25" />
      <rect x="14" y="8" width="4" height="8" fill="#ffffff" />
      <rect x="14" y="18" width="4" height="4" fill="#ffffff" />
    </svg>
  `;
  const scale = isActive ? 1.25 : 1;
  const w = 32 * scale;
  const h = 40 * scale;
  return {
    url: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg),
    size: new window.google.maps.Size(w, h),
    scaledSize: new window.google.maps.Size(w, h),
    origin: new window.google.maps.Point(0, 0),
    anchor: new window.google.maps.Point(16 * scale, 40 * scale)
  };
}

function MapController({ tickets, clusterGroups, recurrence, slaByWard, layer, center, zoom, wardCenters, onMapReady, focusCoords }) {
  const map = useMap();
  const lastFitRef = useRef({ layer: null, dataLength: 0 });

  useEffect(() => {
    if (map) {
      if (onMapReady) {
        onMapReady(map);
      }
      // Force Leaflet to recalculate container bounds after mount to prevent zoom/interaction issues
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
  }, [map, onMapReady]);

  useEffect(() => {
    if (!map) return;

    if (focusCoords && Number.isFinite(Number(focusCoords.lat)) && Number.isFinite(Number(focusCoords.lng))) {
      map.flyTo([Number(focusCoords.lat), Number(focusCoords.lng)], 15, { animate: true, duration: 1.5 });
      return;
    }

    let currentDataLength = 0;
    const positions = [];
    if (layer === 'reports' || layer === 'verified' || layer === 'sla') {
      const filtered = tickets.filter(t => {
        const latVal = Number(t.lat);
        const lngVal = Number(t.lng);
        if (!Number.isFinite(latVal) || !Number.isFinite(lngVal)) return false;
        if (layer === 'reports') return t.status !== 'resolved';
        if (layer === 'verified') return t.status === 'verified';
        if (layer === 'sla') return t.status !== 'resolved' && getSlaRisk(t) > 50;
        return false;
      });
      currentDataLength = filtered.length;
      filtered.forEach(t => {
        positions.push([Number(t.lat), Number(t.lng)]);
      });
    } else if (layer === 'clusters') {
      currentDataLength = clusterGroups.length;
      clusterGroups.forEach(g => {
        positions.push([Number(g.lat), Number(g.lng)]);
      });
    } else if (layer === 'recurrence') {
      const activeRecurrence = recurrence.filter(item => item.probability > 0.3 && wardCenters[item.ward]);
      currentDataLength = activeRecurrence.length;
      activeRecurrence.forEach(item => {
        const coords = getWardCenterArray(wardCenters[item.ward]);
        if (coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
          positions.push(coords);
        }
      });
    }

    // Only fit bounds if the layer or dataset size changed
    const shouldFit = lastFitRef.current.layer !== layer || lastFitRef.current.dataLength !== currentDataLength;
    if (shouldFit) {
      if (positions.length > 0) {
        if (positions.length === 1) {
          map.setView(positions[0], 14);
        } else {
          map.fitBounds(positions, { padding: [40, 40] });
        }
      } else {
        const parsedCenter = [Number(center[0]), Number(center[1])];
        if (Number.isFinite(parsedCenter[0]) && Number.isFinite(parsedCenter[1])) {
          map.setView(parsedCenter, zoom);
        }
      }
      lastFitRef.current = { layer, dataLength: currentDataLength };
    }
  }, [tickets, clusterGroups, recurrence, slaByWard, layer, center, zoom, wardCenters, map, focusCoords]);

  return null;
}

function ConfigurableMap({
  provider = 'maps',
  center = [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
  zoom = 12,
  tickets = [],
  clusterGroups = [],
  recurrence = [],
  missions = [],
  slaByWard = {},
  layer = 'reports',
  activeTicketId = null,
  onMarkerClick = () => {},
  onMarkerHover = () => {},
  onMapReady = () => {},
  wardCenters = {},
  categoryColors = {},
  categoryLabels = {},
  capitalize = (value) => value,
  focusCoords = null,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const overlaysRef = useRef([]);
  const infoWindowRef = useRef(null);
  const googleLastFitRef = useRef({ layer: null, dataLength: 0 });
  const [googleReady, setGoogleReady] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (provider !== 'maps') return;
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setLoadError('Google Maps API key is missing.');
      return;
    }

    const handleLoaded = () => {
      setGoogleReady(true);
      setLoadError('');
    };
    const handleError = () => {
      setGoogleReady(false);
      setLoadError('Google Maps could not be loaded. Check the API key, Maps JavaScript API, and local referrer restrictions.');
    };

    loadGoogleMapsScript(apiKey, handleLoaded, handleError);
  }, [provider]);

  useEffect(() => {
    if (provider !== 'maps' || !googleReady || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: { lat: center[0], lng: center[1] },
        zoom,
        gestureHandling: 'greedy',
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      mapInstanceRef.current = map;
      infoWindowRef.current = new window.google.maps.InfoWindow();
      onMapReady(map);
    }
  }, [provider, googleReady, center, zoom, onMapReady]);

  useEffect(() => {
    if (provider !== 'maps' || !mapInstanceRef.current || !window.google?.maps) return;

    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];

    const map = mapInstanceRef.current;
    const infoWindow = infoWindowRef.current;
    const positions = [];

    const addBounds = (lat, lng) => {
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        positions.push({ lat, lng });
      }
    };

    if (layer === 'reports' || layer === 'verified' || layer === 'sla') {
      const filtered = tickets.filter((ticket) => {
        const latVal = Number(ticket.lat);
        const lngVal = Number(ticket.lng);
        if (!Number.isFinite(latVal) || !Number.isFinite(lngVal)) return false;
        if (layer === 'reports') return ticket.status !== 'resolved';
        if (layer === 'verified') return ticket.status === 'verified';
        if (layer === 'sla') return ticket.status !== 'resolved' && ticket.sla_risk_score > 50;
        return false;
      });

      filtered.forEach((ticket) => {
        const position = { lat: Number(ticket.lat), lng: Number(ticket.lng) };
        const marker = new window.google.maps.Marker({
          position,
          map,
          title: ticket.title || ticket.ai_title || 'Report',
          icon: createGoogleMarkerIcon(ticket.priority_score, activeTicketId === ticket.id, layer),
          zIndex: activeTicketId === ticket.id ? 1000 : 0,
        });

        marker.addListener('click', () => {
          onMarkerClick(ticket);
          const content = `
            <div style="font-family: 'Press Start 2P', monospace; min-width: 180px; padding: 4px; line-height: 1.4;">
              <strong style="font-size: 8px; color: var(--ink-primary); display: block; margin-bottom: 4px;">${ticket.title || ticket.ai_title || 'Untitled Issue'}</strong>
              <span style="color:${categoryColors[ticket.category] || 'var(--ink-muted)'}; font-size: 6px; display: block; margin-bottom: 6px;">${(categoryLabels[ticket.category] || capitalize(ticket.category)).toUpperCase()}</span>
              <div style="font-size: 6px; color: var(--ink-secondary); margin-bottom: 6px;">${ticket.verification_up > 0 ? `✓ ${ticket.verification_up} VOTES · ` : ''}${(ticket.ward || '—').toUpperCase()}</div>
              ${ticket.sla_risk_score !== undefined ? `<div style="font-size: 6px; color: var(--error); margin-bottom: 6px;">SLA BREACH RISK: ${ticket.sla_risk_score}%</div>` : ''}
              <a href="/ticket/${ticket.id}" style="color: var(--accent); font-size: 6px; text-decoration: underline;">VIEW DETAILS →</a>
            </div>
          `;
          infoWindow.setContent(content);
          infoWindow.open({ anchor: marker, map });
        });

        marker.addListener('mouseover', () => {
          onMarkerHover(ticket);
        });
        marker.addListener('mouseout', () => {
          onMarkerHover(null);
        });

        overlaysRef.current.push(marker);
        addBounds(position.lat, position.lng);
      });
    } else if (layer === 'clusters') {
      clusterGroups.forEach((group) => {
        const circle = new window.google.maps.Circle({
          map,
          center: { lat: Number(group.lat), lng: Number(group.lng) },
          radius: 300,
          strokeColor: categoryColors[group.category] || '#2563eb',
          strokeOpacity: 0.7,
          strokeWeight: 1,
          fillColor: categoryColors[group.category] || '#2563eb',
          fillOpacity: 0.15,
        });
        overlaysRef.current.push(circle);
        addBounds(Number(group.lat), Number(group.lng));
      });
    } else if (layer === 'recurrence') {
      recurrence.filter((item) => item.probability > 0.3 && wardCenters[item.ward]).forEach((item) => {
        const color = item.probability > 0.7 ? '#ef4444' : item.probability > 0.4 ? '#f59e0b' : '#10b981';
        const centerObj = getWardCenterObject(wardCenters[item.ward]);
        if (!centerObj || !Number.isFinite(centerObj.lat) || !Number.isFinite(centerObj.lng)) return;
        const circle = new window.google.maps.Circle({
          map,
          center: centerObj,
          radius: 400 + item.probability * 600,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: 0.2,
        });
        overlaysRef.current.push(circle);
        addBounds(centerObj.lat, centerObj.lng);
      });
    }

    // Render active missions as glowing sweeps on Google Maps
    if (Array.isArray(missions)) {
      missions.filter(m => m.status === 'active' && m.coordinates).forEach(mission => {
        const position = { lat: Number(mission.coordinates.lat), lng: Number(mission.coordinates.lng) };
        const circle = new window.google.maps.Circle({
          map,
          center: position,
          radius: 200,
          strokeColor: '#ffd700',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#ffd700',
          fillOpacity: 0.25,
        });

        const marker = new window.google.maps.Marker({
          position,
          map,
          title: `MISSION: ${mission.title}`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#ffd700',
            fillOpacity: 0.9,
            strokeWeight: 2,
            strokeColor: '#ffffff',
          },
        });

        marker.addListener('click', () => {
          const content = `
            <div style="font-family: 'Press Start 2P', monospace; min-width: 180px; padding: 4px; line-height: 1.4;">
              <strong style="font-size: 8px; color: var(--accent); display: block; margin-bottom: 4px;">🧭 ${mission.title}</strong>
              <p style="font-size: 6.5px; color: var(--ink-secondary); margin-bottom: 6px;">${mission.description}</p>
              <div style="font-size: 6px; color: var(--success); margin-bottom: 6px;">REWARDS: +${mission.xp_reward} XP · ${mission.gold_reward} GOLD</div>
              <div style="font-size: 6px; color: var(--ink-muted); margin-bottom: 6px;">PROGRESS: ${mission.current_confirmations}/${mission.target_confirmations} CONFIRMATIONS</div>
              <a href="/missions" style="color: var(--accent); font-size: 6px; text-decoration: underline;">GO TO MISSIONS →</a>
            </div>
          `;
          infoWindow.setContent(content);
          infoWindow.open({ anchor: marker, map });
        });

        overlaysRef.current.push(circle);
        overlaysRef.current.push(marker);
        addBounds(position.lat, position.lng);
      });
    }

    const currentDataLength = positions.length;
    const shouldFit = googleLastFitRef.current.layer !== layer || googleLastFitRef.current.dataLength !== currentDataLength;

    if (shouldFit) {
      if (positions.length > 0) {
        if (positions.length === 1) {
          const singlePosition = positions[0];
          map.setCenter(singlePosition);
          map.setZoom(14);
        } else {
          const bounds = new window.google.maps.LatLngBounds();
          positions.forEach((position) => bounds.extend(position));
          map.fitBounds(bounds, 40);
        }
      } else {
        map.setCenter({ lat: center[0], lng: center[1] });
        map.setZoom(zoom);
      }
      googleLastFitRef.current = { layer, dataLength: currentDataLength };
    }
  }, [provider, googleReady, tickets, clusterGroups, recurrence, missions, slaByWard, layer, activeTicketId, onMarkerClick, onMarkerHover, wardCenters, categoryColors, categoryLabels, capitalize, center, zoom]);

  if (provider === 'leaflet') {
    return (
      <div style={{ height: '100%', width: '100%', position: 'relative' }}>
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          attributionControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          
          <MapController
            tickets={tickets}
            clusterGroups={clusterGroups}
            recurrence={recurrence}
            slaByWard={slaByWard}
            layer={layer}
            center={center}
            zoom={zoom}
            wardCenters={wardCenters}
            onMapReady={onMapReady}
            focusCoords={focusCoords}
          />

          {focusCoords && Number.isFinite(Number(focusCoords.lat)) && Number.isFinite(Number(focusCoords.lng)) && (
            <Marker
              position={[Number(focusCoords.lat), Number(focusCoords.lng)]}
              icon={createTempMarkerIcon(focusCoords.isHotspot)}
            >
              <Popup>
                <div className="font-pixel" style={{ padding: '4px', color: 'var(--ink-primary)', maxWidth: '200px' }}>
                  <strong style={{ color: focusCoords.isHotspot ? 'var(--warning)' : 'var(--accent)', fontSize: '10px' }}>
                    {focusCoords.isHotspot ? '🎯 PREDICTED HOTSPOT' : '📍 ACTIVE MISSION OBJECTIVE'}
                  </strong>
                  <p className="text-secondary" style={{ marginTop: '4px', fontSize: '9px', lineHeight: 1.3 }}>
                    Status: Scan target loaded from your Active Missions list.<br/>
                    Coords: {Number(focusCoords.lat).toFixed(5)}, {Number(focusCoords.lng).toFixed(5)}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {(layer === 'reports' || layer === 'verified' || layer === 'sla') &&
            tickets
              .filter((ticket) => {
                const latVal = Number(ticket.lat);
                const lngVal = Number(ticket.lng);
                if (!Number.isFinite(latVal) || !Number.isFinite(lngVal)) return false;
                if (layer === 'reports') return ticket.status !== 'resolved';
                if (layer === 'verified') return ticket.status === 'verified';
                if (layer === 'sla') return ticket.status !== 'resolved' && getSlaRisk(ticket) > 50;
                return false;
              })
              .map((ticket) => (
                <Marker
                  key={`${ticket.id}-${activeTicketId === ticket.id}`}
                  position={[Number(ticket.lat), Number(ticket.lng)]}
                  icon={createLeafletIcon(
                    ticket.priority_score,
                    activeTicketId === ticket.id,
                    ticket.status === 'verified',
                    layer === 'sla' || (ticket.status !== 'resolved' && (getSlaRisk(ticket) > 50 || (ticket.sla_deadline && getTimestampMs(ticket.sla_deadline) < Date.now()))),
                    layer
                  )}
                  eventHandlers={{
                    click: () => onMarkerClick(ticket),
                    mouseover: () => onMarkerHover(ticket),
                    mouseout: () => onMarkerHover(null),
                  }}
                >
                  <Popup>
                    <div className="font-sans" style={{ minWidth: 180, padding: '4px', lineHeight: 1.4 }}>
                      <strong style={{ fontSize: '13px', color: 'var(--ink-primary)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>{ticket.title || ticket.ai_title || 'Untitled Issue'}</strong>
                      <span style={{ color: categoryColors[ticket.category] || 'var(--ink-muted)', fontSize: '10px', display: 'block', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
                        {categoryLabels[ticket.category]?.toUpperCase() || capitalize(ticket.category).toUpperCase()}
                      </span>
                      <div className="text-secondary" style={{ fontSize: '11px', marginBottom: '8px' }}>
                        {ticket.verification_up > 0 ? `✓ ${ticket.verification_up} VOTE${ticket.verification_up > 1 ? 'S' : ''} · ` : ''}{ticket.ward?.toUpperCase() || '—'}
                      </div>
                      {getSlaRisk(ticket) > 0 && (
                        <div className="text-error" style={{ fontSize: '11px', marginBottom: '8px', fontWeight: 600 }}>
                          SLA RISK: {getSlaRisk(ticket)}%
                        </div>
                      )}
                      <Link to={`/ticket/${ticket.id}`} style={{ display: 'inline-block', color: 'var(--accent)', fontSize: '11px', textDecoration: 'underline', fontWeight: 600 }}>
                        VIEW DETAILS →
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              ))}

          {layer === 'clusters' &&
            clusterGroups.map((group, index) => (
              <Circle
                key={`cluster-${index}`}
                center={[Number(group.lat), Number(group.lng)]}
                radius={300}
                pathOptions={{
                  className: 'leaflet-cluster-pulse',
                  color: categoryColors[group.category] || '#2563eb',
                  fillColor: categoryColors[group.category] || '#2563eb',
                  fillOpacity: 0.15,
                  weight: 1,
                }}
              >
                <Tooltip sticky>
                  <div style={{ fontFamily: 'var(--font-sans)' }}>
                    <strong>{group.count} reports</strong> · {categoryLabels[group.category] || capitalize(group.category)}<br/>
                    <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>tracked as 1 cluster (DBSCAN, 500m / 72h)</span>
                  </div>
                </Tooltip>
              </Circle>
            ))}

          {layer === 'recurrence' &&
            recurrence
              .filter((item) => item.probability > 0.3 && wardCenters[item.ward])
              .map((item, index) => {
                const color = '#d946ef';
                const coords = getWardCenterArray(wardCenters[item.ward]);
                if (!coords || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return null;
                return (
                  <Circle
                    key={`recurrence-${index}`}
                    center={coords}
                    radius={400 + item.probability * 600}
                    pathOptions={{
                      className: 'leaflet-hotspot-pulse',
                      color,
                      fillColor: color,
                      fillOpacity: 0.2,
                      weight: 2,
                    }}
                  >
                    <Tooltip sticky>
                      <div style={{ fontFamily: 'var(--font-sans)' }}>
                        <strong>{Math.round(item.probability * 100)}% recurrence</strong> · {item.ward}<br/>
                        <span style={{ fontSize: '0.75rem' }}>{categoryLabels[item.category] || capitalize(item.category)}</span><br/>
                        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{item.recommendedAction || item.recommendation}</span>
                      </div>
                    </Tooltip>
                  </Circle>
                );
              })}

          {Array.isArray(missions) &&
            missions
              .filter(m => m.status === 'active' && m.coordinates)
              .map((mission, index) => {
                const pos = [Number(mission.coordinates.lat), Number(mission.coordinates.lng)];
                return (
                  <div key={`mission-${index}`}>
                    <Circle
                      center={pos}
                      radius={200}
                      pathOptions={{
                        color: '#ffd700',
                        fillColor: '#ffd700',
                        fillOpacity: 0.25,
                        weight: 2,
                        dashArray: '5, 5'
                      }}
                    />
                    <Marker
                      position={pos}
                      icon={L.divIcon({
                        className: 'custom-leaflet-marker-wrapper',
                        html: `
                          <div class="rpg-quest-pin-container active" style="filter: drop-shadow(0 0 8px #ffd700);">
                            <div class="rpg-quest-pin-shadow"></div>
                            <div class="rpg-quest-pin" style="image-rendering: pixelated; font-size: 1.5rem;">🧭</div>
                          </div>
                        `,
                        iconSize: [32, 40],
                        iconAnchor: [16, 40],
                        popupAnchor: [0, -40]
                      })}
                    >
                      <Popup>
                        <div className="font-sans" style={{ minWidth: 180, padding: '4px', lineHeight: 1.4 }}>
                          <strong style={{ fontSize: '13px', color: 'var(--accent)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>🧭 {mission.title}</strong>
                          <p className="text-secondary" style={{ fontSize: '11px', marginBottom: '6px', lineHeight: 1.3 }}>{mission.description}</p>
                          <div className="text-success" style={{ fontSize: '11px', marginBottom: '6px', fontWeight: 600 }}>
                            REWARDS: +{mission.xp_reward} XP · {mission.gold_reward} GOLD
                          </div>
                          <div className="text-muted" style={{ fontSize: '11px', marginBottom: '8px' }}>
                            PROGRESS: {mission.current_confirmations} / {mission.target_confirmations}
                          </div>
                          <Link to="/missions" style={{ display: 'inline-block', color: 'var(--accent)', fontSize: '11px', textDecoration: 'underline', fontWeight: 600 }}>
                            GO TO MISSION BOARD →
                          </Link>
                        </div>
                      </Popup>
                    </Marker>
                  </div>
                );
              })}
        </MapContainer>
      </div>
    );
  }

  if (provider !== 'maps') {
    return null;
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      {loadError ? (
        <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 'var(--space-4)', textAlign: 'center', color: 'var(--ink-muted)' }}>
          {loadError}
        </div>
      ) : (
        <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
      )}
    </div>
  );
}

export default ConfigurableMap;
