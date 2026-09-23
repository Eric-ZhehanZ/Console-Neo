const crypto = require('crypto');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function _createDir(dir) {
  try {
    if(fs.statSync(dir).isDirectory()) return;
  } catch(e) { }

  const parentDir = path.dirname(dir);
  _createDir(parentDir);
  try {
    fs.mkdirSync(dir);
  } catch(e) { }
}

/**
 * Three-way merge of a speakers list, keyed by seat uid.
 * Order follows the server version; the client's deletions and renames are
 * applied to it, and the client's additions are inserted right after their
 * surviving predecessor in the client's ordering - so a speaker added
 * before a bottom-pinned proposer stays before them after the merge.
 */
function mergeSeats(base, server, client) {
  const key = s => s.uid || s.name;
  const baseKeys = new Set(base.map(key));
  const clientKeys = new Set(client.map(key));
  const clientByKey = new Map(client.map(s => [key(s), s]));

  const result = [];
  for(const seat of server) {
    const k = key(seat);
    if(baseKeys.has(k) && !clientKeys.has(k)) continue; // deleted by the client
    const c = clientByKey.get(k);
    if(c && c.name !== seat.name) result.push({ uid: seat.uid, name: c.name });
    else result.push(seat);
  }

  const indexOf = k => {
    for(let i = 0; i < result.length; i += 1) if(key(result[i]) === k) return i;
    return -1;
  };

  client.forEach((seat, i) => {
    const k = key(seat);
    if(indexOf(k) !== -1) return; // already present
    if(baseKeys.has(k)) return; // deleted on the server side meanwhile

    let at = -1;
    for(let j = i - 1; j >= 0; j -= 1) {
      const idx = indexOf(key(client[j]));
      if(idx !== -1) {
        at = idx;
        break;
      }
    }
    result.splice(at + 1, 0, seat);
  });

  return result;
}

class Conference {
  constructor(name, db, fileRoot) {
    this.name = name;
    this.db = db;
    this.fileRoot = fileRoot;

    _createDir(fileRoot);

    this.listeners = [];
    this.runningTimers = new Map();
    this.timerValues = new Map();

    this.listTotal = new Map();
    this.listCurrent = new Map();

    this.spokenTime = 0;
    this._historyChain = Promise.resolve();

    // Per-delegate metrics, keyed by seat name so they survive seat-list edits
    this.delegates = {};
    // timerId -> speaker name currently attributed to a running list-current timer
    this.timerSpeaker = new Map();
    // listId -> "ptr|speaker" of the last counted speech, to dedupe pause/resume
    this.lastSpeech = new Map();
    // listId -> { entryId, seconds } of the speech currently accumulating
    this.activeSpeech = new Map();
    // Per-second stats batch up and flush every few seconds - a tick must
    // never cost a database write plus a broadcast to every client
    this._statsDirty = { spoken: false, delegates: new Set() };
    this._statsFlusher = setInterval(() => this._flushStats(), 5000);
    // listId -> edit revision + recent versions, for merging concurrent edits
    this.listRevs = {};
    this.listHistories = new Map();
    this._listWrites = Promise.resolve();

    this._getOr('stats:spoken', 0, (err, value) => {
      if(!err) this.spokenTime = value;
    });

    this._getOr('delegates', {}, (err, value) => {
      if(err) return;

      for(const dn of Object.keys(value))
        for(const field of Object.keys(value[dn]))
          if(value[dn][field] < 0) value[dn][field] = 0;
      this.delegates = value;
    });

    /* Silently in the background */
    this.db.get('timers', (err, timers) => {
      if(err) {
        if(!err.notFound && err.code !== 'LEVEL_NOT_FOUND') console.error(err);
        return;
      }

      for(const t of timers) {
        if(t.type === 'list-total')
          this.listTotal.set(t.name, t.id);
        if(t.type === 'list-current')
          this.listCurrent.set(t.id, t.name);
      }
    });
  }

  setup(cb) {
    Promise.all([
      (resolve, reject) => this.db.put('timers', [], err => err ? reject(err) : resolve()),
      (resolve, reject) => this.db.put('seats', [], err => err ? reject(err) : resolve()),
      (resolve, reject) => this.db.put('files', [], err => err ? reject(err) : resolve()),
      (resolve, reject) => this.db.put('votes', [], err => err ? reject(err) : resolve()),
      (resolve, reject) => this.db.put('lists', [], err => err ? reject(err) : resolve()),
      (resolve, reject) => this.db.put('motions', [], err => err ? reject(err) : resolve()),
      (resolve, reject) => this.db.put('history', [], err => err ? reject(err) : resolve()),
    ].map(e => new Promise(e))).then(() => cb(null)).catch(cb);
  }

