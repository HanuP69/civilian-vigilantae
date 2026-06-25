import { processSchedulerTick } from '../agent/orchestrator.js';
import { broadcast } from '../services/sseService.js';

let intervalId = null;
const TICK_INTERVAL = 5 * 60 * 1000;

export function startScheduler() {
  if (intervalId) return;
  console.log('[Scheduler] Started — SLA ticks every 5 minutes');
  intervalId = setInterval(async () => {
    try {
      console.log('[Scheduler] Running SLA tick...');
      const result = await processSchedulerTick((step) => {
        broadcast('agent_step', step);
      });
      console.log(`[Scheduler] Processed ${result.processed} open tickets`);
    } catch (err) {
      console.error('[Scheduler] Error:', err.message);
    }
  }, TICK_INTERVAL);
}

export function stopScheduler() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}
