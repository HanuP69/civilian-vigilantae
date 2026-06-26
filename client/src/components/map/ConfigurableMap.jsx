import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, Circle, Tooltip, useMap } from 'react-leaflet';

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

function createLeafletIcon(priorityScore, isActive) {
  const color = getMarkerColor(priorityScore);
  const scale = isActive ? 'scale(1.3)' : 'scale(1)';
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div style="
      width: 14px; height: 14px; 
      background-color: ${color}; 
      border: 2px solid ${isActive ? '#ffffff' : '#0f172a'}; 
      border-radius: 50%;
      box-shadow: 2px 2px 6px rgba(0,0,0,0.5);
      transform: ${scale};
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
}

function MapController({ tickets, clusterGroups, recurrence, slaByWard, layer, center, zoom, wardCenters, onMapReady }) {
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

    let currentDataLength = 0;
    const positions = [];
    if (layer === 'reports') {
      const activeTickets = tickets.filter(t => t.lat && t.lng);
      currentDataLength = activeTickets.length;
      activeTickets.forEach(t => {
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
        const c = wardCenters[item.ward];
        positions.push([c.lat, c.lng]);
      });
    } else if (layer === 'sla') {
      const activeSla = Object.entries(slaByWard).filter(([ward]) => wardCenters[ward]);
      currentDataLength = activeSla.length;
      activeSla.forEach(([ward]) => {
        const c = wardCenters[ward];
        positions.push([c.lat, c.lng]);
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
  }, [tickets, clusterGroups, recurrence, slaByWard, layer, center, zoom, wardCenters, map]);

  return null;
}

function ConfigurableMap({
  provider = 'maps',
  center = [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
  zoom = 12,
  tickets = [],
  clusterGroups = [],
  recurrence = [],
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

    if (layer === 'reports') {
      tickets.filter((ticket) => ticket.lat && ticket.lng).forEach((ticket) => {
        const position = { lat: Number(ticket.lat), lng: Number(ticket.lng) };
        const marker = new window.google.maps.Marker({
          position,
          map,
          title: ticket.title || ticket.ai_title || 'Report',
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: activeTicketId === ticket.id ? 9 : 7,
            fillColor: getMarkerColor(ticket.priority_score),
            fillOpacity: 0.95,
            strokeColor: activeTicketId === ticket.id ? '#ffffff' : '#0f172a',
            strokeWeight: activeTicketId === ticket.id ? 3 : 2,
          },
          zIndex: activeTicketId === ticket.id ? 1000 : 0,
        });

        marker.addListener('click', () => {
          onMarkerClick(ticket);
          const content = `
            <div style="font-family: var(--font-sans); min-width: 180px;">
              <strong>${ticket.title || ticket.ai_title || 'Report'}</strong><br/>
              <span style="color:${categoryColors[ticket.category] || 'var(--ink-muted)'}; font-size:0.75rem;">${categoryLabels[ticket.category] || capitalize(ticket.category)}</span>
              <div style="margin: 6px 0; font-size: 0.75rem;">${ticket.verification_up > 0 ? `✓ ${ticket.verification_up} verified · ` : ''}${ticket.ward || '—'}</div>
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
        const circle = new window.google.maps.Circle({
          map,
          center: wardCenters[item.ward],
          radius: 400 + item.probability * 600,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: 0.2,
        });
        overlaysRef.current.push(circle);
        addBounds(wardCenters[item.ward].lat, wardCenters[item.ward].lng);
      });
    } else if (layer === 'sla') {
      Object.entries(slaByWard).filter(([ward]) => wardCenters[ward]).forEach(([ward, values]) => {
        const ratio = values.total > 0 ? values.breached / values.total : 0;
        const color = ratio > 0.5 ? '#ef4444' : ratio > 0.25 ? '#f59e0b' : '#10b981';
        const circle = new window.google.maps.Circle({
          map,
          center: wardCenters[ward],
          radius: 500,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: 0.18,
          strokePattern: '4 4',
        });
        overlaysRef.current.push(circle);
        addBounds(wardCenters[ward].lat, wardCenters[ward].lng);
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
  }, [provider, googleReady, tickets, clusterGroups, recurrence, slaByWard, layer, activeTicketId, onMarkerClick, onMarkerHover, wardCenters, categoryColors, categoryLabels, capitalize, center, zoom]);

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
          />

          {layer === 'reports' &&
            tickets
              .filter((ticket) => ticket.lat && ticket.lng)
              .map((ticket) => (
                <Marker
                  key={`${ticket.id}-${activeTicketId === ticket.id}`}
                  position={[Number(ticket.lat), Number(ticket.lng)]}
                  icon={createLeafletIcon(ticket.priority_score, activeTicketId === ticket.id)}
                  eventHandlers={{
                    click: () => onMarkerClick(ticket),
                    mouseover: () => onMarkerHover(ticket),
                    mouseout: () => onMarkerHover(null),
                  }}
                >
                  <Popup>
                    <div style={{ fontFamily: 'var(--font-sans)', minWidth: 180 }}>
                      <strong>{ticket.title || ticket.ai_title || 'Report'}</strong><br/>
                      <span style={{ color: categoryColors[ticket.category] || 'var(--ink-muted)', fontSize: '0.75rem' }}>
                        {categoryLabels[ticket.category] || capitalize(ticket.category)}
                      </span>
                      <div style={{ margin: '6px 0', fontSize: '0.75rem' }}>
                        {ticket.verification_up > 0 ? `✓ ${ticket.verification_up} verified · ` : ''}{ticket.ward || '—'}
                      </div>
                      <Link to={`/ticket/${ticket.id}`} style={{ display: 'inline-block', marginTop: '4px', fontWeight: 600 }}>
                        View Details →
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
                const color = item.probability > 0.7 ? '#ef4444' : item.probability > 0.4 ? '#f59e0b' : '#10b981';
                const centerCoord = wardCenters[item.ward];
                return (
                  <Circle
                    key={`recurrence-${index}`}
                    center={[centerCoord.lat, centerCoord.lng]}
                    radius={400 + item.probability * 600}
                    pathOptions={{
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

          {layer === 'sla' &&
            Object.entries(slaByWard)
              .filter(([ward]) => wardCenters[ward])
              .map(([ward, values], index) => {
                const ratio = values.total > 0 ? values.breached / values.total : 0;
                const color = ratio > 0.5 ? '#ef4444' : ratio > 0.25 ? '#f59e0b' : '#10b981';
                const centerCoord = wardCenters[ward];
                return (
                  <Circle
                    key={`sla-${index}`}
                    center={[centerCoord.lat, centerCoord.lng]}
                    radius={500}
                    pathOptions={{
                      color,
                      fillColor: color,
                      fillOpacity: 0.18,
                      weight: 2,
                      dashArray: '4 4',
                    }}
                  >
                    <Tooltip sticky>
                      <div style={{ fontFamily: 'var(--font-sans)' }}>
                        <strong>{ward}</strong><br/>
                        <span style={{ color }}>{values.breached}</span> / {values.total} tickets past SLA<br/>
                        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{Math.round(ratio * 100)}% breach rate</span>
                      </div>
                    </Tooltip>
                  </Circle>
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
