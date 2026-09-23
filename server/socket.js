const socketIO = require('socket.io');
const crypto = require('crypto');
const backend = require('./backend/main');

let io;
const namespaces = new Map();
let passkey;
let readerkey;
let connectCode;
let readerConnectCode;

/*
 * Credentials rotate (the code every 30s, the passwords periodically), so
 * a successful handshake mints a session token. Tokens keep established
 * sessions valid across automatic rotations - including transparent
 * reconnects - and are wiped only by the on-demand reset.
 */
const sessions = new Map(); // token -> { chair }

function authenticate(socket) {
  const q = socket.handshake.query;

  const tok = q['console-token'];
  if(tok && sessions.has(tok)) return { ok: true, chair: sessions.get(tok).chair, token: tok };

  const key = q['console-passkey'];
  const chair = key === passkey
    || (Boolean(connectCode) && typeof key === 'string' && key.toUpperCase() === connectCode);
  const reader = key === readerkey
    || (Boolean(readerConnectCode) && typeof key === 'string'
        && key.toUpperCase() === readerConnectCode);
  if(!chair && !reader) return { ok: false };

  const token = crypto.randomBytes(16).toString('hex');
  sessions.set(token, { chair });
  while(sessions.size > 512) sessions.delete(sessions.keys().next().value);
  return { ok: true, chair, token };
}

