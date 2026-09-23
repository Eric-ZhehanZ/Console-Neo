// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

const Vue = require('vue');

/*
 * Speaker reminder-sound rules, reactive and persisted client-side.
 *
 * A rule applies to timers whose total exceeds `above` seconds and fires:
 *   kind "before" - when `at` seconds remain
 *   kind "end"    - when time fully elapses
 * `times` is how often the sound repeats for that rule (1-5).
 * With `single` on, at most one reminder fires per speech (timer run).
 * The "before" rules also drive the red running-out color on timers.
 */

const DEFAULT_RULES = [
  { above: 60, kind: 'before', at: 30, times: 1 },
  { above: 10, kind: 'before', at: 10, times: 1 },
  { above: 0, kind: 'end', at: 0, times: 2 },
];

function normalizeRule(r) {
  const above = Math.max(parseInt(r.above, 10) || 0, 0);
  const kind = r.kind === 'end' ? 'end' : 'before';
  const at = Math.max(parseInt(r.at, 10) || 0, 0);
  let times = parseInt(r.times, 10);
  if(!Number.isInteger(times) || times < 1) times = 1;
  if(times > 5) times = 5;
  return { above, kind, at, times };
}

function load() {
  try {
    const raw = window.localStorage.getItem('cln-reminder');
    if(raw) return JSON.parse(raw);
  } catch(e) { }
  return { enabled: true, single: false, rules: DEFAULT_RULES };
}

const saved = load();

const store = new Vue({
  data: {
    enabled: saved.enabled !== false,
    single: saved.single === true,
    rules: Array.isArray(saved.rules) && saved.rules.length
      ? saved.rules.map(normalizeRule) : DEFAULT_RULES.map(normalizeRule),
  },
});

function persist() {
  try {
    window.localStorage.setItem('cln-reminder',
      JSON.stringify({ enabled: store.enabled, single: store.single, rules: store.rules }));
  } catch(e) { }
}

function set(enabled, single, rules) {
  store.enabled = enabled;
  store.single = single;
  store.rules = rules.map(normalizeRule);
  persist();
}

/* Applies external config (e.g. pushed from controller to projector) */
function apply(cfg) {
  if(!cfg) return;
  if(typeof cfg.enabled === 'boolean') store.enabled = cfg.enabled;
  if(typeof cfg.single === 'boolean') store.single = cfg.single;
  if(Array.isArray(cfg.rules)) store.rules = cfg.rules.map(normalizeRule);
}

/* Highest before-end threshold that applies to a timer of this length */
function activeThreshold(total) {
  let best = -1;
  for(const r of store.rules)
    if((r.kind || 'before') === 'before' && total > r.above && r.at > best) best = r.at;
  return best;
}

/* How many times the reminder should sound at this remaining value (0 = silent) */
function soundCount(total, remaining) {
  if(!store.enabled) return 0;
  let n = 0;
  for(const r of store.rules) {
    if(total <= r.above) continue;
    if((r.kind || 'before') === 'before' && r.at === remaining) n += r.times || 1;
    else if(r.kind === 'end' && remaining === 0) n += r.times || 1;
  }
  return n > 5 ? 5 : n;
}

module.exports = { store, DEFAULT_RULES, normalizeRule, set, apply, activeThreshold, soundCount };