  /**
   * Like db.get, but yields a default value when the key is missing.
   * Keeps committees created by older versions working.
   */
  _getOr(key, def, cb) {
    this.db.get(key, (err, value) => {
      if(err)
        if(err.notFound || err.code === 'LEVEL_NOT_FOUND') return void cb(null, def);
        else return void cb(err);
      return void cb(null, value);
    });
  }

  /* Timers */

  _startTimer(id, refkey, cb) {
    if(this.runningTimers.has(id)) return void cb('AlreadyStarted');

    this.runningTimers.set(id, 0); // To block following invokes

    this.db.get(refkey, (err, value) => {
      if(err) {
        this.runningTimers.delete(id);
        return void cb(err);
      }

      if(value === 0) return;

      this.timerValues.set(id, value);
      const intId = setInterval(() => {
        const t = this.timerValues.get(id) - 1;
        assert(t >= 0);
        this.timerValues.set(id, t);

        for(const l of this.listeners)
          if(l.timerTick) l.timerTick(id, t);

        if(this.listCurrent.has(id)) {
          this.spokenTime += 1;
          this._statsDirty.spoken = true;

          const speaker = this.timerSpeaker.get(id);
          if(speaker) this._bumpDelegate(speaker, 'spokenTime', 1, true);

          const speechListId = this.listCurrent.get(id);
          const as = this.activeSpeech.get(speechListId);
          if(as) {
            as.seconds += 1;
            if(as.seconds % 10 === 0) this._flushSpeech(speechListId, true);
          }
        }

        if(t === 0) {
          clearInterval(intId);
          this.stopTimer(id, err => {
            if(err) console.error(err);
          });
        }
      }, 1000);

      this.runningTimers.set(id, intId);

      for(const l of this.listeners)
        if(l.timerStarted) l.timerStarted(id, value);

      if(this.listCurrent.has(id)) this._logSpeechStart(this.listCurrent.get(id), id);

      if(this.listCurrent.has(id)) { // Never restart list-total timers
        const listId = this.listCurrent.get(id);
        if(this.listTotal.has(listId)) return void this.startTimer(this.listTotal.get(listId), cb);
      }

      cb(null);
    });
  }

  /**
   * You should never start list-total timers
   */
  startTimer(id, cb) {
    return this._startTimer(id, `timer:${id}:left`, cb);
  }

  restartTimer(id, cb) {
    return this._startTimer(id, `timer:${id}`, cb);
  }

  resetTimer(id, cb) {
    const _cb = () => {
      this.db.get(`timer:${id}`, (err, all) => {
        if(err) return void cb(err);

        this.db.put(`timer:${id}:left`, all, err => {
          if(err) return void cb(err);

          for(const l of this.listeners)
            if(l.timerReset) l.timerReset(id, all);

          cb();
        });

        return;
      });
    };

    if(this.runningTimers.has(id)) this.stopTimer(id, _cb);
    else _cb();
  }

  /**
   * You should never stop list-total timers
   */
  stopTimer(id, cb) {
    if(this.listCurrent.has(id)) {
      this._flushSpeech(this.listCurrent.get(id), true);
      this._flushStats();
    }
    if(!this.runningTimers.has(id)) return void cb('AlreadyStopped');
    const intId = this.runningTimers.get(id);

    // TODO: if stopTimer is called right after startTimer, this.timerValues[id] may be undefined

    this.db.put(`timer:${id}:left`, this.timerValues.get(id), (err) => {
      if(err) return void cb(err);

      clearInterval(intId);
      this.runningTimers.delete(id);
      this.timerSpeaker.delete(id);

      for(const l of this.listeners)
        if(l.timerStopped) l.timerStopped(id);

      if(this.listCurrent.has(id)) {
        const listId = this.listCurrent.get(id);
        if(this.listTotal.has(listId))
          return void this.stopTimer(this.listTotal.get(listId), (err) => {
            if(err === 'AlreadyStopped') return void cb(null);
            else return void cb(err);
          });
      }

      cb(null);
    });
  }

  updateTimer(id, value, cb) {
    if(this.runningTimers.has(id)) return void cb('TimerRunning');

    Promise.all([
      (resolve, reject) => this.db.put(`timer:${id}:left`, value, err => err ? reject(err) : resolve(err)),
      (resolve, reject) => this.db.put(`timer:${id}`, value, err => err ? reject(err) : resolve(err)),
    ].map(e => new Promise(e))).then(() => {
      for(const l of this.listeners)
        if(l.timerUpdated) l.timerUpdated(id, value);
      cb(null);
    }).catch(cb);
  }

  /** Adjusts only the remaining time of a stopped timer */
  updateTimerLeft(id, left, cb) {
    if(this.runningTimers.has(id)) return void cb('TimerRunning');

    this.db.get(`timer:${id}`, (err, value) => {
      if(err) return void cb(err);

      const clamped = Math.max(0, Math.min(left, value));
      this.db.put(`timer:${id}:left`, clamped, (err) => {
        if(err) return void cb(err);

        for(const l of this.listeners)
          if(l.timerLeftSet) l.timerLeftSet(id, clamped);
        cb(null);
      });

      return undefined;
    });
  }

