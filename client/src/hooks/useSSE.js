import { useState, useEffect, useRef } from 'react';

export function useSSE(url = '/api/events') {
  const [events, setEvents] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const sourceRef = useRef(null);
  const reconnectDelayRef = useRef(1000);

  useEffect(() => {
    let active = true;

    function connect() {
      if (!active) return;
      const token = localStorage.getItem('userId') || 'anonymous';
      const connectionUrl = `${url}?token=${encodeURIComponent(token)}`;

      const es = new EventSource(connectionUrl);
      sourceRef.current = es;

      es.onopen = () => {
        if (!active) return;
        setIsConnected(true);
        reconnectDelayRef.current = 1000; // reset delay
      };

      es.addEventListener('connected', () => {
        if (!active) return;
        setIsConnected(true);
        reconnectDelayRef.current = 1000;
      });

      const handler = (type) => (e) => {
        if (!active) return;
        try {
          const data = JSON.parse(e.data);
          setEvents(prev => [...prev.slice(-50), { type, data, ts: Date.now() }]);
        } catch {}
      };

      ['ticket_created', 'ticket_updated', 'agent_step', 'verification_recorded'].forEach(t =>
        es.addEventListener(t, handler(t))
      );

      es.onerror = () => {
        if (!active) return;
        setIsConnected(false);
        es.close();

        // Exponential backoff reconnection
        const delay = reconnectDelayRef.current;
        console.warn(`[useSSE] Stream error, retrying connect in ${delay}ms`);
        setTimeout(() => {
          if (active) {
            reconnectDelayRef.current = Math.min(delay * 2, 30000);
            connect();
          }
        }, delay);
      };
    }

    connect();

    return () => {
      active = false;
      if (sourceRef.current) {
        sourceRef.current.close();
      }
    };
  }, [url]);

  return { events, isConnected };
}
