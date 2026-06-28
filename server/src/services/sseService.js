import { EventEmitter } from 'events';

const clients = new Map();
let clientIdCounter = 0;

// ─── Scale-out Pub/Sub Broker Pattern (T1-4 scale-out support) ──────
class SSEBroker extends EventEmitter {
  constructor() {
    super();
    // Under cluster scale-out, this hooks into Redis pubsub:
    // redisClient.subscribe('sse-broadcast', (msg) => this.emit('message', JSON.parse(msg)));
  }

  publish(event, data, targetUserId = null) {
    this.emit('message', { event, data, targetUserId });
  }
}

export const broker = new SSEBroker();

// Listen to broker events to push to local connections
broker.on('message', ({ event, data, targetUserId }) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [id, client] of clients) {
    if (!targetUserId || client.userId === targetUserId) {
      safeWrite(client.res, payload, id);
    }
  }
});

export function addClient(userId, res) {
  const id = ++clientIdCounter;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
    'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*',
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id })}\n\n`);

  // Adaptive Heartbeat (I1-4): increase to 50s on mobile to reduce battery drain
  const userAgent = res.req?.headers?.['user-agent'] || '';
  const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent);
  const heartbeatInterval = isMobile ? 50000 : 25000;

  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) { clearInterval(heartbeat); }
  }, heartbeatInterval);

  clients.set(id, { userId, res });
  res.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(id);
  });
  return id;
}

function safeWrite(clientRes, payload, id) {
  try {
    const ok = clientRes.write(payload);
    if (!ok) {
      console.warn(`[SSE] Backpressure detected on client connection ${id}`);
    }
    return ok;
  } catch (err) {
    console.error(`[SSE] Write failed on client connection ${id}, removing client:`, err.message);
    clients.delete(id);
    return false;
  }
}

export function broadcast(event, data) {
  broker.publish(event, data);
}

export function sendToUser(userId, event, data) {
  broker.publish(event, data, userId);
}

export function getClientCount() { return clients.size; }
export function getClients() { return [...clients.values()]; }
