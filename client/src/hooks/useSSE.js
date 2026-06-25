import { useState, useEffect, useRef } from 'react';

export function useSSE(url = '/api/events') {
  const [events, setEvents] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const sourceRef = useRef(null);

  useEffect(() => {
    const es = new EventSource(url);
    sourceRef.current = es;
    es.onopen = () => setIsConnected(true);
    es.addEventListener('connected', () => setIsConnected(true));
    const handler = (type) => (e) => {
      try {
        const data = JSON.parse(e.data);
        setEvents(prev => [...prev.slice(-50), { type, data, ts: Date.now() }]);
      } catch {}
    };
    ['ticket_created', 'ticket_updated', 'agent_step', 'verification_recorded'].forEach(t =>
      es.addEventListener(t, handler(t))
    );
    es.onerror = () => setIsConnected(false);
    return () => es.close();
  }, [url]);

  return { events, isConnected };
}
