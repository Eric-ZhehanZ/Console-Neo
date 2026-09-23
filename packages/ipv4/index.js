// SPDX-License-Identifier: Apache-2.0 AND AGPL-3.0-or-later
// Based on local-ipv4-address, Copyright Ben Hutchison, Apache License 2.0 (see LICENSE in this folder)
// Modifications Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE at the repository root for terms.

const os = require('os');
const dgram = require('dgram');

// Interfaces that never carry the LAN address we want to advertise
const SKIP = /^(lo|utun|awdl|llw|bridge|vmnet|docker|veth|tun|tap|anpi|ap\d)/i;

function fromInterfaces() {
  const ifs = os.networkInterfaces();
  const candidates = [];
  for(const name of Object.keys(ifs)) {
    if(SKIP.test(name)) continue;
    for(const addr of ifs[name])
      if((addr.family === 'IPv4' || addr.family === 4) && !addr.internal)
        candidates.push({ name, address: addr.address });
  }
  if(candidates.length === 0) return null;

  // Prefer real LAN addresses on primary interfaces over link-local leftovers
  const score = (c) => {
    let s = 0;
    if(/^(en|eth|wl)/i.test(c.name)) s += 2;
    if(/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(c.address)) s += 4;
    if(!/^169\.254\./.test(c.address)) s += 1;
    return s;
  };
  candidates.sort((a, b) => score(b) - score(a));
  return candidates[0].address;
}

// Ask the OS which local address routes outward - no packets are actually sent
function fromRouting() {
  return new Promise((resolve) => {
    let done = false;
    let sock = null;
    const finish = (v) => {
      if(done) return;
      done = true;
      if(sock) try {
        sock.close();
      } catch(e) { }
      resolve(v);
    };

    try {
      sock = dgram.createSocket('udp4');
    } catch(e) {
      return void finish(null);
    }

    const timer = setTimeout(() => finish(null), 300);
    sock.on('error', () => {
      clearTimeout(timer);
      finish(null);
    });

    try {
      sock.connect(53, '8.8.8.8', () => {
        clearTimeout(timer);
        try {
          finish(sock.address().address);
        } catch(e) {
          finish(null);
        }
      });
    } catch(e) {
      clearTimeout(timer);
      finish(null);
    }

    return undefined;
  });
}

function realAddresses() {
  const ifs = os.networkInterfaces();
  const out = new Set();
  for(const name of Object.keys(ifs)) {
    if(SKIP.test(name)) continue;
    for(const addr of ifs[name])
      if((addr.family === 'IPv4' || addr.family === 4) && !addr.internal)
        out.add(addr.address);
  }
  return out;
}

module.exports = () => fromRouting().then((ip) => {
  // Trust the default-route address only when it belongs to a real
  // interface - VPN/tunnel interfaces (utun etc.) often own the default
  // route but their address is useless to other devices on the LAN
  if(ip && !/^127\./.test(ip) && realAddresses().has(ip)) return ip;

  const fallback = fromInterfaces();
  if(fallback) return fallback;
  if(ip && !/^127\./.test(ip)) return ip;
  throw new Error('No active IPv4 address found');
});
