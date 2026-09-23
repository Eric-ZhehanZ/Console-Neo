// Events socket.io-client handles locally; they must never be refused below
const RESERVED = ['connect', 'connect_error', 'connect_timeout', 'connecting', 'disconnect',
  'error', 'reconnect', 'reconnect_attempt', 'reconnect_failed', 'reconnect_error',
  'reconnecting', 'ping', 'pong'];

class ConferenceConnection {
  /**
   * `cb` gets the first state snapshot. The server sends a fresh one on every
   * reconnect, which goes to `onResync` so the caller can catch up on
   * whatever changed while the link was down.
   */
  constructor(socket, cb) {
    this.listeners = [];
    this.broadcasts = [];
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

    // Offline, socket.io would queue writes and replay them on reconnect
    // against state that may have moved on (or drop them if we give up).
    // Refuse them instead: the caller's error path runs and nothing is
    // applied behind the chair's back. Before the first connect, queueing
    // is harmless and kept.
    let everConnected = false;
    socket.on('connect', () => { everConnected = true; });
    const rawEmit = socket.emit;
    socket.emit = (name, ...args) => {
      if(socket.connected || !everConnected || RESERVED.indexOf(name) !== -1)
        return rawEmit.call(socket, name, ...args);
      // Fire-and-forget ops that share a broadcast's name have no reply to fake
      if(this.broadcasts.indexOf(name) !== -1) return socket;
      setTimeout(() => {
        for(const fn of socket.listeners(name).slice())
          fn.call(socket, { ok: false, error: 'Offline' });
      }, 0);
      return socket;
    };

    this.socket = socket;

    /* Seats */

    this.pushSocketListener('seatsUpdated', ['seats']);

    /* Timers */

    this.pushSocketListener('timerAdded', ['id', 'name', 'type', 'value']);
    this.pushSocketListener('timerStarted', ['id', 'value']);
    this.pushSocketListener('timerReset', ['id', 'value']);
    this.pushSocketListener('timerStopped', ['id']);
    this.pushSocketListener('timerTick', ['id', 'value']);
    this.pushSocketListener('timerUpdated', ['id', 'value']);
    this.pushSocketListener('timerLeftSet', ['id', 'left']);

    /* Files */

    this.pushSocketListener('fileAdded', ['id', 'name', 'type']);
    this.pushSocketListener('fileEdited', ['id']);

    /* Votes */

    this.pushSocketListener('voteAdded', ['id', 'name', 'target', 'rounds', 'seats']);
    this.pushSocketListener('voteUpdated', ['id', 'index', 'vote']);
    this.pushSocketListener('voteIterated', ['id', 'status']);

    /* Lists*/

    this.pushSocketListener('listAdded', ['id', 'name', 'seats']);
    this.pushSocketListener('listUpdated', ['id', 'seats', 'rev']);
    this.pushSocketListener('listIterated', ['id', 'ptr']);

    /* Motions */

    this.pushSocketListener('motionAdded', ['motion']);
    this.pushSocketListener('motionUpdated', ['id', 'outcome']);
    this.pushSocketListener('motionEdited', ['motion']);
    this.pushSocketListener('motionVisibility', ['id', 'visible']);
    this.pushSocketListener('motionExecuted', ['id', 'instance']);

    /* Shared projection */

    this.pushSocketListener('projChanged', ['mode', 'target', 'extras']);
    this.pushSocketListener('projExtra', ['key', 'value']);
    this.pushSocketListener('castHostChanged', ['hostName']);
    this.pushSocketListener('castHostLost', []);
    this.pushSocketListener('syncCastChanged', ['enabled']);

    /* Notes */

    this.pushSocketListener('historyUpdated', ['id', 'data']);
    this.pushSocketListener('noteMeta', ['key', 'text', 'updated']);
    this.pushSocketListener('notesRemoved', ['keys']);

    /* Renames & removals */

    this.pushSocketListener('timerRenamed', ['id', 'name']);
    this.pushSocketListener('listRenamed', ['id', 'name']);
    this.pushSocketListener('voteRenamed', ['id', 'name']);
    this.pushSocketListener('fileRenamed', ['id', 'name']);
    this.pushSocketListener('motionRenamed', ['id', 'name', 'proposer']);
    this.pushSocketListener('timerRemoved', ['id']);
    this.pushSocketListener('listRemoved', ['id']);
    this.pushSocketListener('voteRemoved', ['id']);
    this.pushSocketListener('fileRemoved', ['id']);
    this.pushSocketListener('motionRemoved', ['id']);

    /* Committee */

    this.pushSocketListener('confRenamed', ['name']);

    /* History, statistics & projector brand */

    this.pushSocketListener('historyAdded', ['entry']);
    this.pushSocketListener('spokenUpdated', ['value']);
    this.pushSocketListener('delegateUpdated', ['name', 'stats']);
    this.pushSocketListener('brandUpdated', ['brand']);
  }

  /**
   * Generic request/response over a single event name
   */
  request(name, payload, cb) {
    this.socket.once(name, (data) => {
      if(data.ok) cb(null, data);
      else cb(data.error);
    });

    this.socket.emit(name, payload);
  }

  renameTimer(id, name, cb) { this.request('renameTimer', { id, name }, cb); }
  renameList(id, name, cb) { this.request('renameList', { id, name }, cb); }
  renameVote(id, name, cb) { this.request('renameVote', { id, name }, cb); }
  renameFile(id, name, cb) { this.request('renameFile', { id, name }, cb); }
  renameMotion(id, name, proposer, cb) { this.request('renameMotion', { id, name, proposer }, cb); }

  renameConf(name, cb) { this.request('renameConf', { name }, cb); }

