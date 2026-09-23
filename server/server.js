const backend = require('./backend/main');
const socket = require('./socket.js');
const config = require('./config.json');

const crypto = require('crypto');
const http = require('http');
const discovery = require('../shared/discovery');

function shutdown(cb) {
  console.log('Shuting down backend...');
  return backend.shutdown(cb);
}

module.exports = (cb, port = 3066) => {
  // Initial backend object
  backend.init((err) => {
    if(err) {
      backend.shutdown();
      return void cb(err);
    }
    console.log('Backend initialization completed');

    config.id = crypto.randomBytes(4).toString('hex').toUpperCase();

    const randDigits = () => crypto.randomBytes(2).readUInt16BE(0) % 10000;

    // Manual connections use long mixed-alphanumeric keys; nearby (LAN)
    // connections use the short on-screen code instead
    const genKey = (len) => {
      let out = '';
      while(out.length < len)
        out += crypto.randomBytes(24).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
      return out.slice(0, len);
    };
    const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'; // no I/O: too confusable
    const genCode = () => {
      const bytes = crypto.randomBytes(6);
      let out = '';
      for(let i = 0; i < 6; i++) out += CODE_CHARS[bytes[i] % CODE_CHARS.length];
      return out;
    };
    const genChairKey = () => genKey(18);
    const genReaderKey = () => `R${genKey(12)}`;

    const passkey = genChairKey();
    const readerkey = genReaderKey();
    const code = genCode();
    const readerCode = genCode();
    const idkey = `${config.id}-${randDigits()}`;

    // Setup sockets
    const server = http.createServer((req, res) => {
      res.writeHead(404);
      res.end('Please use socket.io to connect.');
    });

    socket.init(server, idkey, passkey, readerkey, code, readerCode);
    const confs = backend.list();
    for(const conf of confs) socket.add(conf.id);

    server.listen(port, () => {
      console.log(`Server ${idkey} up at port ${port} with passkey ${passkey}.`);
      console.log(`Reader key: ${readerkey}, connect code: ${code}`);

      // LAN discovery via broadcast + probe/response + Bonjour (never the code)
      const discoveryInfo = () => {
        let conf = null;
        try {
          let latest = null;
          for(const c of backend.list() || [])
            if(!latest || (c.lastAccess || 0) > (latest.lastAccess || 0)) latest = c;
          conf = latest ? latest.name : null;
        } catch(e) { }
        return { id: idkey, port, conf };
      };
      let stopAnnouncer = () => {};
      try {
        stopAnnouncer = discovery.startAnnouncer(discoveryInfo);
      } catch(e) {
        console.error('[WARN] LAN discovery unavailable:', e.message);
      }

      /* Credential auto-rotation. Established sessions hold tokens and
         are unaffected; only new connection attempts need current values. */
      let curPasskey = passkey;
      let curReaderkey = readerkey;
      let curCode = code;
      let curReaderCode = readerCode;
      const rotateListeners = [];

      const notifyRotate = () => {
        for(const fn of rotateListeners)
          fn({
            passkey: curPasskey,
            readerkey: curReaderkey,
            code: curCode,
            readerCode: curReaderCode,
          });
      };

      const codeTimer = setInterval(() => {
        curCode = genCode();
        curReaderCode = genCode();
        socket.updateKeys(curPasskey, curReaderkey, curCode, curReaderCode);
        notifyRotate();
      }, 30 * 1000);

      const keyTimer = setInterval(() => {
        curPasskey = genChairKey();
        curReaderkey = genReaderKey();
        socket.updateKeys(curPasskey, curReaderkey, curCode, curReaderCode);
        notifyRotate();
      }, 10 * 60 * 1000);

      const stop = (scb) => {
        clearInterval(codeTimer);
        clearInterval(keyTimer);
        try {
          stopAnnouncer();
        } catch(e) { }
        return shutdown(scb);
      };

      const reset = () => {
        curPasskey = genChairKey();
        curReaderkey = genReaderKey();
        curCode = genCode();
        curReaderCode = genCode();
        socket.resetKeys(curPasskey, curReaderkey, curCode, curReaderCode);
        notifyRotate();
        return {
          passkey: curPasskey,
          readerkey: curReaderkey,
          code: curCode,
          readerCode: curReaderCode,
        };
      };

      cb(null, {
        passkey,
        readerkey,
        idkey,
        code,
        readerCode,
        shutdown: stop,
        reset,
        onRotate: fn => rotateListeners.push(fn),
      });
    });

    server.on('error', (err) => {
      backend.shutdown();
      cb(err);
    });
  });
};
