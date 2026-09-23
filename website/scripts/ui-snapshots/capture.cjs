/* eslint-disable */
// Snapshots real controller/projector DOM from the demo instance into website/public/ui/.
const fs = require('fs');
const path = require('path');
const { attach, sleep } = require('./cdp.cjs');
const V = 'document.body.__vue__';
const IDS = require('path').join(require('os').tmpdir(), 'console-neo-demo-ids.json');
const ids = JSON.parse(require('fs').readFileSync(IDS, 'utf8'));
const NAMES = { zh: '联合国安全理事会', en: 'UN Security Council' };
const REPO = path.resolve(__dirname, '../../..');
const OUT = path.join(REPO, 'website/public/ui');
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });

// Serialize the live document: no scripts, no handlers, live input values, local asset paths
const SNAP = (css) => `(() => {
  const assets = [];
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
  doc.querySelectorAll('img[src]').forEach(el => {
    const abs = new URL(el.getAttribute('src'), location.href).href;
    assets.push(abs);
    el.setAttribute('src', '/ui/assets/' + abs.split('/').pop());
  });
  doc.querySelectorAll('link[rel=stylesheet]').forEach(l => l.setAttribute('href', '/ui/${css}.css'));
  const head = doc.querySelector('head');
  head.insertAdjacentHTML('beforeend', '<meta name="robots" content="noindex">'
    + '<style>html,body{overflow:hidden!important;scrollbar-width:none}::-webkit-scrollbar{display:none}'
    + '*{cursor:default!important}</style>');
  return { html: '<!DOCTYPE html>\\n' + doc.outerHTML, assets };
})()`;

const assets = new Set();
async function save(target, css, name) {
  const { html, assets: a } = await target.ev(SNAP(css));
  a.forEach(x => assets.add(x));
  fs.writeFileSync(path.join(OUT, `${name}.html`), html);
  await target.shot(path.join(require('os').tmpdir(), `cn-shot-${name}.png`));
  console.log('saved', name, html.length);
}

(async () => {
  const c = await attach(9225, 'controller/index.html');
  await c.ev(`require('@electron/remote').getCurrentWindow().setContentSize(1280, 800), true`);
  let p = null;

  for(const lang of ['zh', 'en']) {
    await c.ev(`${V}.setLang('${lang}'), true`);
    await c.ev(`${V}.connectConf('${ids[lang]}', ${JSON.stringify(NAMES[lang])}), true`);
    await c.waitFor(`${V}.frame && ${V}.currentConfId === '${ids[lang]}' && ${V}.lists.length === 1 && ${V}.votes.length === 1`);
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 });
    await sleep(800);

    await c.ev(`${V}.navigate('home'), true`); await sleep(900);
    await save(c, 'controller', `controller-home-${lang}`);
    await c.ev(`${V}.viewList(${V}.lists[0]), true`); await sleep(900);
    await save(c, 'controller', `controller-list-${lang}`);
    await c.ev(`${V}.navigate('motions'), true`); await sleep(900);
    await save(c, 'controller', `controller-motions-${lang}`);
    // Round 1 complete: final tallies, Pass/No Vote shown
    await c.ev(`${V}.iterateVote(${V}.votes[0].id, { iteration: 1, running: false }), true`);
    await c.waitFor(`${V}.votes[0].status.iteration === 1`);
    await c.ev(`${V}.viewVote(${V}.votes[0]), true`); await sleep(900);
    await c.waitFor(`${V}.votes[0].status.iteration === 1`);
    await save(c, 'controller', `controller-vote-${lang}`);

    if(!p) {
      if(!(await c.ev(`${V}.projOn`))) {
        await c.ev(`require('electron').ipcRenderer.send('openProjector', { windowed: true }), true`);
        await c.waitFor(`${V}.projOn === true`);
      }
      p = await attach(9225, 'projector/index.html');
      await sleep(1500);
      await p.ev(`require('@electron/remote').getCurrentWindow().setContentSize(1600, 900), true`);
    }
    await c.ev(`${V}.sendSettings(), ${V}.sendConfName(), true`);
    await c.ev(`${V}.projectList(${V}.lists[0]), true`); await sleep(1300);
    await save(p, 'projector', `projector-list-${lang}`);
    await c.ev(`${V}.projectMotions(), true`); await sleep(1300);
    await save(p, 'projector', `projector-motions-${lang}`);
    await c.ev(`${V}.projectVote(${V}.votes[0]), true`); await sleep(1300);
    await p.waitFor(`!document.querySelector('.vote-iteration') || !/Not Started|未启动/.test(document.querySelector('.vote-iteration').textContent)`, 5000);
    await save(p, 'projector', `projector-vote-${lang}`);
  }
  for(const a of assets) {
    const src = decodeURIComponent(a.replace(/^file:\/\//, ''));
    fs.copyFileSync(src, path.join(OUT, 'assets', path.basename(src)));
  }
  console.log('assets', [...assets].map(x => path.basename(x)));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
