// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

/* eslint-disable */
// Captures the demo instance (see README) in both languages:
//   public/ui/*.html      DOM snapshots of real windows, for the feature sections
//   public/guides/*.webp  screenshots for the step-by-step guides (PNG if PYTHON lacks Pillow)
// The controller is captured at the app's own default window size (main.js: 72% of the
// work area at 1.7:1), the cast at 1600x900. Sizes are recorded in app/ui-sizes.json.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { attach, sleep } = require('./cdp.cjs');

const V = 'document.body.__vue__';
const A = `${V}.$refs.active`;
const IDS = path.join(os.tmpdir(), 'console-neo-demo-ids.json');
const ids = JSON.parse(fs.readFileSync(IDS, 'utf8'));
const NAMES = { zh: '联合国安全理事会', en: 'UN Security Council' };
const REPO = path.resolve(__dirname, '../../..');
const UI = path.join(REPO, 'website/public/ui');
const GUIDES = path.join(REPO, 'website/public/guides');
fs.mkdirSync(path.join(UI, 'assets'), { recursive: true });
fs.mkdirSync(GUIDES, { recursive: true });

// Per-language form values typed into dialogs
const FORM = {
  zh: { list: '保障关键海上航道安全', proposer: '法国', topic: '海上事件降级框架', vote: '决议草案 1.1', code: 'K7Q2MF' },
  en: { list: 'Securing critical sea lanes', proposer: 'France', topic: 'Maritime de-escalation framework', vote: 'Draft Resolution 1.1', code: 'K7Q2MF' },
};

// Serialize the live document: no scripts, no handlers, live input values, local asset paths
const SNAP = css => `(() => {
  const doc = document.documentElement.cloneNode(true);
  doc.querySelectorAll('script').forEach(s => s.remove());
  const live = document.querySelectorAll('input, textarea');
  doc.querySelectorAll('input, textarea').forEach((el, i) => {
    if(live[i] && live[i].value) el.setAttribute('value', live[i].value);
  });
  doc.querySelectorAll('*').forEach(el => {
    for(const a of [...el.attributes])
      if(/^(on|@|v-|:)/i.test(a.name) || a.name === 'tabindex' || a.name === 'contenteditable') el.removeAttribute(a.name);
  });
  doc.querySelectorAll('link[rel=stylesheet]').forEach(l => l.setAttribute('href', '/ui/${css}.css'));
  const style = document.createElement('style');
  style.textContent = 'html,body{overflow:hidden!important;scrollbar-width:none}::-webkit-scrollbar{display:none}*{cursor:default!important}';
  doc.querySelector('head').appendChild(style);
  return '<!DOCTYPE html>\\n' + doc.outerHTML;
})()`;

async function snapshot(target, css, name) {
  fs.writeFileSync(path.join(UI, `${name}.html`), await target.ev(SNAP(css)));
  console.log('snapshot', name);
}

async function shot(target, name) {
  const png = path.join(GUIDES, `${name}.png`);
  await target.shot(png);
  if(process.env.PYTHON) {
    execFileSync(process.env.PYTHON, ['-c',
      'import sys; from PIL import Image; Image.open(sys.argv[1]).save(sys.argv[2], "WEBP", quality=88, method=6)',
      png, png.replace(/\.png$/, '.webp')]);
    fs.unlinkSync(png);
  }
  console.log('shot', name);
}

// Same formula main.js uses to size the controller on launch
const DEFAULT_SIZE = `(() => {
  const wa = require('@electron/remote').screen.getPrimaryDisplay().workAreaSize;
  let width = Math.round(Math.max(Math.min(wa.width * 0.72, 1640), 960));
  let height = Math.round(width / 1.7);
  if(height > wa.height * 0.9) { height = Math.round(wa.height * 0.9); width = Math.round(height * 1.7); }
  return [width, height];
})()`;

async function size(target, w, h) {
  await target.ev(`require('@electron/remote').getCurrentWindow().setContentSize(${w}, ${h}), true`);
  await sleep(300);
}

const settle = () => sleep(900); // views crossfade

