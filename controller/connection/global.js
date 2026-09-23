// SPDX-License-Identifier: AGPL-3.0-or-later AND MIT
// Copyright (C) 2016 Liu Xiaoyi
// Modifications Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE, NOTICE, and LICENSES/MIT.txt for terms.

class GlobalConnection {
  /** `cb` gets the first snapshot; later ones (after a reconnect) go to `onResync` */
  constructor(socket, cb) {
    this.onResync = null;

    let initialized = false;
    socket.on('pong', (payload) => {
      // socket.io's own heartbeat also surfaces here, as a latency number
      if(!payload || typeof payload !== 'object') return;
      if(!initialized) {
        initialized = true;
        return void cb(payload);
      }
      if(this.onResync) this.onResync(payload);
      return undefined;
    });

    this.socket = socket;
  }

  createConf(name, cb) {
    this.socket.once('create', cb);
    this.socket.emit('create', { name });
  }
}

module.exports = GlobalConnection;