  /**
   * Possible values for type:
   * - 'standalone': A standalone timer
   * - 'list-current', 'list-total': A timer for a speaker list,
   *       whose name must be identical to the list's id
   */

  addTimer(name, type, value, cb) {
    const id = crypto.randomBytes(16).toString('hex');

    this.db.get('timers', (err, timers) => {
      if(err) return void cb(err);
      timers.unshift({ id, name, type });
      Promise.all([
        (resolve, reject) => this.db.put('timers', timers, err ? reject(err) : resolve(err)),
        (resolve, reject) => this.db.put(`timer:${id}`, value, err ? reject(err) : resolve(err)),
        (resolve, reject) => this.db.put(`timer:${id}:left`, value, err ? reject(err) : resolve(err)),
      ].map(e => new Promise(e))).then(() => {
        if(type === 'list-current')
          this.listCurrent.set(id, name);
        else if(type === 'list-total')
          this.listTotal.set(name, id);

        for(const l of this.listeners)
          if(l.timerAdded) l.timerAdded(id, name, type, value);

        if(type === 'standalone') this.addHistory('timer-add', { name, value });
        return void cb(null, id);
      }).catch(cb);
    });
  }

  listTimers() {
    return new Promise((resolve, reject) => this.db.get('timers', (err, timers) => {
      if(err) return void reject(err);

      for(const timer of timers)
        if(this.runningTimers.has(timer.id)) {
          timer.left = this.timerValues.get(timer.id);
          timer.active = true;
        }

      const promises = timers.map(timer => (resolve, reject) => {
        this.db.get(`timer:${timer.id}`, (err, value) => {
          if(err) return void reject(err);

          this.db.get(`timer:${timer.id}:left`, (err, left) => {
            if(err) return void reject(err);

            timer.value = value;
            if(!timer.left) timer.left = left; // Respect running timers
            if(!timer.active) timer.active = false;

            return void resolve(timer);
          });
        });
      }).map(e => new Promise(e));

      Promise.all(promises).then(resolve).catch(reject);
    }));
  }

  /* Seats */

  updateSeats(seats, cb) {
    this.db.put('seats', seats, (err) => {
      if(err) return void cb(err);
      for(const l of this.listeners)
        if(l.seatsUpdated) l.seatsUpdated(seats);
      return void cb();
    });
  }

  listSeats() {
    return new Promise((resolve, reject) => this.db.get('seats', (err, seats) => {
      if(err) return void reject(err);
      else return void resolve(seats);
    }));
  }

  /* Files */
  // TODO: add cache

  addFile(name, type, content, cb) {
    const id = crypto.randomBytes(16).toString('hex');

    Promise.all([
      (resolve, reject) => {
        this.db.get('files', (err, files) => {
          if(err) return void reject(err);
          files.unshift({ id, name, type });
          this.db.put('files', files, err ? reject(err) : resolve(err));
        });
      },
      (resolve, reject) =>
        fs.writeFile(`${this.fileRoot}/${id}`, content, err => err ? reject(err) : resolve()),
    ].map(e => new Promise(e))).then(() => {
      for(const l of this.listeners)
        if(l.fileAdded) l.fileAdded(id, name, type);

      this.addHistory('file-add', { name });
      return void cb(null, id);
    }).catch((err) => {
      console.log(err);
      cb(err);
    });
  }

  editFile(id, content, cb) {
    return fs.writeFile(`${this.fileRoot}/${id}`, content, (err) => {
      if(err) return void cb(err);
      for(const l of this.listeners)
        if(l.fileEdited) l.fileEdited(id);
      return void cb();
    });
  }

  getFile(id, cb) {
    return fs.readFile(`${this.fileRoot}/${id}`, cb);
  }

  listFiles() {
    return new Promise((resolve, reject) => this.db.get('files', (err, files) => {
      if(err) return void reject(err);
      else return void resolve(files);
    }));
  }

  /* Votes */
  /**
   * vote:${id}:matrix -> vote can have the following values:
   * 0: pass / didn't vote
   * -1: abstained
   * -2: negative
   * 1: positive
   *
   * If vote is a substantive vote, target should be -1
   */