(async () => {
  let c = await attach(9225, 'controller/index.html');
  const [cw, ch] = await c.ev(DEFAULT_SIZE);
  await size(c, cw, ch);
  fs.writeFileSync(path.join(REPO, 'website/app/ui-sizes.json'),
    `${JSON.stringify({ controller: { width: cw, height: ch }, cast: { width: 1600, height: 900 } }, null, 2)}\n`);
  console.log('controller size', cw, ch);
  const idkey = await c.ev(`${V}.backendIDKey`);
  let p = null;

  for(const lang of ['zh', 'en']) {
    const F = FORM[lang];

    // Launch page and the joining device's screens (reload returns to launch)
    await c.ev(`${V}.disconnectServer(), true`);
    await sleep(2500);
    c = await attach(9225, 'controller/index.html');
    await c.waitFor(`!!${V} && ${V}.ready !== false`);
    await c.ev(`${V}.setLang('${lang}'), true`);
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 });
    await settle();
    await shot(c, `launch-${lang}`);

    await c.ev(`${V}.connectBackend(), true`); await settle();
    await c.ev(`${V}.sessionIdInput = '${idkey}', true`); await sleep(300);
    await shot(c, `join-connect-${lang}`);
    await c.ev(`${V}.applyService({ id: '${idkey}', conf: ${JSON.stringify(NAMES[lang])}, host: '127.0.0.1', port: 3466, stamp: Date.now() }), true`);
    await sleep(400);
    await c.ev(`${V}.codeInput = '${F.code}', true`); await sleep(300);
    await shot(c, `join-code-${lang}`);
    await c.ev(`${V}.startupMenu(), true`); await sleep(500);

    // Host: committee picker
    await c.ev(`${V}.createBackend(), true`);
    await c.waitFor(`${V}.picker && !${V}.loading`, 20000); await settle();
    await shot(c, `picker-${lang}`);
    await c.ev(`${V}.pickerBrowse(), true`); await sleep(500);
    await c.ev(`${V}.selectConfItem(${V}.confs.find(x => x.id === '${ids[lang]}')), true`); await sleep(500);
    await shot(c, `picker-browse-${lang}`);

    await c.ev(`${V}.connectConf('${ids[lang]}', ${JSON.stringify(NAMES[lang])}), true`);
    await c.waitFor(`${V}.frame && ${V}.currentConfId === '${ids[lang]}' && ${V}.lists.length && ${V}.votes.length`);
    await c.ev(`${V}.iterateVote(${V}.votes[0].id, { iteration: 1, running: false }), true`);
    await c.waitFor(`${V}.votes[0].status.iteration === 1`);
    await settle();

    // Committee home, with the Chair code shown
    await c.ev(`${V}.navigate('home'), true`); await settle();
    await snapshot(c, 'controller', `controller-home-${lang}`);
    await c.ev(`(document.querySelector('.cb-code') || { click() {} }).click(), true`); await sleep(700);
    await shot(c, `home-${lang}`);

    // Seats: editing the roster, then attendance
    await c.ev(`${V}.navigate('seats'), true`); await settle();
    await shot(c, `seats-${lang}`);
    await c.ev(`${A}.edit(), true`); await sleep(600);
    await shot(c, `seats-edit-${lang}`);
    await c.ev(`${A}.editFlag = false, true`); await sleep(300);

    // Speakers' lists
    await c.ev(`${V}.navigate('lists'), true`); await settle();
    await c.ev(`${A}.add(), ${A}.name = ${JSON.stringify(F.list)}, ${A}.totTime = 900, ${A}.eachTime = 90, true`); await sleep(600);
    await shot(c, `list-create-${lang}`);
    await c.ev(`${A}.cancelAdd(), true`);
    await c.ev(`${V}.viewList(${V}.lists[0]), true`); await settle();
    await snapshot(c, 'controller', `controller-list-${lang}`);
    await shot(c, `list-${lang}`);

    // Motions
    await c.ev(`${V}.navigate('motions'), true`); await settle();
    await snapshot(c, 'controller', `controller-motions-${lang}`);
    await shot(c, `motions-${lang}`);
    await c.ev(`${A}.add(), ${A}.inputProposer = ${JSON.stringify(F.proposer)}, ${A}.inputTopic = ${JSON.stringify(F.list)}, ${A}.totTime = 900, ${A}.eachTime = 90, true`); await sleep(700);
    await shot(c, `motion-add-${lang}`);
    await c.ev(`${A}.addFlag = false, true`); await sleep(300);

    // Voting
    await c.ev(`${V}.navigate('votes'), true`); await settle();
    await c.ev(`${A}.add(), ${A}.inputName = ${JSON.stringify(F.vote)}, true`); await sleep(600);
    await shot(c, `vote-create-${lang}`);
    await c.ev(`${A}.addFlag = false, true`); await sleep(300);
    await c.ev(`${V}.viewVote(${V}.votes[0]), true`); await settle();
    await c.waitFor(`${V}.votes[0].status.iteration === 1`);
    await snapshot(c, 'controller', `controller-vote-${lang}`);
    await shot(c, `vote-${lang}`);

    // The cast window
    if(!p) {
      if(!(await c.ev(`${V}.projOn`))) {
        await c.ev(`require('electron').ipcRenderer.send('openProjector', { windowed: true }), true`);
        await c.waitFor(`${V}.projOn === true`);
      }
      p = await attach(9225, 'projector/index.html');
      await sleep(1500);
      await size(p, 1600, 900);
    }
    await c.ev(`${V}.setupProjector(), true`); await sleep(500);
    for(const [mode, call] of [['list', `projectList(${V}.lists[0])`], ['motions', 'projectMotions()'], ['vote', `projectVote(${V}.votes[0])`]]) {
      await c.ev(`${V}.${call}, true`); await sleep(1400);
      await snapshot(p, 'projector', `projector-${mode}-${lang}`);
      await shot(p, `cast-${mode}-${lang}`);
    }
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
