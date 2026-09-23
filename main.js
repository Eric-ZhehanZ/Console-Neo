/* eslint-disable spaced-comment */
/// <reference path="typings/electron.d.ts" />
/* eslint-enable spaced-comment */

const electron = require('electron');
const {
  powerSaveBlocker, ipcMain, app,
  protocol, globalShortcut, BrowserWindow,
} = electron;

// Isolated dev/test instances: point storage (and the server port below)
// elsewhere so a second copy can run beside a live session
if(process.env.CLN_USERDATA) app.setPath('userData', process.env.CLN_USERDATA);
const SERVER_PORT = Number(process.env.CLN_PORT) || 3066;

const path = require('path');
const tar = require('tar');
const fs = require('fs');
const nutil = require('util');
const fstream = require('fstream');
const rimraf = require('rimraf');

const remoteMain = require('@electron/remote/main');
const getIpv4 = require('./packages/ipv4/index');
const server = require('./server/server');
const tunnel = require('./shared/tunnel');
const util = require('./util');

remoteMain.initialize();

const name = 'Console Neo';

let PSB_ID;
let IPV4 = null;

function refreshIpv4() {
  getIpv4().then(ip => {
    IPV4 = ip;
  }).catch((err) => {
    console.log('[WARN] getIpv4() Rejected:', nutil.format(err));
    if(!IPV4) IPV4 = 'localhost';
  });
}
refreshIpv4();
// The address changes when the machine moves networks - keep it fresh
setInterval(refreshIpv4, 15 * 1000);

app.setName(name);

// Every note window and projector (re)open registers listeners via
// @electron/remote; a long session easily passes the default cap of 10
// and spams MaxListenersExceededWarning for perfectly healthy usage
require('events').EventEmitter.defaultMaxListeners = 40;

// Windows, not the OS, but windows
let controller;
let projector;

const rendererPrefs = {
  nodeIntegration: true,
  contextIsolation: false,
  spellcheck: false,
};

/* A crashed or hung renderer gets logged with its reason and reloaded
   (at most once per half minute, so a crash loop cannot spin) */
const lastRendererReload = new Map();

function watchRenderer(win, label) {
  win.webContents.on('render-process-gone', (event, details) => {
    console.error(`[RENDERER-GONE] ${label}: ${details.reason} (exit ${details.exitCode})`);
    if(details.reason === 'clean-exit' || details.reason === 'killed') return;
    if(win.isDestroyed()) return;

    const last = lastRendererReload.get(label) || 0;
    if(Date.now() - last < 30 * 1000) return;
    lastRendererReload.set(label, Date.now());
    win.webContents.reload();
  });

  win.webContents.on('unresponsive', () => {
    console.error(`[RENDERER] ${label} unresponsive`);
  });
  win.webContents.on('responsive', () => {
    console.error(`[RENDERER] ${label} responsive again`);
  });
}

const controllerOpt = {
  width: 800,
  height: 600,
  frame: false,
  backgroundColor: '#FFF',
  icon: path.join(__dirname, 'images', 'icon_256x256.png'),
  webPreferences: rendererPrefs,
};

const projectorOpt = {
  x: 0,
  y: 0,
  width: 800,
  height: 600,
  frame: false,
  autoHideMenuBar: true,
  show: false,
  icon: path.join(__dirname, 'images', 'icon_256x256.png'),
  webPreferences: rendererPrefs,
};

if(util.supportsTitlebarStyle()) {
  controllerOpt.frame = true;
  projectorOpt.frame = true;
  controllerOpt.titleBarStyle = 'hidden';
  projectorOpt.titleBarStyle = 'hidden';
} else if(util.isWindows()) {
  controllerOpt.frame = true;
  projectorOpt.frame = true;
}

function initController() {
  controller = new BrowserWindow(controllerOpt);
  remoteMain.enable(controller.webContents);
  watchRenderer(controller, 'controller');
  util.applyControllerMenu(controller);
  controller.loadURL(`file://${__dirname}/controller/index.html`);
  if(PSB_ID !== undefined) {
    powerSaveBlocker.stop(PSB_ID);
    PSB_ID = undefined;
  }
  PSB_ID = powerSaveBlocker.start('prevent-display-sleep');
  if(!powerSaveBlocker.isStarted(PSB_ID)) console.log('Failed to start powerSafeBlocker');

  controller.on('closed', () => {
    controller = null;

    /* Close projector as well */
    if(projector) projector.close();
  });
}

