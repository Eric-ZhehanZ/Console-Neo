// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

const os = require('os');
const http = require('http');
const https = require('https');

/*
 * Whether this device currently sits on any local network at all.
 * Pure interface enumeration - one cheap syscall, safe to poll.
 *
 * Tunnels (VPN etc.) never provide LAN reachability and are skipped.
 * Bridge interfaces DO count: a device-initiated hotspot (Internet
 * Sharing) surfaces as bridge100 and is a perfectly good local network.
 * Link-local 169.254.x addresses count too - two devices on a
 * DHCP-less link can still reach each other.
 */
const TUNNEL = /^(lo|utun|awdl|llw|vmnet|docker|veth|tun|tap|anpi)/i;

function hasLocalNetwork() {
  const ifs = os.networkInterfaces();
  for(const name of Object.keys(ifs)) {
    if(TUNNEL.test(name)) continue;
    for(const addr of ifs[name])
      if((addr.family === 'IPv4' || addr.family === 4) && !addr.internal)
        return true;
  }
  return false;
}

/*
 * Whether the relay is reachable from this device - the other half of
 * "can we collaborate at all", for the case where there is no shared
 * LAN. Unlike hasLocalNetwork() this one touches the wire, so it is
 * polled far more lazily.
 *
 * Any HTTP answer counts as reachable, whatever the status: a custom
 * relay is free to redirect the root path or refuse it outright, and
 * what we are really asking is whether packets made the round trip.
 *
 * Node's http module rather than fetch: the renderer's origin is
 * file://, the worker sends no CORS headers, and an opaque no-cors
 * response cannot tell a live relay from a dead one.
 */
function probeRelay(target, timeout) {
  return new Promise((resolve) => {
    let url = null;
    try {
      url = new URL(target);
    } catch(e) {
      url = null;
    }
    if(!url || !url.hostname) return void resolve(false);

    // Settings accepts a websocket URL just as happily as an http one
    const scheme = { 'ws:': 'http:', 'wss:': 'https:' }[url.protocol] || url.protocol;
    if(scheme !== 'http:' && scheme !== 'https:') return void resolve(false);

    let settled = false;
    const finish = (ok) => {
      if(settled) return;
      settled = true;
      resolve(ok);
    };

    let req = null;
    try {
      req = (scheme === 'http:' ? http : https).get({
        protocol: scheme,
        hostname: url.hostname,
        port: url.port || undefined,
        path: url.pathname || '/',
      }, (res) => {
        res.resume(); // drain, we only care that it answered
        finish(true);
      });
    } catch(e) {
      return void finish(false);
    }

    req.on('error', () => finish(false));
    req.setTimeout(timeout || 5000, () => {
      req.destroy();
      finish(false);
    });
    return undefined;
  });
}

module.exports = { hasLocalNetwork, probeRelay };
