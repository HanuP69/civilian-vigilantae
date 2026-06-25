const clients = new Map();
let clientIdCounter = 0;

export function addClient(userId, res) {
  const id = ++clientIdCounter;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
    'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*',
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id })}\n\n`);
  clients.set(id, { userId, res });
  res.on('close', () => clients.delete(id));
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
