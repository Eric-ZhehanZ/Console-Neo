// SPDX-License-Identifier: AGPL-3.0-or-later AND MIT
// Copyright (C) 2016 Liu Xiaoyi
// Copyright (C) 2018 Pan Ruizhe
// Modifications Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE, NOTICE, and LICENSES/MIT.txt for terms.

const Vue = require('vue');
const VueAnimatedList = require('vue-animated-list');
Vue.use(VueAnimatedList);

const io = require('socket.io-client');
const Push = require('push.js');
const crypto = require('crypto');
const motionTypes = require('../shared/motion-types');
const i18n = require('../shared/i18n');
const reminder = require('../shared/reminder');
const discovery = require('../shared/discovery');
const network = require('../shared/network');
const tunnel = require('../shared/tunnel');

const DEFAULT_RELAY = 'https://connect.consoleneo.com';

/* Relay reachability polling. Generous timeout because the first probe
   competes with everything else the app does on startup */
const RELAY_TIMEOUT = 8000;
const RELAY_POLL = 30000;
const RELAY_RETRY = 5000;
const RELAY_BACKOFF_MAX = 30000;
const path = require('path');
const os = require('os');
const { ipcRenderer } = require('electron');

const GlobalConnection = require('./connection/global');
const ConferenceConnection = require('./connection/conference');

const util = require('../shared/util.js');
const nodeUtil = require('util');

function stopTheWorld() { // eslint-disable-line
  const pauseBtn = document.querySelector('i[title="Pause"]');
  if(pauseBtn && pauseBtn.parentElement.style.display !== 'none')
    pauseBtn.parentElement.click();

  setTimeout(() => {
    debugger; // eslint-disable-line
  }, 500);
}

require('../shared/components/timer');
require('../shared/components/timer-input');
require('../shared/components/timer-input-1');
require('../shared/components/delegate-selector');
require('../shared/components/server-line');
require('../shared/components/code-badge');
require('../shared/components/net-status');
require('../shared/components/note-dots');

let globalConn;
let confConn;

let serverConfig;

// Established sessions authenticate with their token, so they outlive
// the automatic credential rotation; fresh connects use current keys
function authQuery() {
  if(serverConfig.token) return `console-token=${serverConfig.token}`;
  return `console-passkey=${serverConfig.passkey}`;
}

// Lets the freshly minted token reach the main-process resume snapshot
let saveResumeHook = null;

function adoptSessionToken(socket) {
  socket.on('sessionToken', ({ token }) => {
    if(!token) return;
    serverConfig.token = token;
    // Reconnect attempts reuse the manager's query - point it at the token
    try {
      socket.io.opts.query = `console-token=${token}`;
    } catch(e) { }
    if(saveResumeHook) saveResumeHook();
  });
}

let connectedConf;

const notifySound = new Audio('notify.ogg');

function playNotify(times) {
  let left = Math.max(times || 1, 1);
  const one = () => {
    notifySound.currentTime = 0;
    notifySound.play().catch(() => {});
    left -= 1;
    if(left > 0) setTimeout(one, 700);
  };
  one();
}

