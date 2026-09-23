// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

/* eslint-disable */
const path = require('path');
const http = require('http');
const REPO = path.resolve(__dirname, '../../..');
const WebSocket = require(path.join(REPO, 'node_modules/ws'));

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getJSON(url) {
  return new Promise((res, rej) => http.get(url, r => {
    let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch(e) { rej(e); } });
  }).on('error', rej));
}

async function attach(port, match) {
  let t;
  for(let i = 0; i < 80 && !t; i++) {
    try { t = (await getJSON(`http://127.0.0.1:${port}/json`)).find(x => x.type === 'page' && x.url.includes(match)); } catch(e) {}
    if(!t) await sleep(500);
  }
  if(!t) throw new Error(`no target ${match}`);
  const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  await new Promise(r => ws.on('open', r));
  let id = 0; const pending = {};
  ws.on('message', m => { const d = JSON.parse(m); if(d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; } });
  const send = (method, params) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if(r.result && r.result.exceptionDetails) throw new Error(`${expr.slice(0, 200)}\n→ ${JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description)}`);
    return r.result.result.value;
  };
  const waitFor = async (expr, ms = 15000) => {
    const end = Date.now() + ms;
    while(Date.now() < end) { try { if(await ev(expr)) return true; } catch(e) {} await sleep(200); }
    throw new Error(`timeout: ${expr}`);
  };
  const shot = async (file) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    require('fs').writeFileSync(file, Buffer.from(r.result.data, 'base64'));
  };
  return { ev, waitFor, shot, send, close: () => ws.close() };
}

module.exports = { attach, sleep };