  removeTimer(id, cb) { this.request('removeTimer', { id }, cb); }
  removeList(id, cb) { this.request('removeList', { id }, cb); }
  removeVote(id, cb) { this.request('removeVote', { id }, cb); }
  removeFile(id, cb) { this.request('removeFile', { id }, cb); }
  removeMotion(id, cb) { this.request('removeMotion', { id }, cb); }

  pushSocketListener(name, fields) {
    this.broadcasts.push(name);
    this.socket.on(name, (data) => {
      for(const l of this.listeners)
        if(name in l) l[name](...fields.map(e => data[e]));
    });
  }


  addListener(listener) {
    this.listeners.push(listener);
  }

  /* Seats */

  updateSeats(seats, cb) {
    this.socket.once('updateSeats', (data) => {
      if(data.ok) cb(null);
      else cb(data.error);
    });
    this.socket.emit('updateSeats', { seats });
  }

  /* Timers */

  addTimer(name, type, value, cb) {
    this.socket.once('addTimer', (data) => {
      if(data.ok) cb(null, data.id);
      else cb(data.error);
    });

    this.socket.emit('addTimer', { name, value, type });
  }

  /**
   * action in { start, restart, stop, reset }
   */
  manipulateTimer(action, id, cb) {
    const token = `${action}Timer`;
    this.socket.once(token, (data) => {
      if(data.ok) cb(null);
      else cb(data.error);
    });

    this.socket.emit(token, { id });
  }

  updateTimer(id, value, cb) {
    this.socket.once('updateTimer', (data) => {
      if(data.ok) cb(null);
      else cb(data.error);
    });

    this.socket.emit('updateTimer', { id, value });
  }

  updateTimerLeft(id, left, cb) {
    this.socket.once('updateTimerLeft', (data) => {
      if(data.ok) cb(null);
      else cb(data.error);
    });

    this.socket.emit('updateTimerLeft', { id, left });
  }

  /* Files */

  addFile(name, type, content, cb) {
    this.socket.once('addFile', (data) => {
      if(data.ok) cb(null, data.id);
      else cb(data.error);
    });

    this.socket.emit('addFile', { name, type, content });
  }

  editFile(id, content, cb) {
    this.socket.once('editFile', (data) => {
      if(data.ok) cb(null);
      else cb(data.error);
    });

    this.socket.emit('editFile', { id, content });
  }

  getFile(id, cb) {
    const respToken = `getFile:${id}`;

    this.socket.once(respToken, (data) => {
      if(data.ok) cb(null, data.content);
      else cb(data.error);
    });

    this.socket.emit('getFile', { id });
  }

  /* Votes */
  addVote(name, target, rounds, seats, cb) {
    this.socket.once('addVote', (data) => {
      if(data.ok) cb(null, data.id);
      else cb(data.error);
    });

    this.socket.emit('addVote', { name, target, rounds, seats });
  }

  updateVote(id, index, vote, cb) {
    this.socket.once('updateVote', (data) => {
      if(data.ok) cb(null);
      else cb(data.error);
    });

    this.socket.emit('updateVote', { id, index, vote });
  }

  iterateVote(id, status, cb) {
    this.socket.once('iterateVote', (data) => {
      if(data.ok) cb(null);
      else cb(data.error);
    });

    this.socket.emit('iterateVote', { id, status });
  }

  /* Lists */
  addList(name, seats, cb) {
    this.socket.once('addList', (data) => {
      if(data.ok) cb(null, data.id);
      else cb(data.error);
    });

    this.socket.emit('addList', { name, seats });
  }

  updateList(id, seats, rev, cb) {
    this.socket.once('updateList', (data) => {
      if(data.ok) cb(null);
      else cb(data.error);
    });

    this.socket.emit('updateList', { id, seats, rev });
  }

  iterateList(id, ptr, cb) {
    this.socket.once('iterateList', (data) => {
      if(data.ok) cb(null);
      else cb(data.error);
    });

    this.socket.emit('iterateList', { id, ptr });
  }

  /* Motions */

  addMotion(name, proposer, type, params, cb) {
    this.socket.once('addMotion', (data) => {
      if(data.ok) cb(null, data.id);
      else cb(data.error);
    });

    this.socket.emit('addMotion', { name, proposer, type, params });
  }

  editMotion(id, name, proposer, type, params, cb) {
    this.request('editMotion', { id, name, proposer, type, params }, cb);
  }

  setMotionVisible(id, visible, cb) {
    this.request('setMotionVisible', { id, visible }, cb);
  }

  executeMotion(id, instance, cb) {
    this.request('executeMotion', { id, instance }, cb);
  }

  /* Shared projection */

  projSet(mode, target) {
    this.socket.emit('projSet', { mode, target });
  }

  projExtra(key, value) {
    this.socket.emit('projExtra', { key, value });
  }

  projClaimHost(name, force, cb) {
    this.socket.once('projClaimHost', cb);
    this.socket.emit('projClaimHost', { name, force });
  }

  projReleaseHost() {
    this.socket.emit('projReleaseHost', {});
  }

  projSync(cb) {
    this.socket.once('projSync', cb);
    this.socket.emit('projSync', {});
  }

  setSyncCast(enabled, cb) {
    this.request('setSyncCast', { enabled }, cb);
  }

  updateMotion(id, outcome, cb) {
    this.socket.once('updateMotion', (data) => {
      if(data.ok) cb(null);
      else cb(data.error);
    });

    this.socket.emit('updateMotion', { id, outcome });
  }

  /* Projector brand */

  setBrand(brand, cb) {
    this.socket.once('setBrand', (data) => {
      if(data.ok) cb(null);
      else cb(data.error);
    });

    this.socket.emit('setBrand', { brand });
  }

  disconnect() {
    this.socket.disconnect();
  }
}

module.exports = ConferenceConnection;
