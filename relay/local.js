/*
 * Console Neo relay - plain Node edition.
 *
 * Same wire protocol as the Cloudflare Worker (relay/worker.js): binary
 * frames [type u8][connId u32BE][payload], one multiplexed WebSocket per
 * device. Run it anywhere Node runs:
 *
 *   node relay/local.js            # listens on :8787
 *   RELAY_PORT=9000 node relay/local.js
 *
 * The relay holds no conference state and performs no auth beyond
 * routing - connect codes and passkeys are still verified end-to-end
 * by the host's own embedded server.
 */
const http = require('http');
const { WebSocketServer } = require('ws');

const OPEN = 1;
const CLOSE = 3;
const PING = 4;
const PONG = 5;

// A live host pings every 15s; silence past this marks it a zombie
// that a reconnecting host may replace
const HOST_STALE = 45 * 1000;
const SESSION_RE = /^[A-Za-z0-9-]{4,64}$/;

const frame = (type, connId, payload) => {
  const head = Buffer.alloc(5);
  head.writeUInt8(type, 0);
  head.writeUInt32BE(connId >>> 0, 1);
  return payload && payload.length ? Buffer.concat([head, payload]) : head;
};

// session -> { host, hostSeen, nextId, byHostId: Map, byClient: Map }
const sessions = new Map();

function getSession(id) {
  let s = sessions.get(id);
  if(!s) {
    s = { host: null, hostSeen: 0, nextId: 1, byHostId: new Map(), byClient: new Map() };
    sessions.set(id, s);
  }
  return s;
}

function attachHost(s, ws) {
  if(s.host && s.host.readyState === s.host.OPEN && Date.now() - s.hostSeen < HOST_STALE)
    return void ws.close(4409, 'session taken');

  if(s.host) try {
    s.host.terminate();
  } catch(e) { }
  s.host = ws;
  s.hostSeen = Date.now();

  ws.on('message', (data) => {
    s.hostSeen = Date.now();
    if(!Buffer.isBuffer(data) || data.length < 5) return;
    const type = data.readUInt8(0);
    const hostId = data.readUInt32BE(1);
    if(type === PING) return void ws.send(frame(PONG, 0));

    const target = s.byHostId.get(hostId);
    if(!target) return;
    const out = Buffer.from(data);
    out.writeUInt32BE(target.clientConnId >>> 0, 1);
    try {
      target.ws.send(out);
    } catch(e) { }
    if(type === CLOSE) {
      s.byHostId.delete(hostId);
      const mine = s.byClient.get(target.ws);
      if(mine) mine.delete(target.clientConnId);
    }
    return undefined;
  });

  ws.on('close', () => {
    if(s.host !== ws) return;
    s.host = null;
    // The host is gone: every client link dies with it
    for(const client of s.byClient.keys()) try {
      client.close(4503, 'host gone');
    } catch(e) { }
    s.byHostId.clear();
    s.byClient.clear();
  });
}

function attachClient(s, ws) {
  if(!s.host || s.host.readyState !== s.host.OPEN)
    return void ws.close(4404, 'no such session');

  s.byClient.set(ws, new Map());

  ws.on('message', (data) => {
    if(!Buffer.isBuffer(data) || data.length < 5) return;
    const type = data.readUInt8(0);
    const clientConnId = data.readUInt32BE(1);
    if(type === PING) return void ws.send(frame(PONG, 0));

    const mine = s.byClient.get(ws);
    if(!mine) return;

    let hostId = mine.get(clientConnId);
    if(type === OPEN) {
      if(hostId !== undefined) return; // duplicate OPEN
      hostId = s.nextId;
      s.nextId += 1;
      mine.set(clientConnId, hostId);
      s.byHostId.set(hostId, { ws, clientConnId });
    }
    if(hostId === undefined || !s.host) return;

    const out = Buffer.from(data);
    out.writeUInt32BE(hostId >>> 0, 1);
    try {
      s.host.send(out);
    } catch(e) { }
    if(type === CLOSE) {
      mine.delete(clientConnId);
      s.byHostId.delete(hostId);
    }
    return undefined;
  });

  ws.on('close', () => {
    const mine = s.byClient.get(ws);
    if(!mine) return;
    s.byClient.delete(ws);
    // Tell the host each of this device's streams is gone
    for(const hostId of mine.values()) {
      s.byHostId.delete(hostId);
      if(s.host) try {
        s.host.send(frame(CLOSE, hostId));
      } catch(e) { }
    }
  });

  return undefined;
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('Console Neo relay\n');
});

const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://relay');
  const session = url.searchParams.get('session') || '';
  const role = url.pathname.replace(/^\/+/, '');

  if((role !== 'host' && role !== 'join') || !SESSION_RE.test(session)) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    return void socket.destroy();
  }

  return void wss.handleUpgrade(req, socket, head, (ws) => {
    const s = getSession(session.toUpperCase());
    if(role === 'host') attachHost(s, ws);
    else attachClient(s, ws);
  });
});

// Empty, hostless sessions get swept
setInterval(() => {
  for(const [id, s] of sessions)
    if(!s.host && s.byClient.size === 0) sessions.delete(id);
}, 60 * 1000);

const PORT = Number(process.env.RELAY_PORT) || 8787;
server.listen(PORT, () => console.log(`[RELAY] listening on :${PORT}`));
