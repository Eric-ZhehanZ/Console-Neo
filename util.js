// SPDX-License-Identifier: AGPL-3.0-or-later AND MIT
// Copyright (C) 2016 Liu Xiaoyi
// Copyright (C) 2018 Pan Ruizhe
// Modifications Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE, NOTICE, and LICENSES/MIT.txt for terms.

const os = require('os');

const { BrowserWindow, Menu, app, shell } = require('electron');
const remoteMain = require('@electron/remote/main');

function supportsTitlebarStyle() {
  if(os.platform() !== 'darwin') return false;
  const mainVer = parseInt(os.release().split('.')[0], 10);
  return Number.isInteger(mainVer) && mainVer >= 14; // 14 -> Yosemite
}

function isWindows() {
  return os.platform() === 'win32';
}

let _importerWin;

function getControllerMenu(controller) {
  const tmpl = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectall' },
        { type: 'separator' },
        {
          label: 'Import or Export Data',
          click(item, focusedWindow) {
            _importerWin = new BrowserWindow({
              width: 400,
              height: 250,
              frame: true,
              minimizable: false,
              modal: true,
              backgroundColor: '#FFF',
              parent: focusedWindow || controller,
              webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
              },
            });
            remoteMain.enable(_importerWin.webContents);
            _importerWin.loadURL(`file://${__dirname}/importer/index.html`);
            _importerWin.on('close', () => {
              _importerWin = null;
            });
          },
        },
      ],
    },

    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click(item, focusedWindow) {
            if(focusedWindow) focusedWindow.reload();
          },
        },
        {
          label: 'I am a developer',
          accelerator: os.platform() === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click(item, focusedWindow) {
            if(focusedWindow) focusedWindow.webContents.toggleDevTools();
          },
        },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    {
      role: 'window',
      submenu: [
        {
          role: 'minimize',
        },
        {
          role: 'close',
        },
      ],
    },

    {
      role: 'help',
      submenu: [
        {
          label: 'About Console Neo',
          click() { app.emit('cln-open-about'); },
        },
        {
          // For remote users this is the connected host's exact version
          label: 'Source Code',
          click() { app.emit('cln-open-source'); },
        },
        { type: 'separator' },
        {
          label: 'About Electron',
          click() { shell.openExternal('https://electronjs.org'); },
        },
      ],
    },
  ];

  if(os.platform() === 'darwin') {
    tmpl.unshift({
      label: app.getName(),
      submenu: [
        {
          label: `About ${app.getName()}`,
          click() { app.emit('cln-open-about'); },
        },
        { type: 'separator' },
        {
          role: 'services',
          submenu: [],
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });

    tmpl[1].submenu.push(
      { type: 'separator' },
      {
        label: '语音',
        submenu: [
          {
            role: 'startspeaking',
          },
          {
            role: 'stopspeaking',
          },
        ],
      }
    );

    tmpl[3].submenu = [
      {
        accelerator: 'CmdOrCtrl+W',
        role: 'close',
      },
      {
        accelerator: 'CmdOrCtrl+M',
        role: 'minimize',
      },
      {
        role: 'zoom',
      },
      {
        type: 'separator',
      },
      {
        role: 'front',
      },
    ];
  } else tmpl[0].submenu.push({ role: 'quit' });

  // Pages menu: CmdOrCtrl+1..9 jump straight to a controller page
  const pages = [
    ['home', 'Home'],
    ['seats', 'Seats'],
    ['motions', 'Motions'],
    ['lists', 'Speakers\u2019 Lists'],
    ['timers', 'Timers'],
    ['files', 'Documents'],
    ['votes', 'Voting'],
    ['stats', 'Data'],
    ['settings', 'Settings'],
  ];
  tmpl.splice(os.platform() === 'darwin' ? 3 : 2, 0, {
    label: 'Pages',
    submenu: pages.map((page, i) => ({
      label: page[1],
      accelerator: `CmdOrCtrl+${i + 1}`,
      click() {
        if(controller && !controller.isDestroyed())
          controller.webContents.send('navigateTo', page[0]);
      },
    })),
  });

  return Menu.buildFromTemplate(tmpl);
}

function applyControllerMenu(win) {
  const menu = getControllerMenu(win);
  if(os.platform() === 'darwin')
    Menu.setApplicationMenu(menu);
  else
    win.setMenu(menu);
}

function getProjectorMenu() {
  const tmpl = [
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click(item, focusedWindow) {
            if(focusedWindow) focusedWindow.reload();
          },
        },
        {
          label: 'I am a developer',
          accelerator: os.platform() === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click(item, focusedWindow) {
            if(focusedWindow) focusedWindow.webContents.toggleDevTools();
          },
        },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    {
      role: 'window',
      submenu: [
        {
          role: 'minimize',
        },
        {
          role: 'close',
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(tmpl);
}

function applyProjectorMenu(win) {
  if(os.platform() === 'darwin') return;
  win.setMenu(getProjectorMenu());
}

function checkForUpdate() {
  // Update distribution server is long gone; auto-update is disabled.
  return Promise.resolve([false, null]);
}

module.exports = {
  supportsTitlebarStyle,
  isWindows,
  getControllerMenu,
  applyControllerMenu,
  getProjectorMenu,
  applyProjectorMenu,
  checkForUpdate,
};