const desc = {
  el: 'body',
  data: {
    started: false,
    ready: false,
    loading: false,
    picker: false,
    frame: false,

    projOn: false,
    proj: {
      mode: 'none',
      target: null,
    },

    createConfFlag: false,
    confName: '',

    services: [],
    showServerFlag: false,
    startupStage: 'menu',
    codeInput: '',
    selectedService: null,
    netOk: true,
    netChecking: false,
    relayProbeOk: false,
    relayChecking: false,

    sessionIdInput: '',
    relayConnecting: false,
    relayUrl: DEFAULT_RELAY,
    routePref: 'lan',
    relayHostStatus: 'off',
    backendCode: '',
    backendReaderCode: '',

    backendIDKey: '',
    backendUrl: '',
    backendPasskey: '',
    backendReaderKey: '',
    isLocalServer: false,
    connLost: false,
    hostVersion: null,

    pickerMode: 'menu',
    selectedConf: null,
    confSearch: '',
    readOnly: false,
    currentConfId: null,

    syncCast: true,
    castFallback: 'base',
    iAmHost: false,
    claimPending: false,
    castHostName: null,
    applyingProj: false,

    title: '',

    authorized: false,
    confs: [],

    activeView: 'home',

    presentCount: 0,
    seatCount: 0,

    timers: [],
    seats: [],
    files: [],
    votes: [],
    lists: [],
    motions: [],
    history: [],
    spokenTime: 0,
    brand: '',
    delegates: {},

    fileCache: {},
    fileViewId: null,
    fileViewZoom: 1,
    fileViewScrollRatio: 0,
    fileProjectionToken: 0,
    pendingSharedFile: null,
    sharedProjectionRevision: 0,
    timerWaitingList: [],

    file: null,
    vote: null,
    list: null,
    focusTimer: null,
    searchInput: '',

    altHold: false,
    backquoteHold: false,

    delegateFocus: null,
    notesMeta: {},
    motionsSort: 'chrono',
    motionsFilter: 'custom',
    motionsFilterHidden: [],
    pendingListSync: null,
    pendingMotionSync: null,
    projectedMotionIds: null,
    motionScrollRatio: 0,
    motionControllerScrollRatio: 0,

    proposerDialog: null,
    pinnedLast: {},
    viewStack: [],

    lang: i18n.store.lang,
  },

  /* eslint-disable global-require */
  components: {
    home: require('./views/home/home'),
    seats: require('./views/seats/seats'),
    timers: require('./views/timers/timers'),
    files: require('./views/files/files'),
    votes: require('./views/votes/votes'),
    lists: require('./views/lists/lists'),
    motions: require('./views/motions/motions'),
    stats: require('./views/stats/stats'),
    delegate: require('./views/delegate/delegate'),
    settings: require('./views/settings/settings'),

    file: require('./views/file/file'),
    vote: require('./views/vote/vote'),
    list: require('./views/list/list'),
    timerpage: require('./views/timerpage/timerpage'),
  },
  /* eslint-enable global-require */

  methods: {
    init() {
      setTimeout(() => { // kind of tricky...
        this.started = true;
      }, 0);

      try {
        if(window.localStorage.getItem('cln-cast-fallback') === 'keep')
          this.castFallback = 'keep';
      } catch(e) { }

      this.projOn = ipcRenderer.sendSync('getProjector') !== null;
      this.sendToProjector({ type: 'reset' });

      ipcRenderer.on('projectorReady', () => {
        this.projOn = true;
        this.setupProjector();
      });

      ipcRenderer.on('projectorClosed', () => {
        this.projOn = false;
      });

      ipcRenderer.on('navigateTo', (event, dest) => {
        if(this.frame) this.navigate(dest);
      });

      // A reload starts unconnected until the session is back
      ipcRenderer.send('setHostInfo', null);

      ipcRenderer.on('serverKeysRotated', (event, keys) => {
        if(!this.isLocalServer) return;
        this.backendPasskey = keys.passkey;
        this.backendReaderKey = keys.readerkey;
        this.backendCode = keys.code || '';
        this.backendReaderCode = keys.readerCode || '';
        if(keys.url) this.backendUrl = keys.url;
        if(serverConfig) {
          serverConfig.passkey = keys.passkey;
          serverConfig.readerkey = keys.readerkey;
          if(keys.url) serverConfig.url = keys.url;
        }
      });

      setTimeout(() => {
        this.ready = true;
      }, 1000);

      saveResumeHook = () => this._saveResume();
      this.startNetWatch();

      try {
        this.relayUrl = window.localStorage.getItem('cln-relay-url') || DEFAULT_RELAY;
        if(window.localStorage.getItem('cln-route-pref') === 'relay')
          this.routePref = 'relay';
      } catch(e) { }
      ipcRenderer.send('setRelayConfig', { url: this.relayUrl });
      ipcRenderer.on('relayStatus', (event, d) => {
        this.relayHostStatus = d.status;
      });
      this.relayHostStatus = (ipcRenderer.sendSync('getRelayStatus') || {}).status || 'off';

      // A reload (crash recovery, Cmd+R) rejoins the previous session;
      // a full app restart finds nothing here and shows the launch page
      const resume = ipcRenderer.sendSync('getResumeState');
      if(resume && resume.serverConfig) this._resumeSession(resume);
    },

    /* Continuous local-network availability: one cheap interface
       enumeration every few seconds, nothing touches the wire */

    startNetWatch() {
      const check = () => {
        const was = this.netOk;
        this.netOk = network.hasLocalNetwork();
        // Losing the LAN makes the relay the only way left to
        // collaborate, so find out about it right now rather than
        // waiting out the rest of the slow cycle
        if(was && !this.netOk) this.checkRelay();
      };
      check();
      this._netTimer = setInterval(check, 4000);

      this._relayBackoff = 0;
      this.checkRelay();
    },

    /* The relay probe costs a round trip, so it reschedules itself
       rather than running on a fixed interval, and is skipped whenever
       the host agent is already registered - that answer is
       authoritative and free.

       A failed probe retries from RELAY_RETRY and backs off, instead of
       waiting out the whole cycle. Two reasons: the very first probe
       fires while the app is still opening its database, announcing
       itself and dialing the relay, and readily loses that race; and a
       relay that has just come back should show up promptly rather than
       up to half a minute later. */

    checkRelay() {
      if(this._relayProbePending) return;

      if(this._relayTimer) clearTimeout(this._relayTimer);
      const again = (delay) => {
        this._relayTimer = setTimeout(() => this.checkRelay(), delay);
      };

      if(this.relayHostStatus === 'connected') {
        this._relayBackoff = 0;
        return void again(RELAY_POLL);
      }

      this._relayProbePending = true;
      network.probeRelay(this.relayUrl, RELAY_TIMEOUT).then((ok) => {
        this._relayProbePending = false;
        this.relayProbeOk = ok;
        if(ok) {
          this._relayBackoff = 0;
          again(RELAY_POLL);
        } else {
          this._relayBackoff = this._relayBackoff
            ? Math.min(this._relayBackoff * 2, RELAY_BACKOFF_MAX) : RELAY_RETRY;
          again(this._relayBackoff);
        }
      });
      return undefined;
    },

    manualNetCheck() {
      this.netChecking = true;
      this.netOk = network.hasLocalNetwork();
      setTimeout(() => {
        this.netChecking = false;
      }, 500);
    },

    manualRelayCheck() {
      if(this.relayChecking) return;
      this.relayChecking = true;
      this._relayBackoff = 0;
      // The spinner stays up for its own minimum so a probe that
      // resolves instantly still reads as a deliberate re-check
      const settled = network.probeRelay(this.relayUrl, RELAY_TIMEOUT).then((ok) => {
        if(this.relayHostStatus !== 'connected') this.relayProbeOk = ok;
      });
      const floor = new Promise(r => setTimeout(r, 500));
      Promise.all([settled, floor]).then(() => {
        this.relayChecking = false;
      });
    },

    /* Session resume across renderer reloads */

    _saveResume() {
      if(!serverConfig) return;
      ipcRenderer.send('setResumeState', {
        serverConfig: {
          url: serverConfig.url,
          connectUrl: serverConfig.connectUrl,
          passkey: serverConfig.passkey,
          readerkey: serverConfig.readerkey,
          token: serverConfig.token,
          idkey: serverConfig.idkey,
          relaySession: serverConfig.relaySession,
          relayUrl: serverConfig.relayUrl,
        },
        isLocalServer: this.isLocalServer,
        readOnly: this.readOnly,
        confId: this.frame ? this.currentConfId : null,
        confName: this.frame ? this.title : null,
      });
    },

    _clearResume() {
      ipcRenderer.send('setResumeState', null);
    },

    _resumeSession(resume) {
      this._resuming = true;
      this._resumeConf = resume.confId
        ? { id: resume.confId, name: resume.confName } : null;
      this.readOnly = !!resume.readOnly;
      this.loading = true;

      if(resume.isLocalServer)
        // The local server still runs in the main process; reattach to it
        this.createBackend();
      else if(resume.serverConfig.relaySession) {
        // Relay sessions get a fresh tunnel (the loopback port is new
        // every launch), then reconnect exactly as before. The host may
        // itself be re-registering after a blip - retry before giving up
        const sc = resume.serverConfig;
        const tryTunnel = (attempt) =>
          tunnel.startClientTunnel({ relayUrl: sc.relayUrl, session: sc.relaySession })
            .catch((e) => {
              if(attempt < 3)
                return new Promise(r => setTimeout(r, 5000)).then(() => tryTunnel(attempt + 1));
              throw e;
            });
        tryTunnel(0)
          .then(({ port, stop }) => {
            this._clientTunnel = { stop };
            sc.url = `http://127.0.0.1:${port}`;
            serverConfig = sc;
            this._createGlobalConn();
          })
          .catch(() => this._resumeFailed());
      } else {
        serverConfig = resume.serverConfig;
        this._createGlobalConn();
      }

      // A server that never answers drops us back on the launch page
      this._resumeTimer = setTimeout(() => this._resumeFailed(),
        resume.serverConfig.relaySession ? 45000 : 12000);
    },

    _resumeFailed() {
      if(!this._resuming) return;
      this._resuming = false;
      this._resumeConf = null;
      if(globalConn && globalConn.socket) try {
        globalConn.socket.disconnect();
      } catch(e) { }
      globalConn = null;
      this._refreshConnLost();
      this._clearResume();
      this.loading = false;
      this.picker = false;
      this.startupStage = 'menu';
    },

    /**
     * A remote session that stays unreachable for a while sends us back
     * to the launch page (start local / connect options). Local-server
     * hosts talk over loopback and never trip this. Each socket keeps
     * its own timer, and relay links get extra patience: a tunnel plus
     * host re-registration can legitimately take most of a minute.
     * While any live socket is down, `connLost` shows the reconnecting banner.
     */
    _watchRemoteDrop(socket) {
      if(this.isLocalServer) return;
      let timer = null;
      socket.on('disconnect', (reason) => {
        // Our own disconnect (switching committees, leaving) is not a drop
        if(reason === 'io client disconnect') return;
        this._markSocket(socket, true);
        const grace = serverConfig && serverConfig.relaySession ? 90000 : 30000;
        if(timer) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          // Replaced while it was down (e.g. another committee opened)
          if(!this._isLiveSocket(socket)) return void this._markSocket(socket, false);
          return void this._giveUpSession();
        }, grace);
      });
      socket.on('connect', () => {
        if(timer) {
          clearTimeout(timer);
          timer = null;
        }
        this._markSocket(socket, false);
      });
    },

    /**
     * Hosts report their version in the welcome payload (older hosts
     * don't). Main uses it for the About window and the Source Code menu,
     * so a remote user's source link matches what that host runs.
     */
    _setHostVersion(version) {
      this.hostVersion = version || null;
      ipcRenderer.send('setHostInfo', { remote: !this.isLocalServer, version: this.hostVersion });
    },

    _isLiveSocket(socket) {
      return (!!globalConn && globalConn.socket === socket)
        || (!!confConn && confConn.socket === socket);
    },

    _markSocket(socket, down) {
      this._downSockets = (this._downSockets || []).filter(s => s !== socket);
      if(down) this._downSockets.push(socket);
      this._refreshConnLost();
    },

    _refreshConnLost() {
      this._downSockets = (this._downSockets || []).filter(s => this._isLiveSocket(s));
      this.connLost = this._downSockets.length > 0;
    },

    _giveUpSession() {
      // Global and committee sockets usually expire together - explain once
      if(this._givingUp) return;
      this._givingUp = true;
      this._clearResume();
      alert(this.t('connGaveUp'));
      window.location.reload();
    },

    /**
     * Catch up after a reconnect. The server resends the whole committee, so
     * whatever other devices changed while we were away is in it. Items are
     * patched in place by id: the open detail page, the view stack and the
     * projector all hold references into these arrays.
     */
    _resyncConf(data) {
      const merge = (current, incoming) => {
        const byId = {};
        for(const e of current) byId[e.id] = e;
        return (incoming || []).map((fresh) => {
          const old = byId[fresh.id];
          if(!old) return fresh;
          for(const k of Object.keys(fresh))
            if(k in old) old[k] = fresh[k];
            else Vue.set(old, k, fresh[k]);
          return old;
        });
      };

      // Files that arrived while we were away get the same highlight as a live add
      const knownFiles = this.files.map(f => f.id);
      for(const f of data.files || [])
        if(knownFiles.indexOf(f.id) === -1) f.highlight = true;

      this.timers = merge(this.timers, data.timers);
      const lists = merge(this.lists, data.lists);
      const linked = [];
      for(const l of lists) {
        let cur = null;
        let tot = null;
        for(const t of this.timers) if(t.name === l.id) {
          if(t.type === 'list-current') cur = t;
          else if(t.type === 'list-total') tot = t;
        }
        if(cur) linked.push(cur);
        if(tot) linked.push(tot);
        if(l.timerCurrent !== cur) l.timerCurrent = cur;
        if(l.timerTotal !== tot) l.timerTotal = tot;
      }
      this.timerWaitingList = this.timers.filter(t =>
        t.type !== 'standalone' && linked.indexOf(t) === -1);
      this.lists = lists;
      this.files = merge(this.files, data.files);
      this.votes = merge(this.votes, data.votes);
      this.motions = merge(this.motions, data.motions);

      this.seats = data.seats || [];
      this.recalcCount();
      this.sendSeatCount();
      util.registerTrie(util.buildTrie(this.seats.filter(e => e.present).map(e => e.name)));

      this.notesMeta = data.notesMeta || {};
      this.history = data.history || [];
      this.spokenTime = data.spokenTime || 0;
      this.delegates = data.delegates || {};
      if((data.brand || '') !== this.brand) {
        this.brand = data.brand || '';
        this.sendBrand();
      }

      // A detail page whose item was removed meanwhile falls back to its index
      const gone = (arr, item) => !item || arr.indexOf(item) === -1;
      if(this.activeView === 'list' && gone(this.lists, this.list)) this.activeView = 'lists';
      else if(this.activeView === 'vote' && gone(this.votes, this.vote)) this.activeView = 'votes';
      else if(this.activeView === 'file' && gone(this.files, this.file)) this.activeView = 'files';
      else if(this.activeView === 'timerpage' && gone(this.timers, this.focusTimer))
        this.activeView = 'timers';

      // Redraw the room screen from the fresh data
      if(this.projOn) this.reapplyLocalProjection();

      // The server dropped our cast-host claim with the old socket. Take it
      // back unless someone else claimed it meanwhile; otherwise catch up
      // with whatever the shared cast is now
      if(this.iAmHost && this.syncCast)
        confConn.projClaimHost(os.hostname(), false, (res) => {
          if(res.ok) return void this.syncProjOut();
          if(res.error === 'Taken') {
            this.iAmHost = false;
            this.pullSharedProj();
          }
          return undefined;
        });
      else this.pullSharedProj();
    },

    _createGlobalConn() {
      /* Setup display data */
      this.backendPasskey = serverConfig.passkey;
      this.backendIDKey = serverConfig.idkey;
      this.backendUrl = serverConfig.url;

      window.info = () => console.log(this.backendUrl, this.backendIDKey, this.backendPasskey);
      window.info();

      if(serverConfig.readerkey) this.backendReaderKey = serverConfig.readerkey;

      if(globalConn && globalConn.socket) globalConn.socket.disconnect();

      const socket = io(serverConfig.connectUrl || serverConfig.url, {
        query: authQuery(),
        forceNew: true,
      });
      adoptSessionToken(socket);

      let rejected = false;
      socket.on('error', (err) => {
        // A wrong password is refused outright by the server
        if(rejected || `${err}`.indexOf('NotAuthorized') === -1) return;
        rejected = true;
        socket.disconnect();
        globalConn = null;
        // A stale resumed session bails out quietly to the launch page
        if(this._resuming) return void this._resumeFailed();
        this.loading = false;
        alert(this.t('errWrongPassword'));
        this.picker = false;
        return undefined;
      });

      this._watchRemoteDrop(socket);

      globalConn = new GlobalConnection(socket, ({
        confs, authorized, idkey, readerkey, version,
      }) => {
        this._setHostVersion(version);
        this.confs = confs;
        this.authorized = authorized;
        this.backendIDKey = idkey;
        if(readerkey) this.backendReaderKey = readerkey;
        else if(!authorized) this.backendReaderKey = serverConfig.passkey;

        if(this._resumeTimer) {
          clearTimeout(this._resumeTimer);
          this._resumeTimer = null;
        }
        this._resuming = false;
        const rc = this._resumeConf;
        this._resumeConf = null;

        if(!this.frame && !rc) {
          this.picker = true;
          this.pickerMode = 'menu';
          this.selectedConf = null;
        }
        this.startupStage = 'menu';
        this.loading = false;
        this.stopDiscovery();
        this._saveResume();

        if(rc) this.connectConf(rc.id, rc.name);
      });

      globalConn.onResync = ({
        confs, authorized, idkey, readerkey, version,
      }) => {
        this._setHostVersion(version);
        if(confs) this.confs = confs;
        this.authorized = authorized;
        if(idkey) this.backendIDKey = idkey;
        if(readerkey) this.backendReaderKey = readerkey;
        else if(!authorized) this.backendReaderKey = serverConfig.passkey;

        // Pick up a committee rename that happened while we were away
        const conf = this.frame && confs ? confs.find(c => c.id === this.currentConfId) : null;
        if(conf && conf.name && conf.name !== this.title) {
          this.title = conf.name;
          connectedConf = conf.name;
          this.sendConfName();
        }
      };
      this._refreshConnLost();
    },

    /* LAN discovery: broadcast + probe/response + Bonjour, deduped by id */

    startDiscovery() {
      if(this._stopDiscovery) return;

      const ownId = ipcRenderer.sendSync('getServerIdkey');

      try {
        this._stopDiscovery = discovery.startBrowser((entry) => {
          if(ownId && entry.id === ownId) return; // not our own session
          for(const s of this.services) if(s.id === entry.id) {
            if(entry.conf) s.conf = entry.conf;
            s.host = entry.host;
            s.port = entry.port;
            s.stamp = Date.now();
            return;
          }
          this.services.push({
            id: entry.id,
            conf: entry.conf,
            host: entry.host,
            port: entry.port,
            stamp: Date.now(),
          });
        });
        this._discoveryPrune = setInterval(() => {
          const now = Date.now();
          this.services = this.services.filter(s => now - s.stamp < 10000);
        }, 2000);
      } catch(e) {
        console.error('[WARN] LAN discovery unavailable:', e.message);
      }
    },

    stopDiscovery() {
      if(this._stopDiscovery) {
        try {
          this._stopDiscovery();
        } catch(e) { }
        this._stopDiscovery = null;
      }
      if(this._discoveryPrune) {
        clearInterval(this._discoveryPrune);
        this._discoveryPrune = null;
      }
      this.services = [];
    },

    applyService(service) {
      this.selectedService = service;
      this.codeInput = '';
      this.startupStage = 'code';
      this.$nextTick(() => {
        if(this.$els.codeInput) this.$els.codeInput.focus();
      });
    },

    /**
     * Primary connect path: the session ID typed here is resolved
     * through the relay - unless the same session is visible on the
     * LAN, in which case the direct route wins (per routing setting).
     */
    performSessionConnection() {
      if(this.relayConnecting) return;
      const id = this.sessionIdInput.trim().toUpperCase();
      if(id.length < 4) return;

      if(this.routePref !== 'relay') {
        const local = this.services.filter(s =>
          String(s.id).toUpperCase() === id)[0];
        if(local) return void this.applyService(local);
      }

      this.relayConnecting = true;
      this._stopClientTunnel();
      tunnel.startClientTunnel({ relayUrl: this.relayUrl, session: id })
        .then(({ port, stop }) => {
          this._clientTunnel = { stop };
          this.relayConnecting = false;
          this.applyService({
            id, host: '127.0.0.1', port, relay: true,
          });
        })
        .catch((e) => {
          this.relayConnecting = false;
          alert(this.t(e && e.message === 'NoSession' ? 'errNoSession' : 'errRelay'));
        });

      return undefined;
    },

    _stopClientTunnel() {
      if(this._clientTunnel) {
        try {
          this._clientTunnel.stop();
        } catch(e) { }
        this._clientTunnel = null;
      }
    },

    performCodeConnection() {
      const code = this.codeInput.trim().toUpperCase();
      if(code.length !== 6 || !this.selectedService) return;

      serverConfig = {
        url: `http://${this.selectedService.host}:${this.selectedService.port}`,
        passkey: code,
      };
      if(this.selectedService.relay) {
        serverConfig.relaySession = this.selectedService.id;
        serverConfig.relayUrl = this.relayUrl;
      }

      this.loading = true;
      this._createGlobalConn();
    },

    connectBackend() {
      this.startupStage = 'connect';
      this.selectedService = null;
      this.codeInput = '';
      this.startDiscovery();
    },

    startupMenu() {
      this.startupStage = 'menu';
      this.loading = false;
      this.stopDiscovery();
      // A tunnel opened for an abandoned join attempt is not needed
      if(!this.frame) this._stopClientTunnel();
    },

    performBackendConnection() {
      if(this.backendUrl === '' || this.backendPasskey === '') return;
      serverConfig = {
        url: this.backendUrl,
        passkey: this.backendPasskey,
      };

      this.loading = true;
      this._createGlobalConn();
    },

    createBackend() {
      ipcRenderer.once('serverCallback', (event, data) => {
        if(data.error) {
          alert(`${this.t('startFailed')}\n${
            nodeUtil.format(data.error)
          } ${process.platform === 'win32' ? this.t('startFailedWin') : ''}`);
          console.error(data);
          this.loading = false;
          return;
        }

        serverConfig = data;
        // The host talks to its own server over loopback, so network
        // changes never break the local connection; the LAN URL is display-only
        const portMatch = /:(\d+)$/.exec(data.url || '');
        serverConfig.connectUrl = `http://127.0.0.1:${portMatch ? portMatch[1] : 3066}`;
        this.backendCode = data.code || '';
        this.backendReaderCode = data.readerCode || '';
        this.isLocalServer = true;
        this.showServerFlag = true;

        this._createGlobalConn();
      });

      ipcRenderer.send('startServer');

      this.loading = true;
    },

    connectConf(confId, confName) {
      if(confConn) confConn.disconnect();

      this.currentConfId = confId;

      console.log(`Connecting to: ${serverConfig.url}/${confId}`);

      const socket = io(`${serverConfig.connectUrl || serverConfig.url}/${confId}`, {
        query: authQuery(),
        forceNew: true,
      });
      adoptSessionToken(socket);

      socket.on('error', (err) => {
        // Kicked out (e.g. the host reset the passwords): back to the launch page
        if(`${err}`.indexOf('NotAuthorized') === -1) return;
        socket.disconnect();
        if(this.frame) {
          this._clearResume();
          alert(this.t('errWrongPassword'));
          window.location.reload();
        }
      });

      this._watchRemoteDrop(socket);

      confConn = new ConferenceConnection(socket, ({ error, data }) => {
        if(error) {
          console.error(error);
          confConn = null;
          alert(this.t('errConnect'));
          return;
        }

        connectedConf = confName;

        for(const f of data.files) f.highlight = false;

        for(const list of data.lists) {
          list.timerCurrent = null;
          list.timerTotal = null;
        }

        for(const timer of data.timers) {
          if(timer.type === 'standalone') continue;

          let flag = false;
          for(const l of data.lists) if(l.id === timer.name) {
            if(timer.type === 'list-total')
              l.timerTotal = timer;
            if(timer.type === 'list-current')
              l.timerCurrent = timer;
            flag = true;
            break;
          }

          if(!flag) this.timerWaitingList.push(timer);
        }

        this.timers = data.timers;
        this.seats = data.seats;
        this.files = data.files;
        this.votes = data.votes;
        this.lists = data.lists;
        this.motions = data.motions || [];
        this.notesMeta = data.notesMeta || {};
        this.history = data.history || [];
        this.spokenTime = data.spokenTime || 0;
        this.brand = data.brand || '';
        this.delegates = data.delegates || {};

        this.recalcCount();
        util.registerTrie(util.buildTrie(this.seats.filter(e => e.present).map(e => e.name)));

        this.title = confName;

        this.activeView = 'home';
        this.frame = true;

        for(const c of this.confs) if(c.id === confId) {
          c.lastAccess = Date.now();
          break;
        }

        this.iAmHost = false;
        if(this.projOn) this.setupProjector();
        this.pullSharedProj();
        this._saveResume();
      });

      confConn.onResync = ({ error, data }) => {
        if(error || !data) return void console.error('[WARN] Resync failed:', error);
        return void this._resyncConf(data);
      };
      this._refreshConnLost();

      confConn.addListener({
        /* Seats */

        seatsUpdated: (seats) => {
          this.seats = seats;
          this.recalcCount();
          this.sendSeatCount();
          util.registerTrie(util.buildTrie(seats.filter(e => e.present).map(e => e.name)));

          if(this.projOn && this.proj.mode === 'rollcall')
            this.sendToProjector({ type: 'update', target: 'rollcall', data: { seats } });
        },

        /* Timers */

        timerAdded: (id, name, type, value) => {
          this.timers.unshift({ id, name, value, left: value, type, active: false });
          let flag = false;
          for(const l of this.lists) if(l.id === name) {
            if(type === 'standalone') continue;
            if(type === 'list-total')
              l.timerTotal = this.timers[0];
            if(type === 'list-current')
              l.timerCurrent = this.timers[0];
            flag = true;
            break;
          }

          if(!flag) this.timerWaitingList.push(this.timers[0]);
        },

        timerStarted: (id, value) => {
          this.executeOnTimer(id, timer => {
            timer.active = true;
            timer.left = value;
            // A start from full value is a new speech
            if(value === timer.value && this._remindedTimers) delete this._remindedTimers[id];
          });

          if(this.projOn && this.proj.mode === 'timer' && this.proj.target === id)
            this.sendToProjector({
              type: 'update',
              target: 'timer',
              data: { left: value, active: true },
            });
          else if(this.projOn && this.proj.mode === 'list') {
            const l = this.proj.target;
            if((l.timerCurrent && l.timerCurrent.id === id)
               || (l.timerTotal && l.timerTotal.id === id))
              this.syncProjectorList();
          }
        },

        timerReset: (id, value) => {
          if(this._remindedTimers) delete this._remindedTimers[id];
          this.executeOnTimer(id, timer => {
            timer.value = value;
            timer.left = value;
          });

          if(this.projOn && this.proj.mode === 'timer' && this.proj.target === id)
            this.sendToProjector({ type: 'update', target: 'timer', data: { left: value, value } });
          else if(this.projOn && this.proj.mode === 'list') {
            const l = this.proj.target;
            if((l.timerCurrent && l.timerCurrent.id === id)
               || (l.timerTotal && l.timerTotal.id === id))
              this.syncProjectorList();
          }
        },

        timerStopped: (id /* , value */) => {
          this.executeOnTimer(id, timer => {
            timer.active = false;
          });

          if(this.projOn && this.proj.mode === 'timer' && this.proj.target === id)
            this.sendToProjector({ type: 'update', target: 'timer', data: { active: false } });
          else if(this.projOn && this.proj.mode === 'list') {
            const l = this.proj.target;
            if((l.timerCurrent && l.timerCurrent.id === id)
               || (l.timerTotal && l.timerTotal.id === id))
              this.syncProjectorList();
          }
        },

        timerUpdated: (id, value) => {
          this.executeOnTimer(id, timer => {
            timer.value = value;
            timer.left = value;
          });

          if(this.projOn && this.proj.mode === 'timer' && this.proj.target === id)
            this.sendToProjector({ type: 'update', target: 'timer', data: { left: value, value } });
          else if(this.projOn && this.proj.mode === 'list') {
            const l = this.proj.target;
            if((l.timerCurrent && l.timerCurrent.id === id)
               || (l.timerTotal && l.timerTotal.id === id))
              this.syncProjectorList();
          }
        },

        timerLeftSet: (id, left) => {
          this.executeOnTimer(id, timer => {
            timer.left = left;
          });

          if(this.projOn && this.proj.mode === 'timer' && this.proj.target === id)
            this.sendToProjector({ type: 'update', target: 'timer', data: { left } });
          else if(this.projOn && this.proj.mode === 'list') {
            const l = this.proj.target;
            if((l.timerCurrent && l.timerCurrent.id === id)
               || (l.timerTotal && l.timerTotal.id === id))
              this.syncProjectorList();
          }
        },

        timerTick: (id, value) => {
          this.executeOnTimer(id, timer => {
            timer.left = value;

            // Sound the reminder regardless of which view is currently open
            if(timer.type !== 'list-total') {
              const n = reminder.soundCount(timer.value, value);
              if(n > 0) {
                const muted = reminder.store.single && this._remindedTimers
                  && this._remindedTimers[id];
                if(!muted) playNotify(n);
                if(reminder.store.single) {
                  if(!this._remindedTimers) this._remindedTimers = {};
                  this._remindedTimers[id] = true;
                }
              }
            }

            if(value === 0 && timer.type === 'standalone') Push.create(timer.name, {
              body: this.t('notifyTimerEnd'),
              timeout: 4000,
              icon: path.join(__dirname, '..', 'images', 'timer.png'),
            });
          });

          if(this.projOn && this.proj.mode === 'timer' && this.proj.target === id)
            this.sendToProjector({ type: 'update', target: 'timer', data: { left: value } });
          else if(this.projOn && this.proj.mode === 'list') {
            const l = this.proj.target;
            if((l.timerCurrent && l.timerCurrent.id === id)
               || (l.timerTotal && l.timerTotal.id === id))
              this.syncProjectorList();
          }
        },

        /* Files */

        fileAdded: (id, name, type) => {
          this.files.unshift({ id, name, type, highlight: true });
          Push.create(name, {
            body: this.t('notifyNewFile'),
            timeout: 4000,
            icon: path.join(__dirname, '..', 'images', 'folder.png'),
          });
        },

        fileEdited: (id) => {
          this.fileCache[id] = null;

          for(const f of this.files)
            if(f.id === id)
              f.highlight = true;

          if(this.activeView === 'file' && this.file && this.file.id === id)
            this.activeView = 'files';

          Push.create(name, {
            body: this.t('notifyFileUpdate'),
            timeout: 4000,
            icon: path.join(__dirname, '..', 'images', 'folder.png'),
          });

          // TODO: refetch if on projector
        },

        /* Votes */
        voteAdded: (id, name, target, rounds, seats) => {
          this.votes.unshift({
            id,
            name,
            target,
            rounds,

            status: {
              iteration: 0,
              running: false,
            },

            matrix: seats.map(s => ({ name: s, vote: 0 })),
          });
        },

        voteUpdated: (id, index, vote) => {
          for(const v of this.votes) if(v.id === id) {
            v.matrix[index].vote = vote;

            if(v === this.vote && !v.status.running)
              this.$broadcast('vote-rearrange');

            if(this.proj.mode === 'vote' && v === this.proj.target)
              this.sendToProjector({
                type: 'update',
                target: 'vote',
                data: { event: 'update', rearrange: !v.status.running, index, vote },
              });

            break;
          }
        },

        voteIterated: (id, status) => {
          for(const v of this.votes) if(v.id === id) {
            v.status = status;

            if(v === this.vote && !status.running)
              this.$broadcast('vote-rearrange');

            if(this.proj.mode === 'vote' && v === this.proj.target)
              this.sendToProjector({
                type: 'update',
                target: 'vote',
                data: { event: 'iterate', rearrange: !status.running, status },
              });

            break;
          }
        },

        /* Lists */
        listAdded: (id, name, seats) => {
          let timerTotal;
          let timerCurrent;

          for(const timer of this.timerWaitingList)
            if(timer.name === id)
              if(timer.type === 'list-total') timerTotal = timer;
              else if(timer.type === 'list-current') timerCurrent = timer;

          if(timerTotal) this.timerWaitingList.$remove(timerTotal);
          if(timerCurrent) this.timerWaitingList.$remove(timerCurrent);

          this.lists.unshift({
            id, name, seats, timerTotal, timerCurrent, ptr: 0, rev: 0,
          });
        },

        listUpdated: (id, seats, rev) => {
          for(const list of this.lists) if(list.id === id) {
            list.seats = seats;
            if(Number.isInteger(rev)) list.rev = rev;

            if(this.proj.mode === 'list' && this.proj.target === list)
              this.syncProjectorList();

            break;
          }
        },

        listIterated: (id, ptr) => {
          for(const list of this.lists) if(list.id === id) {
            list.ptr = ptr;

            if(this.proj.mode === 'list' && this.proj.target === list)
              this.syncProjectorList();

            break;
          }
        },

        /* Motions */

        motionAdded: (motion) => {
          this.motions.unshift(motion);
          // The list update and the draft removal land as one atomic paint
          this.syncProjectorMotions(true);
          this.syncProjExtra('draft', null);
        },

        motionUpdated: (id, outcome) => {
          for(const m of this.motions) if(m.id === id) {
            m.outcome = outcome;
            break;
          }
          this.syncProjectorMotions();
        },

        motionVisibility: (id, visible) => {
          for(const m of this.motions) if(m.id === id) {
            m.visible = visible;
            break;
          }
          this.syncProjectorMotions();
        },

        motionExecuted: (id, instance) => {
          for(const m of this.motions) if(m.id === id) {
            m.executed = true;
            if(instance) m.instance = instance;
            break;
          }
        },

        motionEdited: (motion) => {
          for(const m of this.motions) if(m.id === motion.id) {
            m.name = motion.name;
            m.proposer = motion.proposer;
            m.type = motion.type;
            m.params = motion.params;
            break;
          }
          this.syncProjectorMotions();
        },

        /* Renames */

        timerRenamed: (id, name) => {
          this.executeOnTimer(id, timer => {
            timer.name = name;
          });

          if(this.projOn && this.proj.mode === 'timer' && this.proj.target === id)
            this.sendToProjector({ type: 'update', target: 'timer', data: { name } });
        },

        listRenamed: (id, name) => {
          for(const list of this.lists) if(list.id === id) {
            list.name = name;

            if(this.proj.mode === 'list' && this.proj.target === list)
              this.syncProjectorList();
            break;
          }
        },

        voteRenamed: (id, name) => {
          for(const v of this.votes) if(v.id === id) {
            v.name = name;

            if(this.projOn && this.proj.mode === 'vote' && this.proj.target === v)
              this.sendToProjector({
                type: 'update',
                target: 'vote',
                data: { event: 'rename', name },
              });
            break;
          }
        },

        fileRenamed: (id, name) => {
          for(const f of this.files) if(f.id === id) {
            f.name = name;

            if(this.projOn && this.proj.mode === 'file' && this.proj.target === id)
              this.sendToProjector({ type: 'update', target: 'file', data: { name } });
            break;
          }
        },

        motionRenamed: (id, name, proposer) => {
          for(const m of this.motions) if(m.id === id) {
            m.name = name;
            m.proposer = proposer;
            break;
          }
          this.syncProjectorMotions();
        },

        /* Removals */

        timerRemoved: (id) => {
          this.timers = this.timers.filter(t => t.id !== id);
          this.timerWaitingList = this.timerWaitingList.filter(t => t.id !== id);

          if(this.proj.mode === 'timer' && this.proj.target === id)
            this.clearProjector();

          if(this.activeView === 'timerpage' && this.focusTimer && this.focusTimer.id === id) {
            this.focusTimer = null;
            this.navigate('timers');
          }
        },

        listRemoved: (id) => {
          let removed = null;
          for(const list of this.lists) if(list.id === id) {
            removed = list;
            break;
          }
          if(!removed) return;

          this.lists = this.lists.filter(l => l.id !== id);

          if(this.proj.mode === 'list' && this.proj.target === removed)
            this.clearProjector();

          if(this.activeView === 'list' && this.list === removed) {
            this.list = null;
            this.navigate('lists');
          }
        },

        voteRemoved: (id) => {
          let removed = null;
          for(const v of this.votes) if(v.id === id) {
            removed = v;
            break;
          }
          if(!removed) return;

          this.votes = this.votes.filter(v => v.id !== id);

          if(this.proj.mode === 'vote' && this.proj.target === removed)
            this.clearProjector();

          if(this.activeView === 'vote' && this.vote === removed) {
            this.vote = null;
            this.navigate('votes');
          }
        },

        fileRemoved: (id) => {
          this.files = this.files.filter(f => f.id !== id);
          this.fileCache[id] = null;

          if(this.proj.mode === 'file' && this.proj.target === id)
            this.clearProjector();

          if(this.activeView === 'file' && this.file && this.file.id === id) {
            this.file = null;
            this.navigate('files');
          }
        },

        motionRemoved: (id) => {
          this.motions = this.motions.filter(m => m.id !== id);
          this.syncProjectorMotions();
        },

        /* History, statistics & projector brand */

        historyAdded: (entry) => {
          this.history.unshift(entry);
        },

        historyUpdated: (id, data) => {
          for(const e of this.history) if(e.id === id) {
            e.data = data;
            break;
          }
        },

        spokenUpdated: (value) => {
          this.spokenTime = value;
        },

        delegateUpdated: (name, stats) => {
          const next = {};
          for(const key of Object.keys(this.delegates)) next[key] = this.delegates[key];
          next[name] = stats;
          this.delegates = next;
        },

        brandUpdated: (brand) => {
          this.brand = brand;
          this.sendBrand();
        },

        /* Notes */

        noteMeta: (key, text, updated) => {
          const next = {};
          for(const k of Object.keys(this.notesMeta)) next[k] = this.notesMeta[k];
          next[key] = { text, updated };
          this.notesMeta = next;
        },

        notesRemoved: (keys) => {
          const next = {};
          for(const k of Object.keys(this.notesMeta))
            if(keys.indexOf(k) === -1) next[k] = this.notesMeta[k];
          this.notesMeta = next;
        },

        /* Shared projection */

        projChanged: (mode, target, extras) => {
          if(!this.syncCast) return;
          this.applySharedProj(mode, target, extras || {});
        },

        projExtra: (key, value) => {
          if(!this.syncCast) return;
          this.applyProjExtra(key, value);
        },

        castHostChanged: (hostName) => {
          this.castHostName = hostName || null;
        },

        castHostLost: () => {
          this.iAmHost = false;
        },

        syncCastChanged: (enabled) => {
          this.syncCast = enabled !== false;
          if(!this.syncCast) {
            this.iAmHost = false;
            this.castHostName = null;
          }
        },

        confRenamed: (name) => {
          this.title = name;
          connectedConf = name;
          for(const c of this.confs) if(c.id === confId) {
            c.name = name;
            break;
          }
          this.sendConfName();
        },
      });
    },

    pickerBrowse() {
      this.pickerMode = 'browse';
      this.selectedConf = null;
      this.confSearch = '';
    },

    pickerMenu() {
      this.pickerMode = 'menu';
      this.selectedConf = null;
    },

    selectConfItem(conf) {
      this.selectedConf = conf;
    },

    startChairing() {
      if(!this.authorized || !this.selectedConf) return;
      this.readOnly = false;
      this.connectConf(this.selectedConf.id, this.selectedConf.name);
    },

    startReadOnly() {
      if(!this.selectedConf) return;
      this.readOnly = true;
      this.connectConf(this.selectedConf.id, this.selectedConf.name);
    },

    createConf() {
      this.confName = '';
      this.createConfFlag = true;
      setTimeout(() => this.$els.confNameInput.focus(), 0);
    },

    performConfCreation() {
      if(this.confName === '') return;
      globalConn.createConf(this.confName, (data) => {
        if(!data.ok) {
          console.error(data.error);
          alert(this.t('errCreate'));
        } else {
          this.confs.push({ id: data.id, name: data.name, lastAccess: Date.now() });
          this.createConfFlag = false;
        }
      });
    },

    discardConfCreation() {
      this.createConfFlag = false;
    },

    selectConf() {
      this.picker = true;
      this.frame = false;
    },

    navigate(dest, data) {
      if(dest !== this.activeView) this.pushView();
      this.activeView = dest;
      this.searchInput = '';
      if(data) if(data.search)
        this.searchInput = data.search;
    },

    /* Back navigation */

    pushView() {
      if(!this.frame) return;
      this.viewStack.push({
        view: this.activeView,
        list: this.list,
        vote: this.vote,
        file: this.file,
        focusTimer: this.focusTimer,
        delegateFocus: this.delegateFocus,
      });
      if(this.viewStack.length > 50) this.viewStack.shift();
    },

    back() {
      const s = this.viewStack.pop();
      if(!s) return;

      // Fall back to the index page when the remembered item no longer exists
      let view = s.view;
      if(view === 'list' && this.lists.indexOf(s.list) === -1) view = 'lists';
      else if(view === 'vote' && this.votes.indexOf(s.vote) === -1) view = 'votes';
      else if(view === 'file' && this.files.indexOf(s.file) === -1) view = 'files';
      else if(view === 'timerpage' && this.timers.indexOf(s.focusTimer) === -1) view = 'timers';

      this.list = s.list;
      this.vote = s.vote;
      this.file = s.file;
      this.focusTimer = s.focusTimer;
      this.delegateFocus = s.delegateFocus || null;
      this.activeView = view;
    },

    /* Seats */

    updateSeats(seats) {
      // Sync up, recalculate will be completed on pingback event
      confConn.updateSeats(seats, err => {
        if(err) {
          console.error(err);
          alert(this.t('errModify'));
        }
      });
    },

    recalcCount() {
      this.seatCount = this.seats.length;
      this.presentCount = this.seats.reduce((prev, e) => e.present ? prev + 1 : prev, 0);
    },

    sendSeatCount() {
      this.sendToProjector({
        type: 'update',
        target: 'seats',
        data: { seat: this.seatCount, present: this.presentCount },
      });
    },

    /* Timers */

    addTimer(name, sec) {
      confConn.addTimer(name, 'standalone', sec, (err /* , id */) => {
        if(err) {
          console.error(err);
          alert(this.t('errAdd'));
        }
      });
    },

    manipulateTimer(action, id) {
      confConn.manipulateTimer(action, id, (err) => {
        if(err) {
          console.error(err);
          alert(this.t('errOp'));
        }
      });
    },

    updateTimer(id, value) {
      confConn.updateTimer(id, value, (err) => {
        if(err) {
          console.error(err);
          alert(this.t('errModify'));
        }
      });
    },

    updateTimerLeft(id, left) {
      confConn.updateTimerLeft(id, left, (err) => {
        if(err) {
          console.error(err);
          alert(this.t('errModify'));
        }
      });
    },

    beginNonFileProjection(remote) {
      if(!remote) this.sharedProjectionRevision += 1;
      this.fileProjectionToken += 1;
      this.pendingSharedFile = null;
    },

    projectTimer(timer, remote) {
      this.beginNonFileProjection(remote);
      this.sendToProjector({ type: 'layer', target: 'timer', data: timer });
      this.proj.mode = 'timer';
      this.proj.target = timer.id;
      if(!remote) this.syncProjOut();
    },

    viewTimer(timer) {
      this.pushView();
      this.focusTimer = timer;
      this.activeView = 'timerpage';
    },

    executeOnTimer(id, cb) {
      for(const timer of this.timers)
        if(timer.id === id) {
          cb(timer);
          break;
        }
    },

    /* Files */

    addFile(name, type, content) {
      confConn.addFile(name, type, content, err => {
        if(err) {
          console.error(err);
          alert(this.t('errAdd'));
        }
      });
    },

    editFile(id, content) {
      confConn.editFile(id, content, err => {
        if(err) {
          console.error(err);
          alert(this.t('errUpdate'));
        }
      });
    },

    getFile(id, cb) {
      if(this.fileCache[id]) {
        cb(null, this.fileCache[id]);
        return;
      }
      confConn.getFile(id, (err, doc) => {
        if(err) return cb(err);

        this.fileCache[id] = doc;
        return cb(null, doc);
      });
    },

    viewFile(file) {
      this.pushView();
      file.highlight = false;

      this.file = file;
      this.fileViewId = file.id;
      this.fileViewZoom = 1;
      this.fileViewScrollRatio = 0;
      this.activeView = 'file';
    },

    fileScrolled(file, ratio) {
      if(this.activeView === 'file' && this.file && this.file.id === file.id) {
        if(this.fileViewId !== file.id) {
          this.fileViewId = file.id;
          this.fileViewZoom = 1;
          this.fileViewScrollRatio = 0;
        }
        this.fileViewScrollRatio = ratio;
      }
      if(this.proj.mode === 'file' && this.proj.target === file.id) {
        if(this.projOn)
          this.sendToProjector({ type: 'update', target: 'file', data: { scrollRatio: ratio } });
        this.syncProjExtra('scrollRatio', ratio);
      }
    },

    fileZoomed(file, zoom) {
      if(this.activeView === 'file' && this.file && this.file.id === file.id) {
        if(this.fileViewId !== file.id) {
          this.fileViewId = file.id;
          this.fileViewZoom = 1;
          this.fileViewScrollRatio = 0;
        }
        this.fileViewZoom = zoom;
      }
      if(this.proj.mode === 'file' && this.proj.target === file.id) {
        if(this.projOn)
          this.sendToProjector({ type: 'update', target: 'file', data: { zoom } });
        this.syncProjExtra('zoom', zoom);
      }
    },

    projectFile(file, remote, extras) {
      if(!remote) this.sharedProjectionRevision += 1;
      this.fileProjectionToken += 1;
      const requestToken = this.fileProjectionToken;
      const sourceState = extras || ((!remote && this.fileViewId === file.id) ? {
        zoom: this.fileViewZoom,
        scrollRatio: this.fileViewScrollRatio,
      } : { zoom: 1, scrollRatio: 0 });
      const initialState = {
        zoom: typeof sourceState.zoom === 'number' ? sourceState.zoom : 1,
        scrollRatio: typeof sourceState.scrollRatio === 'number'
          ? sourceState.scrollRatio : 0,
      };
      this.pendingSharedFile = remote ? {
        id: file.id,
        token: requestToken,
        state: initialState,
      } : null;
      if(!remote) {
        // Store the exact view snapshot before the asynchronous file fetch.
        // syncProjOut then publishes the id and viewport as one atomic target.
        this.fileViewId = file.id;
        this.fileViewZoom = typeof initialState.zoom === 'number'
          ? initialState.zoom : 1;
        this.fileViewScrollRatio = typeof initialState.scrollRatio === 'number'
          ? initialState.scrollRatio : 0;
      }
      this.getFile(file.id, (err, content) => {
        if(requestToken !== this.fileProjectionToken) return;
        if(remote && (!this.pendingSharedFile
          || this.pendingSharedFile.token !== requestToken)) return;
        if(err) {
          if(remote) this.pendingSharedFile = null;
          console.error(err);
          alert(this.t('errGetFile'));
          return;
        }

        this.proj.mode = 'file';
        this.proj.target = file.id;

        this.sendToProjector({
          type: 'layer',
          target: 'file',
          data: {
            meta: file,
            content: new Uint8Array(content),
            zoom: initialState && initialState.zoom,
            scrollRatio: initialState && initialState.scrollRatio,
          },
        });
        if(remote) this.pendingSharedFile = null;
        if(!remote) this.syncProjOut();
      });
    },

    /* Vote */
    addVote(name, target, rounds, seats) {
      confConn.addVote(name, target, rounds, seats, (err /* , id */) => {
        if(err) {
          console.error(err);
          alert(this.t('errAdd'));
        }
      });
    },

    viewVote(vote) {
      this.pushView();
      /*
       * votes array is never replaced entirely
       * So it's save to keep a reference of a specific vote
       */

      this.vote = vote;
      this.activeView = 'vote';
    },

    updateVote(id, index, vote, cb) {
      confConn.updateVote(id, index, vote, (err /* , id */) => {
        if(err) {
          console.error(err);
          alert(this.t('errUpdate'));
        }
        if(cb) cb(err || null);
      });
    },

    iterateVote(id, status) {
      confConn.iterateVote(id, status, (err /* , id */) => {
        if(err) {
          console.error(err);
          alert(this.t('errUpdate'));
        }
      });
    },

    projectVote(vote, remote) {
      this.beginNonFileProjection(remote);
      this.proj.mode = 'vote';
      this.proj.target = vote;
      this.sendToProjector({ type: 'layer', target: 'vote', data: { vote } });
      if(!remote) this.syncProjOut();
    },

    /* Lists */
    addList(name, seats, totTime, eachTime) {
      new Promise((resolve, reject) => confConn.addList(name, seats, (err, id) => err ? reject(err) : resolve(id)))
        .then(id => Promise.all([
          new Promise((resolve, reject) => totTime === 0 ? resolve() : confConn.addTimer(id, 'list-total', totTime, err => err ? reject(err) : resolve())),
          new Promise((resolve, reject) => confConn.addTimer(id, 'list-current', eachTime, err => err ? reject(err) : resolve())),
        ])).catch(e => {
          console.error(e);
          alert(this.t('errAdd'));
        });
    },

    startList(list) {
      this.manipulateTimer('start', list.timerCurrent.id);
    },

    stopList(list) {
      this.manipulateTimer('stop', list.timerCurrent.id);
    },

    iterateList(list, ptr) {
      Promise.all([
        new Promise((resolve, reject) => confConn.manipulateTimer('reset', list.timerCurrent.id, err => err ? reject(err) : resolve())),
        new Promise((resolve, reject) => confConn.iterateList(list.id, ptr, err => err ? reject(err) : resolve())),
      ]).catch(e => {
        console.error(e);
        alert(this.t('errUpdate'));
      });
    },

    updateList(list, seats) {
      const rev = Number.isInteger(list.rev) ? list.rev : 0;
      confConn.updateList(list.id, seats, rev, err => {
        if(err) {
          console.error(err);
          alert(this.t('errUpdate'));
        }
      });
    },

    updateListTotal(list, time) {
      try {
        this.updateTimer(list.timerTotal.id, time);
      } catch(e) {}
    },

    updateListCurrent(list, time, left) {
      confConn.updateTimer(list.timerCurrent.id, time, (err) => {
        if(err) {
          console.error(err);
          alert(this.t('errModify'));
          return;
        }

        if(left === null || left === undefined) return;
        confConn.updateTimerLeft(list.timerCurrent.id, left, (err) => {
          if(err) {
            console.error(err);
            alert(this.t('errModify'));
          }
        });
      });
    },

    updateListCurrentLeft(list, left) {
      this.updateTimerLeft(list.timerCurrent.id, left);
    },

    /** Applies a duration-dialog submission in a deterministic order.
     * Socket callbacks for timer updates share an event name, so overlapping
     * current and total writes can acknowledge one another. Keeping the
     * operations serial also guarantees remaining time sees the new limit.
     */
    updateListTimers(list, currentValue, currentLeft, totalValue) {
      const steps = [];
      if(currentValue !== null)
        steps.push(cb => confConn.updateTimer(list.timerCurrent.id, currentValue, cb));
      if(currentLeft !== null)
        steps.push(cb => confConn.updateTimerLeft(list.timerCurrent.id, currentLeft, cb));
      if(totalValue !== null && list.timerTotal)
        steps.push(cb => confConn.updateTimer(list.timerTotal.id, totalValue, cb));

      const next = (index) => {
        if(index >= steps.length) return;
        steps[index]((err) => {
          if(err) {
            console.error(err);
            alert(this.t('errModify'));
            return;
          }
          next(index + 1);
        });
      };
      next(0);
    },

    /**
     * Reverses one accidental next/prev on a speakers list: pointer,
     * remaining speech time and running state are all restored.
     */
    undoListStep(list, snap) {
      const cur = list.timerCurrent;
      if(!cur || !confConn) return;

      const call = (fn, ...args) => new Promise((resolve, reject) =>
        confConn[fn](...args, (err) => err ? reject(err) : resolve()));

      call('manipulateTimer', 'reset', cur.id)
        .then(() => call('iterateList', list.id, snap.ptr))
        .then(() => (snap.left === null ? null : call('updateTimerLeft', cur.id, snap.left)))
        .then(() => ((snap.active && snap.left > 0)
          ? call('manipulateTimer', 'start', cur.id) : null))
        .catch((e) => {
          console.error(e);
          alert(this.t('errUpdate'));
        });
    },

    viewList(list) {
      this.pushView();
      this.list = list;
      this.activeView = 'list';
    },

    viewDelegate(name) {
      this.pushView();
      this.delegateFocus = name;
      this.activeView = 'delegate';
    },

    /** Opens (or focuses) the pinned mini-window for one note */
    openNote(key, title) {
      if(!this.authorized || this.readOnly || !confConn) return;
      ipcRenderer.send('openNote', {
        key,
        title,
        url: serverConfig.connectUrl || serverConfig.url,
        conf: this.currentConfId,
        token: serverConfig.token || '',
      });
    },

    projectList(list, remote) {
      this.beginNonFileProjection(remote);
      this.proj.mode = 'list';
      this.proj.target = list;
      this.sendToProjector({ type: 'layer', target: 'list', data: { list: this.proj.target } });
      if(!remote) this.syncProjOut();
    },

    /**
     * Because lists are just too complicated,
     * We are doing global syncing on list object
     */
    syncProjectorList() {
      if(this.pendingListSync !== null) return;

      if(this.projOn && this.proj.mode === 'list')
        this.pendingListSync = setTimeout(() => {
          this.pendingListSync = null;
          this.sendToProjector({
            type: 'update',
            target: 'list',
            data: { list: this.proj.target },
          });
        }, 10);
    },

    /* Motions */

    addMotion(name, proposer, type, params) {
      confConn.addMotion(name, proposer, type, params, (err /* , id */) => {
        if(err) {
          console.error(err);
          alert(this.t('errAdd'));
        }
      });
    },

    updateMotion(id, outcome) {
      confConn.updateMotion(id, outcome, (err) => {
        if(err) {
          console.error(err);
          alert(this.t('errUpdate'));
        }
      });
    },

    editMotion2(id, name, proposer, type, params) {
      confConn.editMotion(id, name, proposer, type, params, (err) => {
        if(err) {
          console.error(err);
          alert(this.t('errUpdate'));
        }
      });
    },

    toggleMotionVisible(motion) {
      confConn.setMotionVisible(motion.id, motion.visible === false, (err) => {
        if(err) {
          console.error(err);
          alert(this.t('errSet'));
        }
      });
    },

    visibleMotions() {
      let out = this.motions.filter(m => m.visible !== false);
      // The cast mirrors the controller's filter and ordering. The pending
      // filter is a snapshot: rows never drop out as outcomes get recorded
      if(this.motionsFilter === 'pending')
        out = out.filter(m => this.motionsFilterHidden.indexOf(m.id) === -1);
      if(this.motionsSort === 'disruptive')
        out = out.slice().sort(motionTypes.compareDisruptive);
      return out;
    },

    motionProjectionState(motions) {
      const rows = motions || this.visibleMotions();
      return {
        motionIds: rows.map(m => m.id),
        scrollRatio: this.motionScrollRatio,
      };
    },

    applyMotionProjectionState(state) {
      if(!state || !Array.isArray(state.motionIds)) {
        this.projectedMotionIds = null;
        return;
      }

      this.projectedMotionIds = state.motionIds.slice();
      if(typeof state.scrollRatio === 'number')
        this.motionScrollRatio = Math.max(0, Math.min(1, state.scrollRatio));
    },

    projectedMotions() {
      if(!Array.isArray(this.projectedMotionIds)) return this.visibleMotions();

      const byId = {};
      for(const motion of this.motions) byId[motion.id] = motion;
      return this.projectedMotionIds.map(id => byId[id]).filter(Boolean);
    },

    setMotionsOpts(sort, filter) {
      // Activating the pending filter snapshots what is hidden right now;
      // outcome changes afterwards never re-filter the visible rows
      if(filter === 'pending' && this.motionsFilter !== 'pending')
        this.motionsFilterHidden = this.motions
          .filter(m => m.outcome !== 'pending')
          .map(m => m.id);
      this.motionsSort = sort;
      this.motionsFilter = filter;
      this.syncProjectorMotions();
    },

    projectMotions(remote, sharedState) {
      this.beginNonFileProjection(remote);
      this.proj.mode = 'motions';
      this.proj.target = null;

      let motions;
      if(remote && sharedState && Array.isArray(sharedState.motionIds)) {
        this.applyMotionProjectionState(sharedState);
        motions = this.projectedMotions();
      } else {
        motions = this.visibleMotions();
        this.projectedMotionIds = motions.map(m => m.id);
        if(!remote) this.motionScrollRatio = this.motionControllerScrollRatio;
      }

      this.sendToProjector({
        type: 'layer',
        target: 'motions',
        data: { motions, scrollRatio: this.motionScrollRatio },
      });
      if(!remote) this.syncProjOut();
    },

    syncProjectorMotions(clearDraft) {
      if(clearDraft) this._motionSyncClearsDraft = true;
      if(this.pendingMotionSync !== null) return;

      if(this.projOn && this.proj.mode === 'motions')
        this.pendingMotionSync = setTimeout(() => {
          this.pendingMotionSync = null;
          let motions;
          if(this.syncCast && !this.iAmHost && Array.isArray(this.projectedMotionIds))
            motions = this.projectedMotions();
          else {
            motions = this.visibleMotions();
            this.projectedMotionIds = motions.map(m => m.id);
          }

          const data = { motions, scrollRatio: this.motionScrollRatio };
          if(this._motionSyncClearsDraft) {
            data.draft = null;
            this._motionSyncClearsDraft = false;
          }
          this.sendToProjector({
            type: 'update',
            target: 'motions',
            data,
          });

          if(this.syncCast && this.iAmHost)
            this.syncProjExtra('motionsState', this.motionProjectionState(motions));
        }, 10);
    },

    motionScrolled(ratio) {
      this.motionControllerScrollRatio = Math.max(0, Math.min(1, ratio || 0));
      // A follower's own controller scroll must never move its synced cast.
      if(this.syncCast && !this.iAmHost) return;
      this.motionScrollRatio = this.motionControllerScrollRatio;
      if(!this.projOn || this.proj.mode !== 'motions') return;

      this.sendToProjector({
        type: 'update',
        target: 'motions',
        data: { scrollRatio: this.motionScrollRatio },
      });
      this.syncProjExtra('motionScrollRatio', this.motionScrollRatio);
    },

    syncMotionDraft(draft) {
      if(this.projOn && this.proj.mode === 'motions')
        this.sendToProjector({ type: 'update', target: 'motions', data: { draft } });
      this.syncProjExtra('draft', draft);
    },

    /* Motion execution */

    executeMotion(motion, force) {
      if(!confConn || motion.outcome !== 'passed') return;

      const action = motionTypes.get(motion.type).action;
      const p = motion.params || {};

      if(motion.executed && !force) {
        // The action button links to the instance this motion created:
        // jump to it while it lives, recreate it if it was deleted
        if(this.jumpToInstance(motion)) return;
        if(!action) return;
      }

      const markDone = (instance) => confConn.executeMotion(motion.id, instance || null, (err) => {
        if(err) console.error(err);
      });

      const fail = (e) => {
        console.error(e);
        alert(this.t('errExecute'));
      };

      const newUid = () => crypto.randomBytes(16).toString('hex');

      const goToList = (id, cb) => {
        const attempt = (n) => {
          let list = null;
          for(const l of this.lists) if(l.id === id) {
            list = l;
            break;
          }
          if(list) {
            this.viewList(list);
            if(cb) cb(list);
          } else if(n < 20) setTimeout(() => attempt(n + 1), 100);
        };
        attempt(0);
      };

      const goToVote = (id) => {
        const attempt = (n) => {
          let vote = null;
          for(const v of this.votes) if(v.id === id) {
            vote = v;
            break;
          }
          if(vote) this.viewVote(vote);
          else if(n < 20) setTimeout(() => attempt(n + 1), 100);
        };
        attempt(0);
      };

      const createList = (name, seats, totTime, eachTime, cb) => {
        new Promise((resolve, reject) =>
          confConn.addList(name, seats, (err, id) => err ? reject(err) : resolve(id)))
          .then(id => Promise.all([
            new Promise((resolve, reject) => totTime === 0 ? resolve()
              : confConn.addTimer(id, 'list-total', totTime,
                err => err ? reject(err) : resolve())),
            new Promise((resolve, reject) =>
              confConn.addTimer(id, 'list-current', eachTime,
                err => err ? reject(err) : resolve())),
          ]).then(() => id))
          .then((id) => {
            markDone({ kind: 'list', id });
            goToList(id, cb);
          })
          .catch(fail);
      };

      const goToTimer = (id) => {
        const attempt = (n) => {
          let timer = null;
          for(const t of this.timers) if(t.id === id) {
            timer = t;
            break;
          }
          if(timer) this.viewTimer(timer);
          else if(n < 20) setTimeout(() => attempt(n + 1), 100);
        };
        attempt(0);
      };

      const createTimer = (name, value) => {
        confConn.addTimer(name, 'standalone', value, (err, id) => {
          if(err) return void fail(err);
          markDone({ kind: 'timer', id });
          goToTimer(id);
          return undefined;
        });
      };

      const createVote = (name, target) => {
        const present = this.seats.filter(e => e.present).map(e => e.name);
        confConn.addVote(name, target, 1, present, (err, id) => {
          if(err) return void fail(err);
          markDone({ kind: 'vote', id });
          goToVote(id);
          return undefined;
        });
      };

      if(action === 'list')
        createList(motion.name, [], p.totTime || 0, p.eachTime || 60, (list) => {
          this.proposerDialog = { listId: list.id, proposer: motion.proposer };
        });
      else if(action === 'tour') {
        const seats = this.seats.filter(e => e.present)
          .map(e => ({ name: e.name, uid: newUid() }));
        const each = p.eachTime || 60;
        createList(motion.name, seats, each * seats.length, each, null);
      } else if(action === 'timer')
        createTimer(motion.name, p.totTime || 300);
      else if(action === 'prolong') {
        // Duplicate the action of the caucus recorded at creation time,
        // falling back to the latest executed caucus
        let baseType = p.baseType;
        let baseName = p.baseName;
        if(!baseType)
          for(const m of this.motions)
            if(m.executed && m.id !== motion.id
               && ['mod', 'unmod', 'cow', 'tour'].indexOf(m.type) !== -1) {
              baseType = m.type;
              baseName = m.name;
              break;
            }

        if(!baseType) return void alert(this.t('errNoProlong'));

        const name = motion.name || `${this.t('prolongNamePrefix')}${baseName}`;
        if(baseType === 'mod')
          createList(name, [], p.totTime || 0, p.eachTime || 60, null);
        else if(baseType === 'tour') {
          const seats = this.seats.filter(e => e.present)
            .map(e => ({ name: e.name, uid: newUid() }));
          const each = p.eachTime || 60;
          createList(name, seats, each * seats.length, each, null);
        } else createTimer(name, p.totTime || 300);
      } else if(action === 'file') {
        const wanted = p.fileIds && p.fileIds.length ? p.fileIds : [p.fileId];
        let file = null;
        for(const f of this.files) if(wanted.indexOf(f.id) !== -1) {
          file = f;
          break;
        }
        if(!file) return void alert(this.t('errNoBaseFile'));
        markDone({ kind: 'file', id: file.id });
        this.viewFile(file);
      } else if(action === 'pvote')
        createVote(motion.name, this.simpleHalfCount);
      else if(action === 'svote')
        createVote(motion.name, -1);
      else markDone(null);

      return undefined;
    },

    jumpToInstance(motion) {
      const inst = motion.instance;
      if(!inst) return false;

      if(inst.kind === 'list') {
        for(const l of this.lists) if(l.id === inst.id) {
          this.viewList(l);
          return true;
        }
      } else if(inst.kind === 'timer') {
        for(const t of this.timers) if(t.id === inst.id) {
          this.viewTimer(t);
          return true;
        }
      } else if(inst.kind === 'vote') {
        for(const v of this.votes) if(v.id === inst.id) {
          this.viewVote(v);
          return true;
        }
      } else if(inst.kind === 'file') {
        for(const f of this.files) if(f.id === inst.id) {
          this.viewFile(f);
          return true;
        }
      }

      return false;
    },

    resolveProposer(choice) {
      const d = this.proposerDialog;
      this.proposerDialog = null;
      if(!d || choice === 'skip') return;

      let list = null;
      for(const l of this.lists) if(l.id === d.listId) {
        list = l;
        break;
      }
      if(!list) return;

      const seat = { name: d.proposer, uid: crypto.randomBytes(16).toString('hex') };
      let seats;
      if(choice === 'first') seats = [seat].concat(list.seats);
      else {
        seats = list.seats.concat([seat]);
        const pinned = {};
        for(const key of Object.keys(this.pinnedLast)) pinned[key] = this.pinnedLast[key];
        pinned[d.listId] = d.proposer;
        this.pinnedLast = pinned;
      }

      this.updateList(list, seats);
    },

    projectRollcall(remote) {
      this.beginNonFileProjection(remote);
      this.proj.mode = 'rollcall';
      this.proj.target = null;
      this.sendToProjector({ type: 'layer', target: 'rollcall', data: { seats: this.seats } });
      if(!remote) this.syncProjOut();
    },

    /* Renames & removals */

    renameItem(type, id, name, proposer) {
      const cb = (err) => {
        if(err) {
          console.error(err);
          alert(this.t('errRename'));
        }
      };

      if(type === 'motion') confConn.renameMotion(id, name, proposer, cb);
      else if(type === 'timer') confConn.renameTimer(id, name, cb);
      else if(type === 'list') confConn.renameList(id, name, cb);
      else if(type === 'vote') confConn.renameVote(id, name, cb);
      else if(type === 'file') confConn.renameFile(id, name, cb);
    },

    removeItem(type, id) {
      const cb = (err) => {
        if(err) {
          console.error(err);
          alert(this.t('errDelete'));
        }
      };

      if(type === 'motion') confConn.removeMotion(id, cb);
      else if(type === 'timer') confConn.removeTimer(id, cb);
      else if(type === 'list') confConn.removeList(id, cb);
      else if(type === 'vote') confConn.removeVote(id, cb);
      else if(type === 'file') confConn.removeFile(id, cb);
    },

    renameConf(name) {
      confConn.renameConf(name, (err) => {
        if(err) {
          console.error(err);
          alert(this.t('errRename'));
        }
      });
    },

    /* Language & reminder settings */

    setLang(lang) {
      i18n.setLang(lang);
      this.lang = i18n.store.lang;
      this.sendSettings();
    },

    setReminder(enabled, single, rules) {
      reminder.set(enabled, single, rules);
      this.sendSettings();
    },

    setCastFallback(mode) {
      this.castFallback = mode === 'keep' ? 'keep' : 'base';
      try {
        window.localStorage.setItem('cln-cast-fallback', this.castFallback);
      } catch(e) { }
    },

    setRoutePref(pref) {
      this.routePref = pref === 'relay' ? 'relay' : 'lan';
      try {
        window.localStorage.setItem('cln-route-pref', this.routePref);
      } catch(e) { }
    },

    setRelayUrl(url) {
      this.relayUrl = (url || '').trim() || DEFAULT_RELAY;
      try {
        window.localStorage.setItem('cln-relay-url', this.relayUrl);
      } catch(e) { }
      // The host agent (if any) re-registers at the new relay
      ipcRenderer.send('setRelayConfig', { url: this.relayUrl });
      // Whatever we knew about the old relay says nothing about this one
      this.relayProbeOk = false;
      this.manualRelayCheck();
    },

    switchCommittee() {
      this.frame = false;
      this.picker = true;
      this.pickerMode = 'browse';
      this.selectedConf = null;
      this.confSearch = '';
      this._saveResume();
    },

    resetServerKeys() {
      if(!confirm(this.t('resetKeysConfirm'))) return;

      ipcRenderer.once('resetKeysCallback', (event, data) => {
        if(data.error) {
          console.error(data.error);
          return void alert(this.t('errOp'));
        }

        serverConfig.passkey = data.passkey;
        serverConfig.readerkey = data.readerkey;
        serverConfig.token = null;
        this.backendCode = data.code || this.backendCode;
        this.backendReaderCode = data.readerCode || this.backendReaderCode;

        // Reconnect ourselves with the fresh keys
        this._createGlobalConn();
        if(this.currentConfId && this.frame)
          this.connectConf(this.currentConfId, this.title);

        return undefined;
      });

      ipcRenderer.send('resetServerKeys');
    },

    disconnectServer() {
      // Full reset back to the launch page - nothing to resume afterwards
      this._clearResume();
      window.location.reload();
    },

    sendSettings() {
      this.sendToProjector({
        type: 'update',
        target: 'settings',
        data: {
          lang: i18n.store.lang,
          reminder: {
            enabled: reminder.store.enabled,
            single: reminder.store.single,
            rules: reminder.store.rules,
          },
        },
      });
    },

    /* Projector brand */

    setBrand(brand) {
      confConn.setBrand(brand, (err) => {
        if(err) {
          console.error(err);
          alert(this.t('errSet'));
        }
      });
    },

    sendBrand() {
      this.sendToProjector({ type: 'update', target: 'brand', data: { brand: this.brand } });
    },

    /* Utitlities */

    checkKeyHold(e) {
      if(e.key === 'Alt') this.altHold = true;
      else if(e.key === '`') this.backquoteHold = true;
      this.globalHotkey(e);
    },

    /**
     * Keyboard control: Esc closes the open modal, Cmd/Ctrl+Enter submits it
     * (or opens the add-delegate input on a speakers list), Space/Enter fires
     * the page's primary fab, and A/S/D or arrows drive a speakers list.
     * Never interferes with active typing.
     */
    globalHotkey(e) {
      const el = e.target;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
        || el.isContentEditable);
      const cmd = e.metaKey || e.ctrlKey;

      if(e.key === 'Escape') {
        if(this.createConfFlag) this.createConfFlag = false;
        else if(this.proposerDialog) this.proposerDialog = null;
        else this.$broadcast('modal-esc');
        return;
      }

      if(cmd && e.key === 'Enter') {
        e.preventDefault();
        if(this.createConfFlag) this.performConfCreation();
        else this.$broadcast('modal-submit');
        return;
      }

      if(!this.frame || typing || cmd || e.altKey) return;

      if(e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.$broadcast('fab-primary', e.key);
        return;
      }

      if(this.activeView === 'list') {
        let k = e.key.toLowerCase();
        if(e.key === 'ArrowLeft') k = 'a';
        else if(e.key === 'ArrowDown') k = 's';
        else if(e.key === 'ArrowRight') k = 'd';

        if(k === 'a') this.$broadcast('list-prev');
        else if(k === 's') this.$broadcast('list-pause');
        else if(k === 'd') this.$broadcast('list-playnext');
      }
    },

    checkKeyRelease(e) {
      if(e.key === 'Alt') this.altHold = false;
      else if(e.key === '`') this.backquoteHold = false;
    },

    requestShowServer() {
      if(globalConn) this.showServerFlag = true;
    },

    /**
     * The rightmost cast switch controls whether projection is on for THIS
     * device: click opens or closes the cast window; right-click opens it
     * as a normal window on the current display instead of full-screen.
     */
    castSwitchClick(e) {
      if(e && (e.ctrlKey || e.metaKey)) return void this.castSwitchAlt();

      if(!this.projOn) ipcRenderer.send('openProjector');
      else ipcRenderer.send('closeProjector');

      return undefined;
    },

    castSwitchAlt() {
      if(!this.projOn) ipcRenderer.send('openProjector', { windowed: true });
    },

    claimHost(force) {
      this.claimPending = true;
      confConn.projClaimHost(os.hostname(), !!force, (data) => {
        this.claimPending = false;
        if(!data.ok && data.error === 'Taken') {
          const who = data.hostName || '?';
          if(confirm(`${who} ${this.t('castTakeoverConfirm')}`)) this.claimHost(true);
          return;
        }
        if(!data.ok) return;

        this.iAmHost = true;
        this.castCurrentPage();
      });
    },

    followCast() {
      if(this._followPending) return;
      this._followPending = true;
      this.$nextTick(() => {
        this._followPending = false;
        if(!this.iAmHost || !this.syncCast) return;
        if(this.castTarget) this.castCurrentPage();
        // Non-castable page: fall back to the base page, or keep the last cast
        else if(this.castFallback === 'base' && this.proj.mode !== 'none')
          this.clearProjector();
      });
    },

    castCurrentPage() {
      const t = this.castTarget;
      if(!t) return;
      if(t.mode === 'rollcall') this.projectRollcall();
      else if(t.mode === 'motions') this.projectMotions();
      else if(t.mode === 'list') this.projectList(this.list);
      else if(t.mode === 'timer') this.projectTimer(this.focusTimer);
      else if(t.mode === 'file') {
        const view = this.$refs.active;
        const state = view && typeof view.projectionState === 'function'
          ? view.projectionState() : null;
        this.projectFile(this.file, false, state);
      } else if(t.mode === 'vote') this.projectVote(this.vote);
    },

    /**
     * The page-cast button governs the concurrent cast's CONTENT.
     * Synced: click toggles hosting - while hosting, the cast follows this
     * device's pages; turning it off leaves the cast on the previous page.
     * Sync off: legacy behavior, casts/uncasts the current page.
     * Ctrl-/right-click always jumps to the page currently being cast.
     */
    pageCastClick(e) {
      if(e && (e.ctrlKey || e.metaKey)) return void this.jumpToCasting();

      if(this.syncCast && confConn && this.frame) {
        if(!this.authorized || this.readOnly) return undefined;
        if(this.iAmHost) {
          confConn.projReleaseHost();
          // Optimistic: no intermediate icon state while the broadcast is in flight
          this.iAmHost = false;
          this.castHostName = null;
        } else this.claimHost(false);
        return undefined;
      }

      const state = this.castState;

      if(state === 'disabled') return undefined;
      if(state === 'this') return void this.clearProjector();

      if(state === 'idle') this.castCurrentPage();

      return undefined;
    },

    jumpToCasting() {
      const mode = this.proj.mode;
      const target = this.proj.target;

      if(mode === 'rollcall') this.navigate('seats');
      else if(mode === 'motions') this.navigate('motions');
      else if(mode === 'list' && target) this.viewList(target);
      else if(mode === 'vote' && target) this.viewVote(target);
      else if(mode === 'timer') {
        let timer = null;
        for(const t of this.timers) if(t.id === target) {
          timer = t;
          break;
        }
        if(timer) this.viewTimer(timer);
      } else if(mode === 'file') {
        let file = null;
        for(const f of this.files) if(f.id === target) {
          file = f;
          break;
        }
        if(file) this.viewFile(file);
      }
    },

    clearProjector(remote) {
      this.beginNonFileProjection(remote);
      this.proj.mode = 'none';
      this.proj.target = null;
      this.sendToProjector({ type: 'layer', target: null });
      if(!remote) this.syncProjOut();
    },

    sendConfName() {
      this.sendToProjector({ type: 'update', target: 'title', data: { conf: connectedConf } });
    },

    /* Shared projection sync */

    syncProjOut() {
      if(this.applyingProj || !this.syncCast || !confConn) return;
      if(!this.authorized || this.readOnly) return;
      const mode = this.proj.mode;
      let target = this.proj.target;
      if(mode === 'list' || mode === 'vote') target = target ? target.id : null;
      else if(mode === 'motions') target = this.motionProjectionState(this.projectedMotions());
      else if(mode === 'file') {
        const id = target;
        target = {
          id,
          zoom: this.fileViewId === id ? this.fileViewZoom : 1,
          scrollRatio: this.fileViewId === id ? this.fileViewScrollRatio : 0,
        };
      }
      confConn.projSet(mode || 'none', target);
    },

    syncProjExtra(key, value) {
      if(this.applyingProj || !this.syncCast || !confConn) return;
      if(!this.authorized || this.readOnly) return;
      confConn.projExtra(key, value);
    },

    /**
     * Mirror a remotely-controlled projection: reproject from this machine's
     * own replicated data, so the cast is correct on every device.
     */
    applySharedProj(mode, target, extras, attempt, revision) {
      const n = attempt || 0;
      let rev = revision;
      let freshRequest = false;
      if(typeof rev !== 'number') {
        this.sharedProjectionRevision += 1;
        rev = this.sharedProjectionRevision;
        freshRequest = true;
      } else if(rev !== this.sharedProjectionRevision) return;
      if(freshRequest) {
        this.fileProjectionToken += 1;
        this.pendingSharedFile = null;
      }
      let extrasIncludedInFileLayer = false;
      // Data may lag the projection pointer (e.g. a just-created list)
      const retry = () => {
        if(n < 20) setTimeout(() => {
          this.applySharedProj(mode, target, extras, n + 1, rev);
        }, 100);
      };

      this.applyingProj = true;
      try {
        if(!mode || mode === 'none') this.clearProjector(true);
        else if(mode === 'rollcall') this.projectRollcall(true);
        else if(mode === 'motions') this.projectMotions(true, target);
        else if(mode === 'list') {
          const l = this.lists.filter(x => x.id === target)[0];
          if(!l) return void retry();
          this.projectList(l, true);
        } else if(mode === 'timer') {
          const t = this.timers.filter(x => x.id === target)[0];
          if(!t) return void retry();
          this.projectTimer(t, true);
        } else if(mode === 'vote') {
          const v = this.votes.filter(x => x.id === target)[0];
          if(!v) return void retry();
          this.projectVote(v, true);
        } else if(mode === 'file') {
          // Newer hosts include the initial viewport in the projection target
          // so it arrives atomically with the file id. String targets remain
          // supported for sessions created by older clients.
          const fileTarget = target && typeof target === 'object'
            ? target : { id: target };
          const f = this.files.filter(x => x.id === fileTarget.id)[0];
          const fileState = Object.assign({
            zoom: typeof fileTarget.zoom === 'number' ? fileTarget.zoom : 1,
            scrollRatio: typeof fileTarget.scrollRatio === 'number'
              ? fileTarget.scrollRatio : 0,
          }, extras || {});
          if(this.pendingSharedFile && this.pendingSharedFile.id === fileTarget.id)
            Object.assign(fileState, this.pendingSharedFile.state);
          if(!f) {
            this.pendingSharedFile = {
              id: fileTarget.id,
              token: this.fileProjectionToken,
              state: fileState,
            };
            return void retry();
          }
          // File contents may still be loading on a reader. Carry initial
          // zoom and scroll inside the layer so the projector applies them
          // after its transition and PDF render have completed.
          extrasIncludedInFileLayer = true;
          this.projectFile(f, true, fileState);
        }
      } finally {
        this.applyingProj = false;
      }

      if(!extrasIncludedInFileLayer && extras)
        for(const key of Object.keys(extras)) this.applyProjExtra(key, extras[key]);
      return undefined;
    },

    applyProjExtra(key, value) {
      if(this.pendingSharedFile && (key === 'scrollRatio' || key === 'zoom')) {
        this.pendingSharedFile.state[key] = value;
        return;
      }
      if(!this.projOn) return;
      if(key === 'draft' && this.proj.mode === 'motions')
        this.sendToProjector({ type: 'update', target: 'motions', data: { draft: value } });
      else if(key === 'motionsState' && this.proj.mode === 'motions') {
        this.applyMotionProjectionState(value);
        this.sendToProjector({
          type: 'update',
          target: 'motions',
          data: {
            motions: this.projectedMotions(),
            scrollRatio: this.motionScrollRatio,
          },
        });
      } else if(key === 'motionScrollRatio' && this.proj.mode === 'motions') {
        this.motionScrollRatio = Math.max(0, Math.min(1, value || 0));
        this.sendToProjector({
          type: 'update',
          target: 'motions',
          data: { scrollRatio: this.motionScrollRatio },
        });
      } else if(key === 'scrollRatio' && this.proj.mode === 'file')
        this.sendToProjector({ type: 'update', target: 'file', data: { scrollRatio: value } });
      else if(key === 'zoom' && this.proj.mode === 'file')
        this.sendToProjector({ type: 'update', target: 'file', data: { zoom: value } });
    },

    pullSharedProj() {
      if(!confConn) return;
      confConn.projSync(({ proj }) => {
        if(!proj) return;
        this.syncCast = proj.enabled !== false;
        this.castHostName = proj.hostName || null;
        if(this.syncCast && proj.mode && proj.mode !== 'none')
          this.applySharedProj(proj.mode, proj.target, proj.extras);
      });
    },

    reapplyLocalProjection() {
      const mode = this.proj.mode;
      if(!mode || mode === 'none') return;
      let target = this.proj.target;
      if(mode === 'list' || mode === 'vote') target = target ? target.id : null;
      else if(mode === 'file') target = {
        id: target,
        zoom: this.fileViewId === target ? this.fileViewZoom : 1,
        scrollRatio: this.fileViewId === target ? this.fileViewScrollRatio : 0,
      };
      this.applySharedProj(mode, target, {});
    },

    setSyncCast(enabled) {
      confConn.setSyncCast(enabled, (err) => {
        if(err) {
          console.error(err);
          alert(this.t('errSet'));
          return;
        }
        // Seed the shared state with whatever this device is casting
        if(enabled) this.syncProjOut();
      });
    },

    setupProjector() {
      if(confConn) {
        this.sendToProjector({ type: 'update', target: 'status', data: { connected: true } });
        this.sendConfName();
        this.sendSeatCount();
        this.sendBrand();
        this.sendSettings();
        // A projector opened mid-session immediately shows the current cast
        if(this.syncCast) this.pullSharedProj();
        else this.reapplyLocalProjection();
      } else {
        this.sendToProjector({ type: 'reset' });
        this.sendSettings();
      }
    },

    sendToProjector(data) {
      ipcRenderer.send('toProjector', data);
      this.initData = data;
    },
  },

  events: {
    'net-check': function netCheck() {
      this.manualNetCheck();
    },
    'check-network': function checkNetwork() {
      this.manualNetCheck();
      this.manualRelayCheck();
    },
    'check-lan': function checkLan() {
      this.manualNetCheck();
    },
    'check-relay': function checkRelayEvt() {
      this.manualRelayCheck();
    },
    'set-route-pref': function setRoutePrefEvt(pref) {
      this.setRoutePref(pref);
    },
    'set-relay-url': function setRelayUrlEvt(url) {
      this.setRelayUrl(url);
    },
  },

  watch: {
    // Losing the host registration drops us back to probing, and the
    // answer matters straight away - that agent was the only evidence
    // the relay worked
    relayHostStatus(status) {
      if(status !== 'connected') {
        this._relayBackoff = 0;
        this.checkRelay();
      }
    },

    // The concurrent-cast host follows page navigation onto castable pages;
    // non-castable pages leave the projection unchanged
    activeView() { this.followCast(); },
    list() { this.followCast(); },
    vote() { this.followCast(); },
    file() { this.followCast(); },
    focusTimer() { this.followCast(); },
  },

  computed: {
    /**
     * Relay reachability. A registered host agent is proof the relay
     * works and beats any probe; everyone else - client machines, and
     * the host before its agent comes up - goes on the last probe.
     */
    relayOk() {
      if(this.isLocalServer && this.relayHostStatus === 'connected') return true;
      return this.relayProbeOk;
    },

    /**
     * Whether any other device could reach this session at all, over
     * either transport. Nothing about joining, casting or codes makes
     * sense while this is false.
     */
    collabOk() {
      return this.netOk || this.relayOk;
    },

    /**
     * What the current view would cast, or null if it casts nothing.
     */
    castTarget() {
      if(this.activeView === 'seats') return { mode: 'rollcall', target: null };
      if(this.activeView === 'motions') return { mode: 'motions', target: null };
      if(this.activeView === 'list' && this.list) return { mode: 'list', target: this.list };
      if(this.activeView === 'timerpage' && this.focusTimer)
        return { mode: 'timer', target: this.focusTimer.id };
      if(this.activeView === 'file' && this.file) return { mode: 'file', target: this.file.id };
      if(this.activeView === 'vote' && this.vote) return { mode: 'vote', target: this.vote };
      return null;
    },

    /**
     * this: current page is being cast (click uncasts)
     * idle: click casts the current page (taking over any other cast)
     * disabled: projector off or page not castable
     */
    castState() {
      if(!this.projOn || !this.castTarget) return 'disabled';

      const casting = this.proj.mode !== 'none' && this.proj.mode !== null;
      if(casting && this.castTarget.mode === this.proj.mode
         && (this.castTarget.target === this.proj.target || this.castTarget.target === null))
        return 'this';

      return 'idle';
    },

    pageCastIcon() {
      if(this.syncCast && this.frame) {
        if(this.iAmHost || this.claimPending) return 'present_to_all';
        if(this.castHostName) return 'co_present';
        return 'pause_presentation';
      }
      return this.castState === 'this' ? 'stop_screen_share' : 'screen_share';
    },

    pageCastClass() {
      if(this.syncCast && this.frame)
        return (!this.authorized || this.readOnly) ? 'cast-disabled' : '';
      return `cast-${this.castState}`;
    },

    pageCastTitle() {
      if(this.syncCast && this.frame) {
        if(this.iAmHost) return this.t('castHostOff');
        if(this.castHostName) return this.t('castCoHost');
        return this.t('castHostOn');
      }
      return this.castState === 'this' ? this.t('endCastThisPage') : this.t('castThisPage');
    },

    nearbyTop() {
      return this.services.slice(0, 3);
    },

    sortedConfs() {
      const q = this.confSearch.trim().toLowerCase();
      let list = this.confs || [];
      if(q !== '') list = list.filter(c => c.name.toLowerCase().indexOf(q) !== -1);
      return list.slice().sort((a, b) => (b.lastAccess || 0) - (a.lastAccess || 0));
    },

    simpleHalfCount() {
      return Math.floor(this.presentCount / 2) + 1;
    },

    twoThirdCount() {
      return Math.ceil(this.presentCount * 2 / 3);
    },

    twentyPercentCount() {
      return Math.ceil(this.presentCount / 5);
    },
  },
};

// eslint-disable-next-line no-unused-vars
function setup() {
  const instance = new Vue(desc);
  instance.init();

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  // ipcRenderer.once('updateAvailable', (event, { detail, version }) => {
  //   Push.create(`软件更新: ${version}`, {
  //     body: '点击开始下载',
  //     timeout: 10000,
  //     onClick: () => {
  //       shell.openExternal(`https://store.bjmun.org/console-lite/${detail.name}`);
  //     },
  //   });
  // });

  // ipcRenderer.send('checkForUpdate');
}
