const clients = new Map();
let clientIdCounter = 0;

export function addClient(userId, res) {
  const id = ++clientIdCounter;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
    'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*',
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id })}\n\n`);

  // Heartbeat every 25s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) { clearInterval(heartbeat); }
  }, 25000);

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
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [id, client] of clients) {
    safeWrite(client.res, payload, id);
  }
}

export function sendToUser(userId, event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [id, client] of clients) {
    if (client.userId === userId) {
      safeWrite(client.res, payload, id);
    }
  }
}

export function getClientCount() { return clients.size; }
export function getClients() { return [...clients.values()]; }