function initProjector(opts) {
  const windowed = Boolean(opts && opts.windowed);

  // Ensures that previous windows are closed
  if(projector) projector.close();

  const { screen } = require('electron'); // eslint-disable-line

  if(windowed) {
    // A normal window on the same display as the controller, not maximized
    const base = controller ? controller.getBounds() : { x: 0, y: 0, width: 800, height: 600 };
    const disp = screen.getDisplayMatching(base);
    const width = Math.round(disp.workArea.width * 0.62);
    const height = Math.round(width * 9 / 16);
    projector = new BrowserWindow(Object.assign({}, projectorOpt, {
      x: disp.workArea.x + Math.round((disp.workArea.width - width) / 2),
      y: disp.workArea.y + Math.round((disp.workArea.height - height) / 2),
      width,
      height,
    }));
    remoteMain.enable(projector.webContents);
    watchRenderer(projector, 'projector');

    projector.webContents.on('dom-ready', () => {
      projector.show();
    });
    projector.loadURL(`file://${__dirname}/projector/index.html`);
    util.applyProjectorMenu(projector);

    projector.on('closed', () => {
      projector = null;
      if(controller) controller.webContents.send('projectorClosed');
    });
    return;
  }

  const displays = screen.getAllDisplays();
  let external;

  if(displays.length <= 1) {
    projectorOpt.x = 0;
    projectorOpt.y = 0;
    projector = new BrowserWindow(projectorOpt);
  } else {
    for(let i = 0; i < displays.length; i++)
      if(displays[i].bounds.x !== 0 || displays[i].bounds.y !== 0) {
        external = displays[i];
        console.log(`[Proj] external display found, id=${external.id}`);
        break;
      }
    if(external) {
      projectorOpt.x = external.bounds.x;
      projectorOpt.y = external.bounds.y;
      projector = new BrowserWindow(projectorOpt);
    } else {
      projectorOpt.x = 0;
      projectorOpt.y = 0;
      projector = new BrowserWindow(projectorOpt);
    }
  }
  remoteMain.enable(projector.webContents);
  watchRenderer(projector, 'projector');

  projector.hide();

  projector.webContents.on('dom-ready', () => {
    // projector.webContents.openDevTools();
    projector.show();
    if(external) {
      console.log(`[Proj] maximizing projector window, id=${external.id}`);
      projector.setFullScreen(true);
    }
  });
  projector.loadURL(`file://${__dirname}/projector/index.html`);
  util.applyProjectorMenu(projector);

  // Minimizing or leaving fullscreen ends the cast
  projector.on('minimize', () => {
    if(projector) projector.close();
  });
  projector.on('leave-full-screen', () => {
    if(projector) projector.close();
  });

  projector.on('closed', () => {
    projector = null;
    if(controller) controller.webContents.send('projectorClosed');
  });
}

function setupExportHandler() {
  protocol.registerBufferProtocol('clexport', (request, callback) => {
    if(this.serverStarted) return void callback({ error: 'Server is running' });

    let DB_PATH = path.join(__dirname, 'server', 'backend');
    if(process.platform === 'darwin')
      DB_PATH = app.getPath('userData');

    const dir = path.join(DB_PATH, 'storage');
    // const dir = path.join(__dirname, 'server', 'backend', 'storage');

    const buffers = [];
    fstream.Reader({
      path: dir,
      type: 'Directory',
    })
    .pipe(tar.Pack())
    .on('data', (data) => {
      buffers.push(data);
    })
    .on('end', () => {
      callback(Buffer.concat(buffers));
    })
    .on('error', err => callback({ error: err.toString() }));
  });
}

