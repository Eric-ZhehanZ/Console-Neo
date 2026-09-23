const net = require('net');
const WebSocket = require('ws');

/*
 * Relay tunnel: lets a client reach the host's embedded socket.io server
 * when they do not share a LAN. The relay is a dumb pipe - all session
 * auth (connect codes, passkeys, tokens) still happens end-to-end
 * against the host's own server.
 *
 *   client app -> 127.0.0.1:<n> ==WSS==> relay <==WSS== host agent -> 127.0.0.1:3066
 *
 * Frame format (binary): [type u8][connId u32BE][payload...]
 * One WebSocket per device carries any number of multiplexed streams.
 */

const OPEN = 1;
const DATA = 2;
const CLOSE = 3;
const PING = 4;
const PONG = 5;

// Stay well under the relay's per-message ceiling (1MB on Workers)
const CHUNK = 256 * 1024;

const PING_INTERVAL = 15 * 1000;
const PONG_TIMEOUT = 40 * 1000;

function frame(type, connId, payload) {
  const head = Buffer.alloc(5);
  head.writeUInt8(type, 0);
  head.writeUInt32BE(connId >>> 0, 1);
  return payload && payload.length ? Buffer.concat([head, payload]) : head;
}

function parse(buf) {
  if(!buf || buf.length < 5) return null;
  return {
    type: buf.readUInt8(0),
    connId: buf.readUInt32BE(1),
    payload: buf.length > 5 ? buf.slice(5) : Buffer.alloc(0),
  };
}

function sendChunked(ws, connId, data) {
  for(let off = 0; off < data.length; off += CHUNK)
    ws.send(frame(DATA, connId, data.slice(off, off + CHUNK)));
}

/** http(s)://relay -> ws(s)://relay/<path>?session=<id> */
function wsUrl(base, path, session) {
  let b = (base || '').trim().replace(/\/+$/, '');
  if(/^https:/i.test(b)) b = b.replace(/^https:/i, 'wss:');
  else if(/^http:/i.test(b)) b = b.replace(/^http:/i, 'ws:');
  else if(!/^wss?:/i.test(b)) b = `wss://${b}`;
  return `${b}/${path}?session=${encodeURIComponent(session)}&v=1`;
}

/**
 * Keeps one WebSocket alive with reconnection and app-level heartbeat.
 * handlers: { onFrame, onUp, onDown, onReject(code) }
 */
function persistentWs(url, handlers) {
  let ws = null;
  let stopped = false;
  let backoff = 1000;
  let pingTimer = null;
  let lastPong = 0;

  const clearPing = () => {
    if(pingTimer) clearInterval(pingTimer);
    pingTimer = null;
  };

  const connect = () => {
    if(stopped) return;
    ws = new WebSocket(url, { perMessageDeflate: false });
    ws.binaryType = 'nodebuffer';

    ws.on('open', () => {
      backoff = 1000;
      lastPong = Date.now();
      clearPing();
      pingTimer = setInterval(() => {
        if(Date.now() - lastPong > PONG_TIMEOUT) return void ws.terminate();
        try {
          ws.send(frame(PING, 0));
        } catch(e) { }
        return undefined;
      }, PING_INTERVAL);
      handlers.onUp();
    });

    ws.on('message', (data) => {
      const f = parse(Buffer.isBuffer(data) ? data : Buffer.from(data));
      if(!f) return;
      if(f.type === PONG) {
        lastPong = Date.now();
        return;
      }
      if(f.type === PING) {
        try {
          ws.send(frame(PONG, 0));
        } catch(e) { }
        return;
      }
      handlers.onFrame(f);
    });

    ws.on('close', (code) => {
      clearPing();
      handlers.onDown();
      // 44xx are deliberate relay verdicts (no session / session taken)
      if(code >= 4400 && code < 4500) {
        if(handlers.onReject) handlers.onReject(code);
        if(code === 4409) {
          // Usually our own zombie registration after a silent drop -
          // the relay forgets it within a minute, so keep knocking
          if(!stopped) setTimeout(connect, 20 * 1000);
          return;
        }
      }
      if(!stopped) {
        setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 15 * 1000);
      }
    });

    ws.on('error', () => { /* close follows */ });
  };

  connect();

  return {
    send(buf) {
      if(ws && ws.readyState === WebSocket.OPEN) ws.send(buf);
    },
    up() {
      return Boolean(ws && ws.readyState === WebSocket.OPEN);
    },
    stop() {
      stopped = true;
      clearPing();
      if(ws) try {
        ws.close();
      } catch(e) { }
    },
  };
}

