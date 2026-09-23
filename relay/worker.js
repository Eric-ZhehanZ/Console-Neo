// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

/*
 * Console Neo relay - Cloudflare Worker + Durable Object edition.
 *
 * One Durable Object per session (named by the host's device ID) holds
 * the host WebSocket and any number of client WebSockets, and relays
 * binary frames between them:
 *
 *   [type u8][connId u32BE][payload]   OPEN=1 DATA=2 CLOSE=3 PING=4 PONG=5
 *
 * The relay holds no conference state and performs no auth beyond
 * routing - connect codes and passkeys are still verified end-to-end
 * by the host's own embedded server. Deploy with:  npx wrangler deploy
 */

/* global WebSocketPair */

import pkg from '../package.json';

const OPEN = 1;
const CLOSE = 3;
const PING = 4;
const PONG = 5;

// A live host pings every 15s; silence past this marks it a zombie
// that a reconnecting host may replace
const HOST_STALE = 45 * 1000;
const SESSION_RE = /^[A-Za-z0-9-]{4,64}$/;

/* The relay is a network service, so it points to its own source (AGPL Section 13) */
const SOURCE_URL = `https://github.com/Eric-ZhehanZ/Console-Neo/tree/v${pkg.version}`;
const INFO = [
  'Console Neo relay',
  `Version ${pkg.version}`,
  'Licensed under AGPL-3.0-or-later',
  `Source: ${SOURCE_URL}`,
  '',
].join('\n');
const SOURCE_HEADERS = { 'content-type': 'text/plain; charset=utf-8', 'x-source-code': SOURCE_URL };

function frame(type, connId) {
  const buf = new Uint8Array(5);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, type);
  dv.setUint32(1, connId >>> 0);
  return buf;
}

function rewriteConnId(data, connId) {
  const out = new Uint8Array(data.byteLength);
  out.set(new Uint8Array(data));
  new DataView(out.buffer).setUint32(1, connId >>> 0);
  return out;
}

export class RelaySession {
  constructor() {
    this.host = null;
    this.hostSeen = 0;
    this.nextId = 1;
    this.byHostId = new Map(); // hostConnId -> { ws, clientConnId }
    this.byClient = new Map(); // client ws -> Map(clientConnId -> hostConnId)
  }

  fetch(request) {
    if(request.headers.get('Upgrade') !== 'websocket')
      return new Response('expected websocket', { status: 426 });

    const role = new URL(request.url).pathname.replace(/^\/+/, '');
    const pair = new WebSocketPair();
    const [clientSide, serverSide] = Object.values(pair);
    serverSide.accept();

    if(role === 'host') this.attachHost(serverSide);
    else this.attachClient(serverSide);

    return new Response(null, { status: 101, webSocket: clientSide });
  }

  attachHost(ws) {
    if(this.host && Date.now() - this.hostSeen < HOST_STALE)
      return void ws.close(4409, 'session taken');

    if(this.host) try {
      this.host.close(1012, 'replaced');
    } catch(e) { }
    this.host = ws;
    this.hostSeen = Date.now();

    ws.addEventListener('message', (ev) => {
      this.hostSeen = Date.now();
      const data = ev.data;
      if(!(data instanceof ArrayBuffer) || data.byteLength < 5) return;
      const dv = new DataView(data);
      const type = dv.getUint8(0);
      const hostId = dv.getUint32(1);
      if(type === PING) return void this.safeSend(ws, frame(PONG, 0));

      const target = this.byHostId.get(hostId);
      if(!target) return;
      this.safeSend(target.ws, rewriteConnId(data, target.clientConnId));
      if(type === CLOSE) {
        this.byHostId.delete(hostId);
        const mine = this.byClient.get(target.ws);
        if(mine) mine.delete(target.clientConnId);
      }
      return undefined;
    });

    const gone = () => {
      if(this.host !== ws) return;
      this.host = null;
      // The host is gone: every client link dies with it
      for(const client of this.byClient.keys()) try {
        client.close(4503, 'host gone');
      } catch(e) { }
      this.byHostId.clear();
      this.byClient.clear();
    };
    ws.addEventListener('close', gone);
    ws.addEventListener('error', gone);

    return undefined;
  }

  attachClient(ws) {
    if(!this.host) return void ws.close(4404, 'no such session');

    this.byClient.set(ws, new Map());

    ws.addEventListener('message', (ev) => {
      const data = ev.data;
      if(!(data instanceof ArrayBuffer) || data.byteLength < 5) return;
      const dv = new DataView(data);
      const type = dv.getUint8(0);
      const clientConnId = dv.getUint32(1);
      if(type === PING) return void this.safeSend(ws, frame(PONG, 0));

      const mine = this.byClient.get(ws);
      if(!mine) return;

      let hostId = mine.get(clientConnId);
      if(type === OPEN) {
        if(hostId !== undefined) return; // duplicate OPEN
        hostId = this.nextId;
        this.nextId += 1;
        mine.set(clientConnId, hostId);
        this.byHostId.set(hostId, { ws, clientConnId });
      }
      if(hostId === undefined || !this.host) return;

      this.safeSend(this.host, rewriteConnId(data, hostId));
      if(type === CLOSE) {
        mine.delete(clientConnId);
        this.byHostId.delete(hostId);
      }
      return undefined;
    });

    const gone = () => {
      const mine = this.byClient.get(ws);
      if(!mine) return;
      this.byClient.delete(ws);
      // Tell the host each of this device's streams is gone
      for(const hostId of mine.values()) {
        this.byHostId.delete(hostId);
        if(this.host) this.safeSend(this.host, frame(CLOSE, hostId));
      }
    };
    ws.addEventListener('close', gone);
    ws.addEventListener('error', gone);

    return undefined;
  }

  safeSend(ws, data) {
    try {
      ws.send(data);
    } catch(e) { }
  }
}

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    const role = url.pathname.replace(/^\/+/, '');
    const session = (url.searchParams.get('session') || '').toUpperCase();

    if(role !== 'host' && role !== 'join')
      return new Response(INFO, { status: 200, headers: SOURCE_HEADERS });
    if(!SESSION_RE.test(session))
      return new Response('bad session', { status: 400, headers: SOURCE_HEADERS });

    const stub = env.SESSIONS.get(env.SESSIONS.idFromName(session));
    return stub.fetch(request);
  },
};
