// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

/**
 * Motion type registry shared by controller and projector.
 *
 * fields drive which inputs the create-motion modal shows:
 *   topic    - textarea, becomes the motion name
 *   title    - textarea, becomes the motion name
 *   totTime  - total duration
 *   eachTime - per-speaker duration
 *   file     - pick or upload one file
 *   files    - pick any number of files
 *
 * action names the artifact the motion produces when executed:
 *   list | timer | prolong | tour | file | pvote | svote | null (record only)
 */

/* eslint-disable max-len */
const TYPES = [
  { key: 'mod', label: '有主持核心磋商', labelKey: 'mtMod', fields: ['topic', 'totTime', 'eachTime'], action: 'list' },
  { key: 'unmod', label: '自由磋商', labelKey: 'mtUnmod', fields: ['topic', 'totTime'], action: 'timer' },
  { key: 'prolong', label: '延长上一磋商', labelKey: 'mtProlong', fields: ['topic', 'totTime'], action: 'prolong' },
  { key: 'cow', label: '全体协商', labelKey: 'mtCow', fields: ['topic', 'totTime'], action: 'timer' },
  { key: 'tour', label: '轮流发言', labelKey: 'mtTour', fields: ['eachTime'], action: 'tour' },
  { key: 'open', label: '开启辩论', labelKey: 'mtOpen', fields: ['title', 'comment'], action: null },
  { key: 'free', label: '自由辩论', labelKey: 'mtFree', fields: ['topic', 'totTime'], action: 'timer' },
  { key: 'doc', label: '文件相关', labelKey: 'mtDoc', fields: ['title', 'files'], action: 'file' },
  { key: 'pvote', label: '程序性投票', labelKey: 'mtPvote', fields: ['title'], action: 'pvote' },
  { key: 'svote', label: '实质性投票', labelKey: 'mtSvote', fields: ['title', 'files'], action: 'svote' },
  { key: 'pause', label: '暂停会议', labelKey: 'mtPause', fields: ['totTime'], action: 'timer' },
  { key: 'suspend', label: '休会', labelKey: 'mtSuspend', fields: ['title'], action: null },
  { key: 'adjourn', label: '闭会', labelKey: 'mtAdjourn', fields: [], action: null },
  { key: 'other', label: '其他动议', labelKey: 'mtOther', fields: ['title'], action: null },
];
/* eslint-enable max-len */

const BY_KEY = {};
for(const t of TYPES) BY_KEY[t.key] = t;

function get(key) {
  return BY_KEY[key] || BY_KEY.other;
}

function label(key) {
  return get(key).label;
}

function labelKey(key) {
  return get(key).labelKey;
}

function hasField(key, field) {
  return get(key).fields.indexOf(field) !== -1;
}

/* Standard precedence: the more disruptive the motion, the lower the rank */
const DISRUPTIVE_ORDER = [
  'adjourn', 'suspend', 'pause', 'tour', 'unmod', 'cow', 'free',
  'mod', 'prolong', 'open', 'doc', 'pvote', 'svote', 'other',
];

function disruptiveRank(key) {
  const i = DISRUPTIVE_ORDER.indexOf(key);
  return i === -1 ? DISRUPTIVE_ORDER.length : i;
}

function _fileCount(p) {
  if(p.fileIds && p.fileIds.length) return p.fileIds.length;
  return p.fileId ? 1 : 0;
}

/**
 * Full MUN precedence comparator (negative = a is more disruptive).
 * Type rank orders first; within one type, standard convention breaks ties:
 * caucuses and other timed motions by longer total time, then longer
 * per-delegate speaking time (covers mod/unmod/cow/free/pause/prolong);
 * tours by longer per-delegate time; document and substantive-vote motions
 * by how many documents they attach. Equal motions keep their existing
 * (chronological) order - Array#sort is stable here.
 */
function compareDisruptive(a, b) {
  const rank = disruptiveRank(a.type) - disruptiveRank(b.type);
  if(rank !== 0) return rank;

  const pa = a.params || {};
  const pb = b.params || {};
  const tot = (pb.totTime || 0) - (pa.totTime || 0);
  if(tot !== 0) return tot;
  const each = (pb.eachTime || 0) - (pa.eachTime || 0);
  if(each !== 0) return each;
  return _fileCount(pb) - _fileCount(pa);
}

/**
 * Whether this stored motion name is just the type's default label
 * (in either language) - such names should be translated at render
 * time instead of shown as frozen at creation.
 */
function isDefaultName(motion, dict) {
  const entry = dict[get(motion.type).labelKey];
  return Boolean(entry && (motion.name === entry.zh || motion.name === entry.en));
}

module.exports = {
  TYPES,
  get,
  label,
  labelKey,
  hasField,
  disruptiveRank,
  compareDisruptive,
  isDefaultName,
};