  addVote(name, rounds, target, seats, cb) {
    const id = crypto.randomBytes(16).toString('hex');
    const matrix = seats.map(e => ({ name: e, vote: 0 }));

    Promise.all([
      (resolve, reject) => this.db.get('votes', (err, votes) => {
        if(err) return void reject(err);
        votes.unshift({ id, name, target, rounds });
        this.db.put('votes', votes, err => err ? reject(err) : resolve());
      }),
      (resolve, reject) => this.db.put(`vote:${id}:status`, { iteration: 0, running: false }, err => err ? reject(err) : resolve()),
      (resolve, reject) => this.db.put(`vote:${id}:matrix`, matrix, err => err ? reject(err) : resolve()),
    ].map(e => new Promise(e))).then(() => {
      for(const l of this.listeners)
        if(l.voteAdded) l.voteAdded(id, name, rounds, target, seats);

      this.addHistory('vote-add', { name, seatCount: seats.length });
      return void cb(null, id);
    }).catch(cb);
  }

  updateVote(id, index, vote, cb) {
    this.db.get(`vote:${id}:matrix`, (err, matrix) => {
      if(err) return void cb(err);

      matrix[index].vote = vote;
      this.db.put(`vote:${id}:matrix`, matrix, (err) => {
        if(err) return void cb(err);

        for(const l of this.listeners)
          if(l.voteUpdated) l.voteUpdated(id, index, vote);
        return void cb(null);
      });
    });
  }

  iterateVote(id, status, cb) {
    this.db.put(`vote:${id}:status`, status, err => {
      if(err) return void cb(err);

      for(const l of this.listeners)
        if(l.voteIterated) l.voteIterated(id, status);

      this._logVoteIteration(id, status);
      return void cb(null);
    });
  }

  _logVoteIteration(id, status) {
    this._getOr('votes', [], (err, votes) => {
      if(err) return;

      let name = null;
      for(const v of votes) if(v.id === id) {
        name = v.name;
        break;
      }
      if(name === null) return;

      if(status.running)
        this.addHistory('vote-round-start', { name, iteration: status.iteration });
      else this._getOr(`vote:${id}:matrix`, [], (err, matrix) => {
        if(err) return;

        const count = t => matrix.reduce((prev, e) => e.vote === t ? prev + 1 : prev, 0);
        this.addHistory('vote-round-end', {
          name,
          iteration: status.iteration,
          positive: count(1),
          negative: count(-2),
          abstained: count(-1),
          passOrNoVote: count(0),
        });
      });
    });
  }

  listVotes() {
    return new Promise((resolve, reject) => {
      this.db.get('votes', (err, votes) => {
        if(err) return void reject(err);

        const promises = votes.map(vote => Promise.all([
          new Promise((resolve, reject) => this.db.get(`vote:${vote.id}:status`, (err, status) => err ? reject(err) : resolve(status))),
          new Promise((resolve, reject) => this.db.get(`vote:${vote.id}:matrix`, (err, matrix) => err ? reject(err) : resolve(matrix))),
        ]).then(([status, matrix]) => ({
          id: vote.id,
          name: vote.name,
          rounds: vote.rounds,
          target: vote.target,
          status,
          matrix,
        })));

        Promise.all(promises).then(resolve).catch(reject);
      });
    });
  }

  /* Lists */

  addList(name, seats, cb) {
    const id = crypto.randomBytes(16).toString('hex');

    this.db.get('lists', (err, lists) => {
      if(err) return void cb(err);

      lists.unshift({ name, id });

      Promise.all([
        new Promise((resolve, reject) => this.db.put('lists', lists, err => err ? reject(err) : resolve())),
        new Promise((resolve, reject) => this.db.put(`list:${id}:seats`, seats, err => err ? reject(err) : resolve())),
        new Promise((resolve, reject) => this.db.put(`list:${id}:ptr`, 0, err => err ? reject(err) : resolve())),
      ]).then(() => {
        this.listRevs[id] = 0;
        this.listHistories.set(id, new Map([[0, seats]]));
        for(const l of this.listeners)
          if(l.listAdded) l.listAdded(id, name, seats);

        this.addHistory('list-add', { name });
        cb(null, id);
      }).catch(cb);
    });
  }

  updateList(id, seats, rev, cb) {
    // Serialize writes per conference so merges always see the latest state
    this._listWrites = this._listWrites.then(() => new Promise((resolve) => {
      this._updateListInner(id, seats, rev, (err) => {
        cb(err);
        resolve();
      });
    }));
  }

  _updateListInner(id, seats, rev, cb) {
    const cur = this.listRevs[id] || 0;
    let hist = this.listHistories.get(id);
    if(!hist) {
      hist = new Map();
      this.listHistories.set(id, hist);
    }

    const commit = (next, prev) => {
      this.db.put(`list:${id}:seats`, next, err => {
        if(err) return void cb(err);

        this.listRevs[id] = cur + 1;
        hist.set(cur + 1, next);
        while(hist.size > 50) hist.delete(hist.keys().next().value);

        for(const l of this.listeners)
          if(l.listUpdated) l.listUpdated(id, next, this.listRevs[id]);

        // A removed delegate takes their presentation notes with them
        if(prev) {
          const kept = new Set(next.map(s => s.uid));
          const gone = prev.filter(s => s.uid && !kept.has(s.uid))
            .map(s => `seat:${id}:${s.uid}`);
          if(gone.length > 0) this.removeNotesByPrefix(gone);
        }

        cb(null);
      });
    };

    return void this.db.get(`list:${id}:seats`, (gerr, serverSeats) => {
      const prev = gerr ? [] : serverSeats || [];
      if(!Number.isInteger(rev) || rev === cur) return void commit(seats, prev);

      // Based on a stale revision: someone else edited concurrently.
      // Merge with the current server version - entries are never refused.
      const base = hist.get(rev) || [];
      return void commit(mergeSeats(base, prev, seats), prev);
    });
  }