function add(nsid) {
  console.log(`[SERVER] Adding namespace: ${nsid}`);
  const nsp = io.of(`/${nsid}`);
  const conf = backend.get(nsid);

  /**
   * Shared projection state, session-scoped.
   * When enabled, every chair's cast actions update this and are mirrored
   * on all connected machines; the host's page navigation drives the cast.
   */
  const projShared = {
    enabled: true,
    mode: 'none',
    target: null,
    extras: {},
    hostSocket: null,
    hostName: null,
  };

  const clearHost = () => {
    projShared.hostSocket = null;
    projShared.hostName = null;
    nsp.emit('castHostChanged', { hostName: null });
  };

  nsp.use((socket, next) => {
    const auth = authenticate(socket);
    if(!auth.ok) return void next(new Error('NotAuthorized'));
    socket.consoleAuthorized = auth.chair;
    socket.sessionToken = auth.token;
    socket.conf = backend.get(nsid);
    return void next();
  });

  nsp.on('connection', (socket) => {
    backend.touch(nsid);

    socket.emit('sessionToken', { token: socket.sessionToken });

    /* Shared projection */

    socket.on('projSet', ({ mode, target }) => {
      if(!socket.consoleAuthorized || typeof mode !== 'string') return;
      projShared.mode = mode;
      projShared.target = target || null;
      projShared.extras = {};
      socket.broadcast.emit('projChanged', {
        mode: projShared.mode,
        target: projShared.target,
        extras: projShared.extras,
      });
    });

    socket.on('projExtra', ({ key, value }) => {
      if(!socket.consoleAuthorized || typeof key !== 'string') return;
      projShared.extras[key] = value;
      socket.broadcast.emit('projExtra', { key, value });
    });

    socket.on('projClaimHost', ({ name, force }) => {
      if(!socket.consoleAuthorized)
        return void socket.emit('projClaimHost', { ok: false, error: 'NotAuthorized' });
      if(projShared.hostSocket && projShared.hostSocket !== socket && !force)
        return void socket.emit('projClaimHost', {
          ok: false, error: 'Taken', hostName: projShared.hostName,
        });

      // Tell the outgoing host directly that it lost the cast
      if(projShared.hostSocket && projShared.hostSocket !== socket)
        projShared.hostSocket.emit('castHostLost', {});

      projShared.hostSocket = socket;
      projShared.hostName = typeof name === 'string' ? name : '';
      nsp.emit('castHostChanged', { hostName: projShared.hostName });
      return void socket.emit('projClaimHost', { ok: true });
    });

    socket.on('projReleaseHost', () => {
      if(projShared.hostSocket === socket) clearHost();
    });

    socket.on('projSync', () => {
      socket.emit('projSync', {
        ok: true,
        proj: {
          enabled: projShared.enabled,
          mode: projShared.mode,
          target: projShared.target,
          extras: projShared.extras,
          hostName: projShared.hostName,
          hosted: projShared.hostSocket !== null,
        },
      });
    });

    socket.on('setSyncCast', ({ enabled }) => {
      if(!socket.consoleAuthorized)
        return void socket.emit('setSyncCast', { ok: false, error: 'NotAuthorized' });

      projShared.enabled = !!enabled;
      if(!projShared.enabled && projShared.hostSocket) clearHost();
      nsp.emit('syncCastChanged', { enabled: projShared.enabled });
      return void socket.emit('setSyncCast', { ok: true });
    });

    socket.on('disconnect', () => {
      if(projShared.hostSocket === socket) clearHost();
    });

    socket.conf.fetchAll((error, data) => {
      if(error) return void socket.emit('pong', { error });
      return void socket.emit('pong', { data });
    });

    socket.on('ping', () => {
      socket.conf.fetchAll((error, data) => {
        if(error) return void socket.emit('pong', { error });
        return void socket.emit('pong', { data });
      });
    });

    /* Timers */

    socket.on('addTimer', ({ name, value, type }) => {
      if(!name || !value || !type)
        return void socket.emit('addTimer', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('addTimer', { ok: false, error: 'NotAuthorized' });

      socket.conf.addTimer(name, type, value, (err, id) => {
        if(err) return void socket.emit('addTimer', { ok: false, error: err });
        else return void socket.emit('addTimer', { ok: true, id });
      });
    });

    socket.on('startTimer', ({ id }) => {
      if(!id) return void socket.emit('startTimer', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('startTimer', { ok: false, error: 'NotAuthorized' });

      socket.conf.startTimer(id, (err) => {
        if(err) return void socket.emit('startTimer', { ok: false, error: err });
        else return void socket.emit('startTimer', { ok: true, id });
      });
    });

    socket.on('restartTimer', ({ id }) => {
      if(!id) return void socket.emit('restartTimer', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('restartTimer', { ok: false, error: 'NotAuthorized' });

      socket.conf.restartTimer(id, (err) => {
        if(err) return void socket.emit('restartTimer', { ok: false, error: err });
        else return void socket.emit('restartTimer', { ok: true, id });
      });
    });

    socket.on('resetTimer', ({ id }) => {
      if(!id) return void socket.emit('resetTimer', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('resetTimer', { ok: false, error: 'NotAuthorized' });

      socket.conf.resetTimer(id, (err) => {
        if(err) return void socket.emit('resetTimer', { ok: false, error: err });
        else return void socket.emit('resetTimer', { ok: true, id });
      });
    });

    socket.on('stopTimer', ({ id }) => {
      if(!id) return void socket.emit('stopTimer', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('stopTimer', { ok: false, error: 'NotAuthorized' });

      socket.conf.stopTimer(id, (err) => {
        if(err) return void socket.emit('stopTimer', { ok: false, error: err });
        else return void socket.emit('stopTimer', { ok: true, id });
      });
    });

    socket.on('updateTimer', ({ id, value }) => {
      if(!id || !Number.isInteger(value))
        return void socket.emit('updateTimer', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('updateTimer', { ok: false, error: 'NotAuthorized' });

      socket.conf.updateTimer(id, value, (err) => {
        if(err) return void socket.emit('updateTimer', { ok: false, error: err });
        else return void socket.emit('updateTimer', { ok: true });
      });
    });

    socket.on('updateTimerLeft', ({ id, left }) => {
      if(!id || !Number.isInteger(left))
        return void socket.emit('updateTimerLeft', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('updateTimerLeft', { ok: false, error: 'NotAuthorized' });

      socket.conf.updateTimerLeft(id, left, (err) => {
        if(err) return void socket.emit('updateTimerLeft', { ok: false, error: err });
        else return void socket.emit('updateTimerLeft', { ok: true });
      });
    });

    /* Seats */
    socket.on('updateSeats', ({ seats }) => {
      if(!seats) return void socket.emit('updateSeats', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('updateSeats', { ok: false, error: 'NotAuthorized' });

      socket.conf.updateSeats(seats, err => {
        if(err) return void socket.emit('updateSeats', { ok: false, error: err });
        else return void socket.emit('updateSeats', { ok: true });
      });
    });

    /* Files */

    socket.on('addFile', ({ name, type, content }) => {
      if(!name || !type || !content)
        return void socket.emit('addFile', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('addFile', { ok: false, error: 'NotAuthorized' });

      socket.conf.addFile(name, type, content, (err, id) => {
        if(err) return void socket.emit('addFile', { ok: false, error: err });
        else return void socket.emit('addFile', { ok: true, id });
      });
    });

    socket.on('editFile', ({ id, content }) => {
      if(!id || !content) return void socket.emit('editFile', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('editFile', { ok: false, error: 'NotAuthorized' });

      socket.conf.editFile(id, content, err => {
        if(err) return void socket.emit('editFile', { ok: false, error: err });
        else return void socket.emit('editFile', { ok: true });
      });
    });

    socket.on('getFile', ({ id }) => {
      if(!id) return; // Silently ignores
      const respToken = `getFile:${id}`; // Maybe there are multiple calls
      socket.conf.getFile(id, (err, content) => {
        if(err) return void socket.emit(respToken, { ok: false, error: err });
        return void socket.emit(respToken, { ok: true, content });
      });
    });

    socket.on('addVote', ({ name, rounds, target, seats }) => {
      if(!name || !Number.isInteger(rounds) || !Number.isInteger(target) || !seats)
        return void socket.emit('addVote', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('addVote', { ok: false, error: 'NotAuthorized' });

      socket.conf.addVote(name, rounds, target, seats, (err, id) => {
        if(err) return void socket.emit('addVote', { ok: false, error: err });
        return void socket.emit('addVote', { ok: true, id });
      });
    });

    socket.on('updateVote', ({ id, index, vote }) => {
      if(!id || !Number.isInteger(index) || !Number.isInteger(vote))
        return void socket.emit('updateVote', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('updateVote', { ok: false, error: 'NotAuthorized' });

      socket.conf.updateVote(id, index, vote, err => {
        if(err) return void socket.emit('updateVote', { ok: false, error: err });
        return void socket.emit('updateVote', { ok: true });
      });
    });

    socket.on('iterateVote', ({ id, status }) => {
      if(!id || !status)
        return void socket.emit('iterateVote', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('iterateVote', { ok: false, error: 'NotAuthorized' });

      socket.conf.iterateVote(id, status, err => {
        if(err) return void socket.emit('iterateVote', { ok: false, error: err });
        return void socket.emit('iterateVote', { ok: true });
      });
    });

    /* Lists */

    socket.on('addList', ({ name, seats }) => {
      if(!name || !seats) return void socket.emit('addList', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('addList', { ok: false, error: 'NotAuthorized' });

      socket.conf.addList(name, seats, (err, id) => {
        if(err) return void socket.emit('addList', { ok: false, error: err });
        return void socket.emit('addList', { ok: true, id });
      });
    });

    socket.on('updateList', ({ id, seats, rev }) => {
      if(!id || !seats) return void socket.emit('updateList', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('updateList', { ok: false, error: 'NotAuthorized' });

      socket.conf.updateList(id, seats, rev, err => {
        if(err) return void socket.emit('updateList', { ok: false, error: err });
        return void socket.emit('updateList', { ok: true });
      });
    });

    socket.on('iterateList', ({ id, ptr }) => {
      if(!id || !Number.isInteger(ptr))
        return void socket.emit('iterateList', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('iterateList', { ok: false, error: 'NotAuthorized' });

      socket.conf.iterateList(id, ptr, err => {
        if(err) return void socket.emit('iterateList', { ok: false, error: err });
        return void socket.emit('iterateList', { ok: true });
      });
    });

    /* Motions */

    socket.on('addMotion', ({ name, proposer, type, params }) => {
      if(!name || !proposer)
        return void socket.emit('addMotion', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('addMotion', { ok: false, error: 'NotAuthorized' });

      socket.conf.addMotion({ name, proposer, type, params }, (err, id) => {
        if(err) return void socket.emit('addMotion', { ok: false, error: err });
        return void socket.emit('addMotion', { ok: true, id });
      });
    });

    socket.on('editMotion', ({ id, name, proposer, type, params }) => {
      if(!id || !name || !proposer)
        return void socket.emit('editMotion', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('editMotion', { ok: false, error: 'NotAuthorized' });

      socket.conf.editMotion(id, { name, proposer, type, params }, (err) => {
        if(err) return void socket.emit('editMotion', { ok: false, error: err });
        return void socket.emit('editMotion', { ok: true });
      });
    });

    socket.on('setMotionVisible', ({ id, visible }) => {
      if(!id || typeof visible !== 'boolean')
        return void socket.emit('setMotionVisible', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('setMotionVisible', { ok: false, error: 'NotAuthorized' });

      socket.conf.setMotionVisible(id, visible, (err) => {
        if(err) return void socket.emit('setMotionVisible', { ok: false, error: err });
        return void socket.emit('setMotionVisible', { ok: true });
      });
    });

    socket.on('executeMotion', ({ id, instance }) => {
      if(!id) return void socket.emit('executeMotion', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('executeMotion', { ok: false, error: 'NotAuthorized' });

      const inst = instance && typeof instance.kind === 'string'
        && typeof instance.id === 'string'
        ? { kind: instance.kind, id: instance.id } : null;

      socket.conf.markMotionExecuted(id, inst, (err) => {
        if(err) return void socket.emit('executeMotion', { ok: false, error: err });
        return void socket.emit('executeMotion', { ok: true });
      });
    });

    socket.on('updateMotion', ({ id, outcome }) => {
      const outcomes = ['pending', 'passed', 'failed', 'withdrawn'];
      if(!id || outcomes.indexOf(outcome) === -1)
        return void socket.emit('updateMotion', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('updateMotion', { ok: false, error: 'NotAuthorized' });

      socket.conf.updateMotion(id, outcome, err => {
        if(err) return void socket.emit('updateMotion', { ok: false, error: err });
        return void socket.emit('updateMotion', { ok: true });
      });
    });

    /* Renames & removals */

    const renamable = {
      renameTimer: (c, d, cb) => c.renameTimer(d.id, d.name, cb),
      renameList: (c, d, cb) => c.renameList(d.id, d.name, cb),
      renameVote: (c, d, cb) => c.renameVote(d.id, d.name, cb),
      renameFile: (c, d, cb) => c.renameFile(d.id, d.name, cb),
    };

    for(const ev of Object.keys(renamable))
      socket.on(ev, (data) => {
        if(!data || !data.id || !data.name)
          return void socket.emit(ev, { ok: false, error: 'BadRequest' });
        else if(!socket.consoleAuthorized)
          return void socket.emit(ev, { ok: false, error: 'NotAuthorized' });

        renamable[ev](socket.conf, data, (err) => {
          if(err) return void socket.emit(ev, { ok: false, error: err });
          return void socket.emit(ev, { ok: true });
        });

        return undefined;
      });

    socket.on('renameMotion', ({ id, name, proposer }) => {
      if(!id || !name || !proposer)
        return void socket.emit('renameMotion', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('renameMotion', { ok: false, error: 'NotAuthorized' });

      socket.conf.renameMotion(id, name, proposer, (err) => {
        if(err) return void socket.emit('renameMotion', { ok: false, error: err });
        return void socket.emit('renameMotion', { ok: true });
      });
    });

    const removable = {
      removeTimer: (c, id, cb) => c.removeTimer(id, cb),
      removeList: (c, id, cb) => c.removeList(id, cb),
      removeVote: (c, id, cb) => c.removeVote(id, cb),
      removeFile: (c, id, cb) => c.removeFile(id, cb),
      removeMotion: (c, id, cb) => c.removeMotion(id, cb),
    };

    const notePrefixes = {
      removeTimer: id => [`timer:${id}`],
      removeList: id => [`list:${id}`, `seat:${id}:`],
      removeVote: id => [`vote:${id}`],
      removeFile: id => [`file:${id}`],
      removeMotion: id => [`motion:${id}`],
    };

    for(const ev of Object.keys(removable))
      socket.on(ev, (data) => {
        if(!data || !data.id)
          return void socket.emit(ev, { ok: false, error: 'BadRequest' });
        else if(!socket.consoleAuthorized)
          return void socket.emit(ev, { ok: false, error: 'NotAuthorized' });

        removable[ev](socket.conf, data.id, (err) => {
          if(err) return void socket.emit(ev, { ok: false, error: err });
          // Notes attached to a removed entity go with it
          socket.conf.removeNotesByPrefix(notePrefixes[ev](data.id));
          return void socket.emit(ev, { ok: true });
        });

        return undefined;
      });

    /* Committee rename */

    socket.on('renameConf', ({ name }) => {
      if(!name) return void socket.emit('renameConf', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('renameConf', { ok: false, error: 'NotAuthorized' });

      backend.renameConf(nsid, name, (err) => {
        if(err) return void socket.emit('renameConf', { ok: false, error: err });
        nsp.emit('confRenamed', { name });
        return void socket.emit('renameConf', { ok: true });
      });
    });

    /* Projector brand */

    /* Collaborative notes (chairs only) */

    socket.on('noteFetch', ({ key }) => {
      if(!socket.consoleAuthorized || typeof key !== 'string')
        return void socket.emit('noteFetch', { ok: false, error: 'NotAuthorized' });
      return void socket.conf.getNote(key, (err, note) => {
        if(err) return void socket.emit('noteFetch', { ok: false, error: err });
        return void socket.emit('noteFetch', {
          ok: true, snapshot: note ? note.snapshot : null,
        });
      });
    });

    socket.on('noteUpdate', ({ key, update }) => {
      if(!socket.consoleAuthorized) return;
      if(typeof key !== 'string' || typeof update !== 'string' || update.length > 70000) return;
      socket.broadcast.emit('noteUpdate', { key, update });
    });

    socket.on('noteSnapshot', ({ key, snapshot, text }) => {
      if(!socket.consoleAuthorized)
        return void socket.emit('noteSnapshot', { ok: false, error: 'NotAuthorized' });
      return void socket.conf.setNote(key, snapshot, text, (err) => {
        if(err) return void socket.emit('noteSnapshot', { ok: false, error: err });
        return void socket.emit('noteSnapshot', { ok: true });
      });
    });

    socket.on('setBrand', ({ brand }) => {
      if(typeof brand !== 'string')
        return void socket.emit('setBrand', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('setBrand', { ok: false, error: 'NotAuthorized' });

      socket.conf.setBrand(brand, err => {
        if(err) return void socket.emit('setBrand', { ok: false, error: err });
        return void socket.emit('setBrand', { ok: true });
      });
    });
  });

  conf.addListener({
    timerAdded(id, name, type, value) {
      nsp.emit('timerAdded', { id, name, type, value });
    },

    timerUpdated(id, value) {
      nsp.emit('timerUpdated', { id, value });
    },

    timerLeftSet(id, left) {
      nsp.emit('timerLeftSet', { id, left });
    },

    timerTick(id, value) {
      nsp.emit('timerTick', { id, value });
    },

    timerStarted(id, value) {
      nsp.emit('timerStarted', { id, value });
    },

    timerReset(id, value) {
      nsp.emit('timerReset', { id, value });
    },

    timerStopped(id) {
      nsp.emit('timerStopped', { id });
    },

    seatsUpdated(seats) {
      nsp.emit('seatsUpdated', { seats });
    },

    fileAdded(id, name, type) {
      nsp.emit('fileAdded', { id, name, type });
    },

    fileEdited(id) {
      nsp.emit('fileEdited', { id });
    },

    voteAdded(id, name, rounds, target, seats) {
      nsp.emit('voteAdded', { id, name, rounds, target, seats });
    },

    voteUpdated(id, index, vote) {
      nsp.emit('voteUpdated', { id, index, vote });
    },

    voteIterated(id, status) {
      nsp.emit('voteIterated', { id, status });
    },

    listAdded(id, name, seats) {
      nsp.emit('listAdded', { id, name, seats });
    },

    listIterated(id, ptr) {
      nsp.emit('listIterated', { id, ptr });
    },

    listUpdated(id, seats, rev) {
      nsp.emit('listUpdated', { id, seats, rev });
    },

    motionAdded(motion) {
      nsp.emit('motionAdded', { motion });
    },

    motionUpdated(id, outcome) {
      nsp.emit('motionUpdated', { id, outcome });
    },

    motionEdited(motion) {
      nsp.emit('motionEdited', { motion });
    },

    motionVisibility(id, visible) {
      nsp.emit('motionVisibility', { id, visible });
    },

    motionExecuted(id, instance) {
      nsp.emit('motionExecuted', { id, instance });
    },

    timerRenamed(id, name) {
      nsp.emit('timerRenamed', { id, name });
    },

    listRenamed(id, name) {
      nsp.emit('listRenamed', { id, name });
    },

    voteRenamed(id, name) {
      nsp.emit('voteRenamed', { id, name });
    },

    fileRenamed(id, name) {
      nsp.emit('fileRenamed', { id, name });
    },

    motionRenamed(id, name, proposer) {
      nsp.emit('motionRenamed', { id, name, proposer });
    },

    timerRemoved(id) {
      nsp.emit('timerRemoved', { id });
    },

    listRemoved(id) {
      nsp.emit('listRemoved', { id });
    },

    voteRemoved(id) {
      nsp.emit('voteRemoved', { id });
    },

    fileRemoved(id) {
      nsp.emit('fileRemoved', { id });
    },

    motionRemoved(id) {
      nsp.emit('motionRemoved', { id });
    },

    delegateUpdated(name, stats) {
      nsp.emit('delegateUpdated', { name, stats });
    },

    historyAdded(entry) {
      nsp.emit('historyAdded', { entry });
    },

    historyUpdated(id, data) {
      nsp.emit('historyUpdated', { id, data });
    },

    spokenUpdated(value) {
      nsp.emit('spokenUpdated', { value });
    },

    brandUpdated(brand) {
      nsp.emit('brandUpdated', { brand });
    },

    noteMeta(key, text, updated) {
      nsp.emit('noteMeta', { key, text, updated });
    },

    notesRemoved(keys) {
      nsp.emit('notesRemoved', { keys });
    },
  });

  namespaces.set(nsid, nsp);
}

function init(app, idk, psk, rdk, code, rcode) {
  io = socketIO(app);
  passkey = psk;
  readerkey = rdk;
  connectCode = code;
  readerConnectCode = rcode;

  io.use((socket, next) => {
    const auth = authenticate(socket);
    if(!auth.ok) return void next(new Error('NotAuthorized'));
    socket.consoleAuthorized = auth.chair;
    socket.sessionToken = auth.token;
    return void next();
  });

  io.on('connection', (socket) => {
    socket.emit('sessionToken', { token: socket.sessionToken });

    socket.emit('pong', {
      authorized: socket.consoleAuthorized,
      confs: backend.list(),
      idkey: idk,
      readerkey: socket.consoleAuthorized ? readerkey : undefined,
    });

    socket.on('ping', () => {
      socket.emit('pong', {
        authorized: socket.consoleAuthorized,
        confs: backend.list(),
        idkey: idk,
        readerkey: socket.consoleAuthorized ? readerkey : undefined,
      });
    });

    socket.on('create', (data) => {
      if(!data.name) return void socket.emit('create', { ok: false, error: 'BadRequest' });
      else if(!socket.consoleAuthorized)
        return void socket.emit('create', { ok: false, error: 'NotAuthorized' });

      backend.add(data.name, (err, id) => {
        if(err) return void socket.emit('create', { ok: false, error: err });

        console.log('[SERVER] New Connection Established');
        add(id);
        return void socket.emit('create', { ok: true, id, name: data.name });
      });
    });
  });
}

/* Automatic rotation: new keys gate NEW connections; sessions persist */
function updateKeys(psk, rdk, code, rcode) {
  passkey = psk;
  readerkey = rdk;
  connectCode = code;
  readerConnectCode = rcode;
}

/* On-demand reset: rotate, wipe every session, boot every client */
function resetKeys(psk, rdk, code, rcode) {
  updateKeys(psk, rdk, code, rcode);
  sessions.clear();
  if(!io) return;

  // Boot every connected client; the new keys are required to get back in
  for(const name of Object.keys(io.nsps)) {
    const nsp = io.nsps[name];
    for(const sid of Object.keys(nsp.connected))
      nsp.connected[sid].disconnect(true);
  }
}

module.exports = {
  init,
  add,
  updateKeys,
  resetKeys,
};
