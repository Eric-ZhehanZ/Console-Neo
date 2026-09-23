// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

/* eslint-disable */
// Populates an isolated instance (debug port 9225) with a demo committee per language.
const { attach, sleep } = require('./cdp.cjs');
const V = 'document.body.__vue__';
const IDS = require('path').join(require('os').tmpdir(), 'console-neo-demo-ids.json');

const DATA = {
  zh: {
    conf: '联合国安全理事会',
    seats: ['中国', '法国', '俄罗斯联邦', '英国', '美国', '阿尔及利亚', '圭亚那', '日本', '马耳他', '莫桑比克', '厄瓜多尔', '大韩民国', '塞拉利昂', '斯洛文尼亚', '瑞士'],
    open: '开启关于海上安全的辩论',
    topic: '保障关键海上航道安全',
    unmod: '起草决议草案',
    vote: '决议草案 1.1',
  },
  en: {
    conf: 'UN Security Council',
    seats: ['China', 'France', 'Russian Federation', 'United Kingdom', 'United States', 'Algeria', 'Guyana', 'Japan', 'Malta', 'Mozambique', 'Ecuador', 'Republic of Korea', 'Sierra Leone', 'Slovenia', 'Switzerland'],
    open: 'Open debate on maritime security',
    topic: 'Securing critical sea lanes',
    unmod: 'Drafting the resolution',
    vote: 'Draft Resolution 1.1',
  },
};

async function setup(c, lang) {
  const L = DATA[lang];
  const S = L.seats;
  await c.ev(`${V}.setLang('${lang}'), true`);
  const id = await c.ev(`new Promise(r => globalConn.createConf(${JSON.stringify(L.conf)}, d => r(d.id)))`);
  await c.ev(`${V}.connectConf('${id}', ${JSON.stringify(L.conf)}), true`);
  await c.waitFor(`${V}.frame && ${V}.currentConfId === '${id}' && ${V}.title === ${JSON.stringify(L.conf)}`);
  await sleep(500);
  await c.ev(`${V}.updateSeats(${JSON.stringify(S.map((n, i) => ({ name: n, present: i !== 12 })))}), true`);
  await c.waitFor(`${V}.seats.length === 15`);

  const motion = async (name, proposer, type, params, outcome) => {
    const before = await c.ev(`${V}.motions.length`);
    await c.ev(`${V}.addMotion(${JSON.stringify(name)}, ${JSON.stringify(proposer)}, '${type}', ${JSON.stringify(params)}), true`);
    await c.waitFor(`${V}.motions.length === ${before + 1}`);
    const mid = await c.ev(`${V}.motions[0].id`);
    if(outcome !== 'pending') {
      await c.ev(`${V}.updateMotion('${mid}', '${outcome}'), true`);
      await c.waitFor(`${V}.motions[0].outcome === '${outcome}'`);
    }
    return mid;
  };

  await motion(L.open, S[0], 'open', { title: L.open }, 'passed');
  const mod = await motion(L.topic, S[1], 'mod', { topic: L.topic, totTime: 900, eachTime: 90 }, 'passed');
  await motion(L.unmod, S[7], 'unmod', { topic: L.unmod, totTime: 1200 }, 'failed');
  await motion(L.topic, S[14], 'tour', { eachTime: 60 }, 'withdrawn');
  await motion(L.vote, S[4], 'svote', { title: L.vote }, 'pending');

  // The speakers' list the passed caucus created
  const speakers = [S[1], S[7], S[3], S[10], S[0], S[8]].map((name, i) => ({ name, uid: `demo-${lang}-${i}` }));
  await c.ev(`${V}.addList(${JSON.stringify(L.topic)}, ${JSON.stringify(speakers)}, 900, 90), true`);
  await c.waitFor(`${V}.lists.length === 1 && ${V}.lists[0].timerCurrent && ${V}.lists[0].timerTotal`);
  const listId = await c.ev(`${V}.lists[0].id`);
  await c.ev(`new Promise(r => confConn.executeMotion('${mod}', { kind: 'list', id: '${listId}' }, r)), true`);
  await c.ev(`${V}.iterateList(${V}.lists[0], 2), true`);
  await c.waitFor(`${V}.lists[0].ptr === 2`);
  await c.ev(`${V}.updateListTimers(${V}.lists[0], 90, 47, 900), true`).catch(() => {});

  // A substantive vote in progress (-1 = two-thirds)
  const present = S.filter((_, i) => i !== 12);
  await c.ev(`${V}.addVote(${JSON.stringify(L.vote)}, -1, 1, ${JSON.stringify(present)}), true`);
  await c.waitFor(`${V}.votes.length === 1`);
  const vid = await c.ev(`${V}.votes[0].id`);
  const ballots = [1, 1, -2, 1, 1, 1, -1, 1, 1, 1, 1];
  for(let i = 0; i < ballots.length; i++)
    await c.ev(`new Promise(r => ${V}.updateVote('${vid}', ${i}, ${ballots[i]}, () => r(true)))`);
  await sleep(300);
  return id;
}

(async () => {
  const c = await attach(9225, 'controller/index.html');
  await c.waitFor(`!!${V}`);
  await c.ev(`${V}.createBackend(), true`);
  await c.waitFor(`!!${V}.backendPasskey && !${V}.loading`, 20000);
  const ids = {};
  for(const lang of ['zh', 'en']) ids[lang] = await setup(c, lang);
  require('fs').writeFileSync(IDS, JSON.stringify(ids));
  console.log('ok', ids);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