  iterateList(id, ptr, cb) {
    this.db.put(`list:${id}:ptr`, ptr, err => {
      if(err) return void cb(err);

      for(const l of this.listeners)
        if(l.listIterated) l.listIterated(id, ptr);

      cb(null);
    });
  }

  listLists() {
    return new Promise((resolve, reject) => this.db.get('lists', (err, lists) => {
      if(err) return void reject(err);
      else resolve(lists);
    })).then(lists =>
      Promise.all(lists.map(list => new Promise((resolve, reject) => Promise.all([
        (resolve, reject) => this.db.get(`list:${list.id}:seats`, (err, seats) => err ? reject(err) : resolve(seats)),
        (resolve, reject) => this.db.get(`list:${list.id}:ptr`, (err, ptr) => err ? reject(err) : resolve(ptr)),
      ].map(e => new Promise(e))).then(([seats, ptr]) => resolve({
        id: list.id,
        name: list.name,
        seats,
        ptr,
        rev: this.listRevs[list.id] || 0,
      })).catch(reject)))));
  }

  /* Motions */

  addMotion(data, cb) {
    const id = crypto.randomBytes(16).toString('hex');
    const time = Date.now();

    const motion = {
      id,
      name: data.name,
      proposer: data.proposer,
      type: data.type || 'other',
      params: data.params || {},
      time,
      outcome: 'pending',
      visible: true,
      executed: false,
    };

    this._getOr('motions', [], (err, motions) => {
      if(err) return void cb(err);

      motions.unshift(motion);
      this.db.put('motions', motions, (err) => {
        if(err) return void cb(err);

        for(const l of this.listeners)
          if(l.motionAdded) l.motionAdded(motion);

        this.addHistory('motion-add', {
          name: motion.name,
          proposer: motion.proposer,
          motionType: motion.type,
          totTime: (motion.params && motion.params.totTime) || undefined,
          eachTime: (motion.params && motion.params.eachTime) || undefined,
        });
        this._bumpDelegate(motion.proposer, 'motions');
        return void cb(null, id);
      });

      return undefined;
    });
  }

  editMotion(id, data, cb) {
    let oldProposer = null;
    this._renameInIndex('motions', id, (e) => {
      oldProposer = e.proposer;
      e.name = data.name;
      e.proposer = data.proposer;
      e.type = data.type || 'other';
      e.params = data.params || {};
    }, (err, motion) => {
      if(err) return void cb(err);

      // Keep the per-delegate motion count on the right name
      if(oldProposer !== data.proposer) {
        this._bumpDelegate(oldProposer, 'motions', -1);
        this._bumpDelegate(data.proposer, 'motions', 1);
      }

      for(const l of this.listeners)
        if(l.motionEdited) l.motionEdited(motion);
      return void cb(null);
    });
  }

  setMotionVisible(id, visible, cb) {
    this._renameInIndex('motions', id, (e) => { e.visible = visible; }, (err) => {
      if(err) return void cb(err);

      for(const l of this.listeners)
        if(l.motionVisibility) l.motionVisibility(id, visible);
      return void cb(null);
    });
  }

  markMotionExecuted(id, instance, cb) {
    this._renameInIndex('motions', id, (e) => {
      e.executed = true;
      if(instance) e.instance = instance;
    }, (err) => {
      if(err) return void cb(err);

      for(const l of this.listeners)
        if(l.motionExecuted) l.motionExecuted(id, instance);
      return void cb(null);
    });
  }

  updateMotion(id, outcome, cb) {
    this._getOr('motions', [], (err, motions) => {
      if(err) return void cb(err);

      let motion = null;
      for(const m of motions) if(m.id === id) {
        motion = m;
        break;
      }
      if(!motion) return void cb('NotFound');

      motion.outcome = outcome;
      this.db.put('motions', motions, (err) => {
        if(err) return void cb(err);

        for(const l of this.listeners)
          if(l.motionUpdated) l.motionUpdated(id, outcome);

        if(outcome !== 'pending')
          this.addHistory('motion-outcome', {
            name: motion.name,
            proposer: motion.proposer,
            outcome,
          });
        return void cb(null);
      });

      return undefined;
    });
  }

