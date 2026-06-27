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

export function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [, client] of clients) {
    try { client.res.write(payload); } catch (_) {}
  }
}

export function sendToUser(userId, event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [, client] of clients) {
    if (client.userId === userId) {
      try { client.res.write(payload); } catch (_) {}
    }
  }
}

export function getClientCount() { return clients.size; }
export function getClients() { return [...clients.values()]; }