/**
 * Host side: registers the session at the relay and pipes every stream
 * the relay opens into the local embedded server.
 */
function startHostAgent({ relayUrl, session, localPort, onStatus }) {
  const conns = new Map(); // connId -> { sock, ready, queue }
  const status = s => { if(onStatus) onStatus(s); };

  const dropAll = () => {
    for(const c of conns.values()) try {
      c.sock.destroy();
    } catch(e) { }
    conns.clear();
  };

  const link = persistentWs(wsUrl(relayUrl, 'host', session), {
    onUp: () => status('connected'),
    onDown: () => {
      dropAll();
      status('disconnected');
    },
    onReject: (code) => status(code === 4409 ? 'taken' : 'rejected'),

    onFrame: (f) => {
      if(f.type === OPEN) {
        const sock = net.connect(localPort, '127.0.0.1');
        const c = { sock, ready: false, queue: [] };
        conns.set(f.connId, c);
        sock.on('connect', () => {
          c.ready = true;
          for(const buf of c.queue) sock.write(buf);
          c.queue = [];
        });
        sock.on('data', d => sendChunked(link, f.connId, d));
        const bye = () => {
          if(!conns.has(f.connId)) return;
          conns.delete(f.connId);
          link.send(frame(CLOSE, f.connId));
        };
        sock.on('close', bye);
        sock.on('error', bye);
      } else if(f.type === DATA) {
        const c = conns.get(f.connId);
        if(!c) return;
        if(c.ready) c.sock.write(f.payload);
        else c.queue.push(f.payload);
      } else if(f.type === CLOSE) {
        const c = conns.get(f.connId);
        if(!c) return;
        conns.delete(f.connId);
        try {
          c.sock.destroy();
        } catch(e) { }
      }
    },
  });

  return {
    stop() {
      link.stop();
      dropAll();
    },
  };
}

/**
 * Client side: a loopback TCP server whose every connection becomes a
 * multiplexed stream to the host through the relay. Resolves with the
 * local port once the relay link is up; rejects with Error('NoSession')
 * when the relay does not know the session.
 */
function startClientTunnel({ relayUrl, session }) {
  return new Promise((resolve, reject) => {
    const conns = new Map(); // connId -> local socket
    let nextId = 1;
    let settled = false;
    let server = null;

    const dropAll = () => {
      for(const sock of conns.values()) try {
        sock.destroy();
      } catch(e) { }
      conns.clear();
    };

    const link = persistentWs(wsUrl(relayUrl, 'join', session), {
      onDown: dropAll,
      onReject: (code) => {
        if(!settled) {
          settled = true;
          link.stop();
          reject(new Error(code === 4404 ? 'NoSession' : 'Rejected'));
        }
      },

      onFrame: (f) => {
        const sock = conns.get(f.connId);
        if(!sock) return;
        if(f.type === DATA) sock.write(f.payload);
        else if(f.type === CLOSE) {
          conns.delete(f.connId);
          try {
            sock.destroy();
          } catch(e) { }
        }
      },

      onUp: () => {
        if(settled) return;
        settled = true;

        server = net.createServer((sock) => {
          if(!link.up()) return void sock.destroy();
          const id = nextId;
          nextId += 1;
          conns.set(id, sock);
          link.send(frame(OPEN, id));
          sock.on('data', d => sendChunked(link, id, d));
          const bye = () => {
            if(!conns.has(id)) return;
            conns.delete(id);
            link.send(frame(CLOSE, id));
          };
          sock.on('close', bye);
          sock.on('error', bye);
          return undefined;
        });

        server.listen(0, '127.0.0.1', () => {
          resolve({
            port: server.address().port,
            stop() {
              link.stop();
              dropAll();
              try {
                server.close();
              } catch(e) { }
            },
          });
        });
      },
    });

    // Never reached the relay at all
    setTimeout(() => {
      if(!settled) {
        settled = true;
        link.stop();
        reject(new Error('Unreachable'));
      }
    }, 8000);
  });
}

module.exports = { startHostAgent, startClientTunnel };