  listMotions() {
    return new Promise((resolve, reject) =>
      this._getOr('motions', [], (err, motions) => err ? reject(err) : resolve(
        // Backfill fields for motions recorded by older versions
        motions.map(m => Object.assign({
          type: 'other',
          params: {},
          visible: true,
          executed: false,
        }, m)))));
  }

  /* History */

  addHistory(type, data) {
    const entry = { id: crypto.randomBytes(6).toString('hex'), time: Date.now(), type, data };

    // Serialized to avoid losing entries on concurrent read-modify-write
    this._historyChain = this._historyChain.then(() => new Promise((resolve) => {
      this._getOr('history', [], (err, history) => {
        if(err) {
          console.error(err);
          return void resolve();
        }

        history.unshift(entry);
        this.db.put('history', history, (err) => {
          if(err) console.error(err);
          else for(const l of this.listeners)
            if(l.historyAdded) l.historyAdded(entry);
          resolve();
        });

        return undefined;
      });
    }));

    return entry;
  }

  /** Patches one history entry in place and broadcasts the change */
  _updateHistoryEntry(id, patch) {
    this._historyChain = this._historyChain.then(() => new Promise((resolve) => {
      this._getOr('history', [], (err, history) => {
        if(err) {
          console.error(err);
          return void resolve();
        }

        let entry = null;
        for(const e of history) if(e.id === id) {
          entry = e;
          break;
        }
        if(!entry) return void resolve();

        Object.assign(entry.data, patch);
        return void this.db.put('history', history, (perr) => {
          if(perr) console.error(perr);
          else for(const l of this.listeners)
            if(l.historyUpdated) l.historyUpdated(id, entry.data);
          resolve();
        });
      });
    }));
  }

  /** Persists the running speech's duration so timelines can show it */
  _flushSpeech(listId, keep) {
    const as = this.activeSpeech.get(listId);
    if(!keep) this.activeSpeech.delete(listId);
    if(!as || as.seconds === 0) return;
    this._updateHistoryEntry(as.entryId, { duration: as.seconds });
  }

  listHistory() {
    return new Promise((resolve, reject) =>
      this._getOr('history', [], (err, history) => err ? reject(err) : resolve(history)));
  }

  _logSpeechStart(listId, timerId) {
    this._getOr('lists', [], (err, lists) => {
      if(err) return;

      let listName = null;
      for(const l of lists) if(l.id === listId) {
        listName = l.name;
        break;
      }
      if(listName === null) return;

      this._getOr(`list:${listId}:seats`, [], (err, seats) => {
        if(err) return;

        this._getOr(`list:${listId}:ptr`, 0, (err, ptr) => {
          if(err) return;

          const speaker = ptr < seats.length ? seats[ptr].name : null;
          this.timerSpeaker.set(timerId, speaker);

          // A pause/resume of the same speaker is not a new speech
          const key = `${ptr}|${speaker}`;
          if(this.lastSpeech.get(listId) === key) return;
          this.lastSpeech.set(listId, key);

          this._flushSpeech(listId);
          if(speaker) this._bumpDelegate(speaker, 'speeches');
          const entry = this.addHistory('speech-start', { list: listName, speaker });
          this.activeSpeech.set(listId, { entryId: entry.id, seconds: 0 });
        });
      });
    });
  }

  _bumpDelegate(name, field, delta = 1, defer) {
    if(!name) return;

    if(!this.delegates[name])
      this.delegates[name] = { speeches: 0, spokenTime: 0, motions: 0 };
    this.delegates[name][field] += delta;
    if(this.delegates[name][field] < 0) this.delegates[name][field] = 0;

    if(defer) {
      this._statsDirty.delegates.add(name);
      return;
    }

    this.db.put('delegates', this.delegates, () => {});
    for(const l of this.listeners)
      if(l.delegateUpdated) l.delegateUpdated(name, this.delegates[name]);
  }

  _flushStats() {
    try {
      if(this._statsDirty.spoken) {
        this._statsDirty.spoken = false;
        this.db.put('stats:spoken', this.spokenTime, () => {});
        for(const l of this.listeners)
          if(l.spokenUpdated) l.spokenUpdated(this.spokenTime);
      }

      if(this._statsDirty.delegates.size > 0) {
        const names = [...this._statsDirty.delegates];
        this._statsDirty.delegates.clear();
        this.db.put('delegates', this.delegates, () => {});
        for(const name of names)
          for(const l of this.listeners)
            if(l.delegateUpdated) l.delegateUpdated(name, this.delegates[name]);
      }
    } catch(e) {
      console.error(e);
    }
  }

  /* Renames */