app.on('ready', () => {
  // In dev runs the dock shows Electron's default icon; use ours instead.
  // Packaged builds get the icon from the app bundle.
  if(process.platform === 'darwin' && !app.isPackaged && app.dock)
    app.dock.setIcon(path.join(__dirname, 'images', 'icon_256x256@2x.png'));

  // Size the controller to the screen: ~72% of the work area at a 1.7 ratio
  const { screen } = electron; // eslint-disable-line global-require
  const wa = screen.getPrimaryDisplay().workAreaSize;
  let width = Math.round(Math.max(Math.min(wa.width * 0.72, 1640), 960));
  let height = Math.round(width / 1.7);
  if(height > wa.height * 0.9) {
    height = Math.round(wa.height * 0.9);
    width = Math.round(height * 1.7);
  }
  controllerOpt.width = width;
  controllerOpt.height = height;

  setupExportHandler();
  initController();
  globalShortcut.register('CommandOrControl+\\', () => {
    if(controller) controller.focus();
    else initController();
  });

  globalShortcut.register('CommandOrControl+Shift+|', () => {
    if(projector) projector.focus();
    else initProjector();
  });

  globalShortcut.register('CommandOrControl+Shift+P', () => {
    if(controller) {
      controller.webContents.openDevTools({ mode: 'detach' });
      controller.webContents.executeJavaScript('stopTheWorld()');
    }
  });
});

app.on('window-all-closed', () => {
  if(process.platform !== 'darwin') {
    if(PSB_ID !== undefined)
      powerSaveBlocker.stop(PSB_ID);
    app.quit();
  }
});

app.on('activate', () => {
  if(!controller)
    initController();
});

let serverStarted = false;

let passkey;
let idkey;
let readerkey;
let connectCode;
let readerConnectCode;
let resetKeysFn;

let shutdown;

/* Relay hosting: an outbound tunnel registers this session (by its
   device ID) at the coordination service, so devices outside the LAN
   can reach the embedded server. LAN connections keep working as the
   fallback when the relay is unreachable. */

const DEFAULT_RELAY = 'https://connect.consoleneo.com';
let relayUrl = DEFAULT_RELAY;
let relayAgent = null;
let relayStatus = 'off';

function pushRelayStatus() {
  if(controller) controller.webContents.send('relayStatus', {
    status: relayStatus, url: relayUrl,
  });
}

function startRelayAgent() {
  if(!serverStarted) return;
  if(relayAgent) relayAgent.stop();
  relayStatus = 'connecting';
  pushRelayStatus();
  relayAgent = tunnel.startHostAgent({
    relayUrl,
    session: idkey,
    localPort: SERVER_PORT,
    onStatus: (s) => {
      relayStatus = s;
      pushRelayStatus();
    },
  });
}

ipcMain.on('setRelayConfig', (event, data) => {
  const next = ((data && data.url) || DEFAULT_RELAY).trim() || DEFAULT_RELAY;
  const changed = next !== relayUrl;
  relayUrl = next;
  if(serverStarted && (changed || !relayAgent)) startRelayAgent();
});

ipcMain.on('getRelayStatus', (event) => {
  event.returnValue = { status: relayStatus, url: relayUrl };
});

ipcMain.on('startServer', (event) => {
  if(serverStarted) {
    event.sender.send('serverCallback', {
      url: `http://${IPV4 || 'localhost'}:${SERVER_PORT}`,
      passkey,
      idkey,
      readerkey,
      code: connectCode,
      readerCode: readerConnectCode,
    });
    return;
  }

  server((err, info) => {
    if(err) {
      // fs.writeFileSync(path.join(__dirname, 'log.txt'), err);
      console.error(err);
      event.sender.send('serverCallback', { error: nutil.format(err) });
      return;
    }

    serverStarted = true;
    passkey = info.passkey;
    idkey = info.idkey;
    readerkey = info.readerkey;
    connectCode = info.code;
    readerConnectCode = info.readerCode;
    resetKeysFn = info.reset;
    shutdown = info.shutdown;

    startRelayAgent();

    info.onRotate((keys) => {
      passkey = keys.passkey;
      readerkey = keys.readerkey;
      connectCode = keys.code;
      readerConnectCode = keys.readerCode;
      if(controller) controller.webContents.send('serverKeysRotated', {
        passkey,
        readerkey,
        code: connectCode,
        readerCode: readerConnectCode,
        url: `http://${IPV4 || 'localhost'}:${SERVER_PORT}`,
      });
    });
    event.sender.send('serverCallback', {
      url: `http://${IPV4 || 'localhost'}:${SERVER_PORT}`,
      passkey,
      idkey,
      readerkey,
      code: connectCode,
      readerCode: readerConnectCode,
    });
  }, SERVER_PORT);
});

