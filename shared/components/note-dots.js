// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

const Vue = require('vue');

/*
 * 1-3 dots under every notes icon show how much text a note holds,
 * by char-length percentile across all of this committee's notes.
 * Components using it receive `notesMeta` as a prop. The sorted length
 * table is cached per notesMeta object (it is replaced wholesale on
 * every change), so repeated calls during a render stay cheap.
 */
const lensCache = new WeakMap();

function sortedLens(meta) {
  let lens = lensCache.get(meta);
  if(lens) return lens;
  lens = Object.keys(meta)
    .map(k => (meta[k].text || '').length)
    .filter(l => l > 0)
    .sort((a, b) => a - b);
  lensCache.set(meta, lens);
  return lens;
}

Vue.mixin({
  methods: {
    noteDots(key) {
      const meta = this.notesMeta;
      if(!meta || !key || !meta[key]) return 0;
      const len = (meta[key].text || '').length;
      if(len === 0) return 0;

      const lens = sortedLens(meta);
      const rank = lens.filter(l => l <= len).length / lens.length;
      if(rank <= 1 / 3) return 1;
      if(rank <= 2 / 3) return 2;
      return 3;
    },
  },
});