  _renameInIndex(key, id, apply, cb) {
    this._getOr(key, [], (err, entries) => {
      if(err) return void cb(err);

      let entry = null;
      for(const e of entries) if(e.id === id) {
        entry = e;
        break;
      }
      if(!entry) return void cb('NotFound');

      apply(entry);
      this.db.put(key, entries, err => err ? cb(err) : cb(null, entry));

      return undefined;
    });
  }

  renameTimer(id, name, cb) {
    this._renameInIndex('timers', id, e => { e.name = name; }, (err) => {
      if(err) return void cb(err);

      for(const l of this.listeners)
        if(l.timerRenamed) l.timerRenamed(id, name);
      return void cb(null);
    });
  }

  renameList(id, name, cb) {
    this._renameInIndex('lists', id, e => { e.name = name; }, (err) => {
      if(err) return void cb(err);

      for(const l of this.listeners)
        if(l.listRenamed) l.listRenamed(id, name);
      return void cb(null);
    });
  }

  renameVote(id, name, cb) {
    this._renameInIndex('votes', id, e => { e.name = name; }, (err) => {
      if(err) return void cb(err);

      for(const l of this.listeners)
        if(l.voteRenamed) l.voteRenamed(id, name);
      return void cb(null);
    });
  }

  renameFile(id, name, cb) {
    this._renameInIndex('files', id, e => { e.name = name; }, (err) => {
      if(err) return void cb(err);

      for(const l of this.listeners)
        if(l.fileRenamed) l.fileRenamed(id, name);
      return void cb(null);
    });
  }

  renameMotion(id, name, proposer, cb) {
    let oldProposer = null;
    this._renameInIndex('motions', id, (e) => {
      oldProposer = e.proposer;
      e.name = name;
      e.proposer = proposer;
    }, (err) => {
      if(err) return void cb(err);

      // Keep the per-delegate motion count attributed to the right name
      if(oldProposer !== proposer) {
        this._bumpDelegate(oldProposer, 'motions', -1);
        this._bumpDelegate(proposer, 'motions', 1);
      }

      for(const l of this.listeners)
        if(l.motionRenamed) l.motionRenamed(id, name, proposer);
      return void cb(null);
    });
  }

  /* Removals */

  _killTimer(id) {
    if(this.runningTimers.has(id)) {
      clearInterval(this.runningTimers.get(id));
      this.runningTimers.delete(id);
    }
    this.timerValues.delete(id);
    this.timerSpeaker.delete(id);
    this.listCurrent.delete(id);
  }

  removeTimer(id, cb) {
    this._getOr('timers', [], (err, timers) => {
      if(err) return void cb(err);

      const entry = timers.find(t => t.id === id);
      if(!entry) return void cb('NotFound');
      if(entry.type !== 'standalone') return void cb('BadRequest');

      this._killTimer(id);

      this.db.put('timers', timers.filter(t => t.id !== id), (err) => {
        if(err) return void cb(err);

        Promise.all([
          new Promise(resolve => this.db.del(`timer:${id}`, () => resolve())),
          new Promise(resolve => this.db.del(`timer:${id}:left`, () => resolve())),
        ]).then(() => {
          for(const l of this.listeners)
            if(l.timerRemoved) l.timerRemoved(id);
          cb(null);
        });
      });

      return undefined;
    });
  }

  removeList(id, cb) {
    this._getOr('timers', [], (err, timers) => {
      if(err) return void cb(err);

      const related = timers.filter(t =>
        (t.type === 'list-current' || t.type === 'list-total') && t.name === id);
      for(const t of related) this._killTimer(t.id);
      this.listTotal.delete(id);
      this.lastSpeech.delete(id);

      this._getOr('lists', [], (err, lists) => {
        if(err) return void cb(err);

        const remaining = timers.filter(t => related.indexOf(t) === -1);
        const keptLists = lists.filter(l => l.id !== id);
        Promise.all([
          new Promise((resolve, reject) =>
            this.db.put('timers', remaining, err => err ? reject(err) : resolve())),
          new Promise((resolve, reject) =>
            this.db.put('lists', keptLists, err => err ? reject(err) : resolve())),
          new Promise(resolve => this.db.del(`list:${id}:seats`, () => resolve())),
          new Promise(resolve => this.db.del(`list:${id}:ptr`, () => resolve())),
        ].concat(related.map(t => Promise.all([
          new Promise(resolve => this.db.del(`timer:${t.id}`, () => resolve())),
          new Promise(resolve => this.db.del(`timer:${t.id}:left`, () => resolve())),
        ])))).then(() => {
          for(const t of related)
            for(const l of this.listeners)
              if(l.timerRemoved) l.timerRemoved(t.id);

          for(const l of this.listeners)
            if(l.listRemoved) l.listRemoved(id);
          cb(null);
        }).catch(cb);
      });

      return undefined;
    });
  }