ipcMain.on('getServerIdkey', (event) => {
  event.returnValue = serverStarted ? idkey : null;
});

ipcMain.on('resetServerKeys', (event) => {
  if(!serverStarted || !resetKeysFn)
    return void event.sender.send('resetKeysCallback', { error: 'ServerNotRunning' });

  const keys = resetKeysFn();
  passkey = keys.passkey;
  readerkey = keys.readerkey;
  connectCode = keys.code;
  readerConnectCode = keys.readerCode;
  return void event.sender.send('resetKeysCallback', {
    passkey, readerkey, idkey, code: connectCode, readerCode: readerConnectCode,
  });
});

ipcMain.on('isServerRunning', (event) => {
  event.returnValue = serverStarted;
});

/* Where the controller left off, held in main-process memory only:
   a renderer reload resumes the session, a full app restart starts
   fresh at the welcome page - exactly the wanted semantics */
let resumeState = null;

ipcMain.on('setResumeState', (event, data) => {
  resumeState = data || null;
});

ipcMain.on('getResumeState', (event) => {
  event.returnValue = resumeState;
});

ipcMain.on('openProjector', (event, opts) => {
  initProjector(opts);
});

/* Note mini-windows: one per note key; reopening focuses the existing one */
const noteWindows = new Map();

ipcMain.on('openNote', (event, opts) => {
  if(!opts || !opts.key) return;

  const existing = noteWindows.get(opts.key);
  if(existing && !existing.isDestroyed()) {
    existing.focus();
    return;
  }

  const win = new BrowserWindow({
    width: 440,
    height: 560,
    minWidth: 320,
    minHeight: 300,
    alwaysOnTop: true,
    backgroundColor: '#FFF',
    icon: path.join(__dirname, 'images', 'icon_256x256.png'),
    webPreferences: rendererPrefs,
  });
  remoteMain.enable(win.webContents);
  watchRenderer(win, `note:${opts.key}`);
  win.setMenuBarVisibility(false);

  const q = new URLSearchParams({
    url: opts.url || '',
    conf: opts.conf || '',
    key: opts.key,
    title: opts.title || 'Notes',
    token: opts.token || '',
  });
  win.loadURL(`file://${__dirname}/notes/note.html?${q.toString()}`);

  noteWindows.set(opts.key, win);
  win.on('closed', () => {
    if(noteWindows.get(opts.key) === win) noteWindows.delete(opts.key);
  });
});

ipcMain.on('closeProjector', () => {
  if(projector) projector.close();
});

ipcMain.on('toProjector', (event, data) => {
  if(projector) projector.webContents.send('fromController', data);
});

ipcMain.on('getProjector', (event) => {
  if(!projector) event.returnValue = null;
  else event.returnValue = projector.id;
});

ipcMain.on('projectorInitialized', () => {
  if(controller) controller.webContents.send('projectorReady');
});

ipcMain.on('checkForUpdate', (ev) => {
  util.checkForUpdate().then(([data, ver]) => {
    if(!data) return;
    ev.sender.send('updateAvailable', { detail: data, version: `v${ver[0]}.${ver[1]}.${ver[2]}` });
  }).catch(e => console.error(e.stack));
});

ipcMain.on('doImport', (ev, data) => {
  let DB_PATH = path.join(__dirname, 'server', 'backend');
  if(process.platform === 'darwin')
    DB_PATH = app.getPath('userData');

  const targetDir = path.join(DB_PATH, 'storage');

  try {
    fs.mkdirSync(targetDir);
  } catch(err) {}

  rimraf(path.join(targetDir, '*'), (err) => {
    if(err) return void ev.sender.send('importCb', err);
    fs.createReadStream(data)
    .pipe(tar.Extract({
      path: targetDir,
      strip: 1,
    }))
    .on('end', () => ev.sender.send('importCb', null))
    .on('error', err => ev.sender.send('importCb', err));
  });
});

app.on('quit', () => {
  if(relayAgent) relayAgent.stop();
  if(serverStarted) shutdown();
});

process.on('unhandledRejection', err => {
  console.log(err.stack);
});

// A network change can surface async dgram/mDNS errors (EHOSTUNREACH etc.)
// as uncaught exceptions; log them instead of letting the app die
process.on('uncaughtException', err => {
  console.error('[UNCAUGHT]', err && err.stack ? err.stack : err);
});
