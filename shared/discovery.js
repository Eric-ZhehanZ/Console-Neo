const dgram = require('dgram');
const os = require('os');

/**
 * Nearby-session discovery over three parallel transports, deduped by id:
 *  1. UDP announces, sent both to 255.255.255.255 and to every interface's
 *     directed subnet broadcast (more reliable on filtering networks).
 *  2. Probe/response: browsers broadcast a probe, servers answer UNICAST -
 *     this works even when the server's own broadcasts are dropped.
 *  3. Bonjour/mDNS (pure JS): standard service discovery, best effort.
 * Everything is fire-and-forget; any transport failing is non-fatal.
 */

const PORT = 3067;

function subnetBroadcasts() {
  const out = new Set(['255.255.255.255']);
  const ifs = os.networkInterfaces();
  for(const name of Object.keys(ifs))
    for(const a of ifs[name])
      if((a.family === 'IPv4' || a.family === 4) && !a.internal && a.netmask
         && !/^169\.254\./.test(a.address)) {
        const ip = a.address.split('.').map(Number);
        const mask = a.netmask.split('.').map(Number);
        /* eslint-disable no-bitwise */
        out.add(ip.map((oct, i) => (oct & mask[i]) | (~mask[i] & 255)).join('.'));
        /* eslint-enable no-bitwise */
      }
  return [...out];
}

function makeSocket() {
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  sock.on('error', e => console.error('[WARN] discovery socket:', e.message));
  return sock;
}

function sendTo(sock, obj, port, addr) {
  const msg = Buffer.from(JSON.stringify(obj));
  try {
    // The callback captures async errors (e.g. EHOSTUNREACH mid network
    // change) that would otherwise surface as uncaught exceptions
    sock.send(msg, 0, msg.length, port, addr, () => { });
  } catch(e) { }
}

function parse(buf) {
  try {
    return JSON.parse(buf.toString());
  } catch(e) {
    return null;
  }
}

/** Server side. getInfo() -> { id, port, conf }. Returns a stop function. */
function startAnnouncer(getInfo) {
  const sock = makeSocket();

  sock.on('message', (buf, rinfo) => {
    const data = parse(buf);
    if(!data || data.t !== 'console-neo-probe') return;
    sendTo(sock, Object.assign({ t: 'console-neo' }, getInfo()), rinfo.port, rinfo.address);
  });

  sock.bind(PORT, () => {
    try {
      sock.setBroadcast(true);
    } catch(e) { }
  });

  const timer = setInterval(() => {
    const payload = Object.assign({ t: 'console-neo' }, getInfo());
    for(const addr of subnetBroadcasts()) sendTo(sock, payload, PORT, addr);
  }, 2000);

  let bonjour = null;
  try {
    const { Bonjour } = require('bonjour-service'); // eslint-disable-line global-require
    bonjour = new Bonjour(undefined, e =>
      console.error('[WARN] mDNS error:', e && e.message ? e.message : e));
    const info = getInfo();
    bonjour.publish({
      name: `Console Neo ${info.id}`,
      type: 'console-neo',
      port: info.port,
      txt: { id: info.id },
    });
  } catch(e) {
    console.error('[WARN] mDNS publish unavailable:', e.message);
  }

  return () => {
    clearInterval(timer);
    try {
      sock.close();
    } catch(e) { }
    if(bonjour) try {
      bonjour.destroy();
    } catch(e) { }
  };
}

/** Browser side. onFound({ id, conf, host, port }) fires repeatedly while
    a server stays visible (via responses to our 2s probes). */
function startBrowser(onFound) {
  const sock = makeSocket();

  sock.on('message', (buf, rinfo) => {
    const data = parse(buf);
    if(!data || data.t !== 'console-neo' || !data.id) return;
    onFound({
      id: data.id,
      conf: data.conf || null,
      host: rinfo.address,
      port: data.port || 3066,
    });
  });

  const probe = (addr) => sendTo(sock, { t: 'console-neo-probe' }, PORT, addr);
  const probeAll = () => {
    for(const addr of subnetBroadcasts()) probe(addr);
  };

  sock.bind(PORT, () => {
    try {
      sock.setBroadcast(true);
    } catch(e) { }
    probeAll();
  });
  const timer = setInterval(probeAll, 2000);

  let bonjour = null;
  let browser = null;
  try {
    const { Bonjour } = require('bonjour-service'); // eslint-disable-line global-require
    bonjour = new Bonjour(undefined, e =>
      console.error('[WARN] mDNS error:', e && e.message ? e.message : e));
    browser = bonjour.find({ type: 'console-neo' }, (service) => {
      const host = (service.addresses || [])
        .filter(a => /^\d+\.\d+\.\d+\.\d+$/.test(a))[0];
      if(!host) return;
      onFound({
        id: (service.txt && service.txt.id) || service.name,
        conf: null,
        host,
        port: service.port || 3066,
      });
      // Ask it directly for fresh details (committee name)
      probe(host);
    });
  } catch(e) {
    console.error('[WARN] mDNS browse unavailable:', e.message);
  }

  return () => {
    clearInterval(timer);
    try {
      sock.close();
    } catch(e) { }
    if(browser) try {
      browser.stop();
    } catch(e) { }
    if(bonjour) try {
      bonjour.destroy();
    } catch(e) { }
  };
}

module.exports = { startAnnouncer, startBrowser, PORT };