  removeMotion(id, cb) {
    this._getOr('motions', [], (err, motions) => {
      if(err) return void cb(err);
      if(!motions.some(m => m.id === id)) return void cb('NotFound');

      this.db.put('motions', motions.filter(m => m.id !== id), (err) => {
        if(err) return void cb(err);

        for(const l of this.listeners)
          if(l.motionRemoved) l.motionRemoved(id);
        return void cb(null);
      });

      return undefined;
    });
  }

  removeVote(id, cb) {
    this._getOr('votes', [], (err, votes) => {
      if(err) return void cb(err);
      if(!votes.some(v => v.id === id)) return void cb('NotFound');

      this.db.put('votes', votes.filter(v => v.id !== id), (err) => {
        if(err) return void cb(err);

        Promise.all([
          new Promise(resolve => this.db.del(`vote:${id}:status`, () => resolve())),
          new Promise(resolve => this.db.del(`vote:${id}:matrix`, () => resolve())),
        ]).then(() => {
          for(const l of this.listeners)
            if(l.voteRemoved) l.voteRemoved(id);
          cb(null);
        });
      });

      return undefined;
    });
  }

  removeFile(id, cb) {
    this._getOr('files', [], (err, files) => {
      if(err) return void cb(err);
      if(!files.some(f => f.id === id)) return void cb('NotFound');

      this.db.put('files', files.filter(f => f.id !== id), (err) => {
        if(err) return void cb(err);

        fs.unlink(`${this.fileRoot}/${id}`, () => {
          for(const l of this.listeners)
            if(l.fileRemoved) l.fileRemoved(id);
          cb(null);
        });
      });

      return undefined;
    });
  }

  /* Projector brand */

  setBrand(brand, cb) {
    this.db.put('brand', brand, (err) => {
      if(err) return void cb(err);

      for(const l of this.listeners)
        if(l.brandUpdated) l.brandUpdated(brand);
      return void cb(null);
    });
  }

  /* Collaborative notes: key -> { snapshot (b64 Yjs state), text, updated } */

  getNote(key, cb) {
    this._getOr('notes', {}, (err, notes) => {
      if(err) return void cb(err);
      return void cb(null, notes[key] || null);
    });
  }

  setNote(key, snapshot, text, cb) {
    if(typeof key !== 'string' || key.length > 120) return void cb('BadKey');
    if(typeof snapshot !== 'string' || snapshot.length > 140000) return void cb('TooLong');
    const clean = String(text || '').slice(0, 5000);

    return void this._getOr('notes', {}, (err, notes) => {
      if(err) return void cb(err);
      if(!notes[key] && Object.keys(notes).length >= 300) return void cb('TooMany');

      notes[key] = { snapshot, text: clean, updated: Date.now() };
      return void this.db.put('notes', notes, (perr) => {
        if(perr) return void cb(perr);
        for(const l of this.listeners)
          if(l.noteMeta) l.noteMeta(key, clean, notes[key].updated);
        return void cb(null);
      });
    });
  }

  /** Deletes all notes whose key starts with any of the prefixes */
  removeNotesByPrefix(prefixes, cb) {
    const done = cb || (() => {});
    this._getOr('notes', {}, (err, notes) => {
      if(err) return void done(err);

      const removed = [];
      for(const key of Object.keys(notes))
        if(prefixes.some(p => key.indexOf(p) === 0)) {
          removed.push(key);
          delete notes[key];
        }

      if(removed.length === 0) return void done(null, []);
      return void this.db.put('notes', notes, (perr) => {
        if(perr) return void done(perr);
        for(const l of this.listeners)
          if(l.notesRemoved) l.notesRemoved(removed);
        return void done(null, removed);
      });
    });
  }

  listNotesMeta() {
    return new Promise((resolve) => this._getOr('notes', {}, (err, notes) => {
      if(err) return void resolve({});
      const meta = {};
      for(const key of Object.keys(notes))
        meta[key] = { text: notes[key].text, updated: notes[key].updated };
      return void resolve(meta);
    }));
  }

  fetchAll(cb) {
    Promise.all([
      this.listTimers(),
      this.listSeats(),
      this.listFiles(),
      this.listVotes(),
      this.listLists(),
      this.listMotions(),
      this.listHistory(),
      new Promise((resolve, reject) =>
        this._getOr('brand', '', (err, brand) => err ? reject(err) : resolve(brand))),
      this.listNotesMeta(),
    ]).then(([timers, seats, files, votes, lists, motions, history, brand, notesMeta]) => {
      cb(null, {
        timers,
        seats,
        files,
        votes,
        lists,
        motions,
        history,
        brand,
        notesMeta,
        spokenTime: this.spokenTime,
        delegates: this.delegates,
      });
    }).catch(cb);
  }

  addListener(listener) {
    this.listeners.push(listener);
  }
}

module.exports = Conference;
module.exports.mergeSeats = mergeSeats;
