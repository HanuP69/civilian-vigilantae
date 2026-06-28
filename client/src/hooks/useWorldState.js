import { useEffect, useMemo, useState } from 'react';
import { fetchTickets } from '../services/api';
import { useWorldMood } from '../components/world/WorldBackdrop';

// Mirrors the orchestrator's own escalation threshold (agent/orchestrator.js:470)
// so "storm" weather means the same thing the agent considers SLA-critical.
const SLA_RISK_BREACH_THRESHOLD = 80;

/**
 * Polls a lightweight summary of civic health to drive the world's mood.
 * Deliberately decoupled from page-level fetches (HomePage etc.) so the
 * backdrop keeps working even on pages that don't load ticket data
 * (login, profile, ...). Polls slowly — this is ambience, not a dashboard.
 */
export function useWorldState({ isAuthenticated }) {
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchTickets({});
        if (cancelled) return;
        setTickets(Array.isArray(data) ? data : data.tickets || []);
      } catch {
        /* ambience only — fail silently */
      }
    };

    load();
    const interval = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isAuthenticated]);

  const slaBreachCount = useMemo(
    () => tickets.filter(t =>
      t.status !== 'resolved' &&
      (t.is_breached || (t.sla_risk_score ?? 0) >= SLA_RISK_BREACH_THRESHOLD)
    ).length,
    [tickets]
  );

  const mood = useWorldMood({ tickets, slaBreachCount });
  return mood;
}
