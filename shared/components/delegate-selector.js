const Vue = require('vue');
const fs = require('fs');
const pinyin = require('pinyin');

// Pinyin conversion is expensive; each name is converted exactly once
const pinyinCache = new Map();

function nameKeys(name) {
  const hit = pinyinCache.get(name);
  if(hit) return hit;

  const lower = String(name).toLowerCase();
  let full = '';
  let initials = '';
  try {
    const py = pinyin(name, { style: pinyin.STYLE_NORMAL, heteronym: false });
    full = py.map(seg => seg[0] || '').join('').toLowerCase();
    initials = py.map(seg => (seg[0] || '').charAt(0)).join('').toLowerCase();
  } catch(e) { }

  const keys = [lower, full, initials].filter(k => k);
  pinyinCache.set(name, keys);
  if(pinyinCache.size > 3000) pinyinCache.clear();
  return keys;
}

function subsequence(query, key) {
  let qi = 0;
  for(let ki = 0; ki < key.length && qi < query.length; ++ki)
    if(key[ki] === query[qi]) ++qi;
  return qi === query.length;
}

/**
 * Delegate name input with autocompletion.
 * Prefix matches (raw text or pinyin) come first; fuzzy matches follow, dimmed.
 * Events: commit (enter), cancel (esc).
 */
const DelegateSelector = Vue.extend({
  template: fs.readFileSync(`${__dirname}/delegate-selector.html`).toString('utf-8'),
  props: [
    { name: 'value', twoWay: true },
    'candidates',
    'placeholder',
    'stats',
    'exclude',
  ],

  data: () => ({
    focused: false,
    hi: -1,
    viewStart: 0,
  }),

  ready() {
    this.$els.input.focus();
  },

  computed: {
    nameIndex() {
      return (this.candidates || []).map(name => ({ name, keys: nameKeys(name) }));
    },

    query() {
      return (this.value || '').trim().toLowerCase();
    },

    exact() {
      if(!this.query) return [];
      return this.nameIndex
        .filter(e => e.name !== this.value && e.keys.some(k => k.indexOf(this.query) === 0))
        .map(e => e.name)
        .slice(0, 5);
    },

    fuzzy() {
      if(!this.query) return [];

      const taken = {};
      for(const name of this.exact) taken[name] = true;

      return this.nameIndex
        .filter(e => !taken[e.name] && e.name !== this.value
          && e.keys.some(k => k.indexOf(this.query) > 0 || subsequence(this.query, k)))
        .map(e => e.name)
        .slice(0, 5);
    },

    /**
     * With nothing typed: suggest present delegates who have engaged least,
     * ranked by speeches, speaking time and motions proposed (ascending),
     * skipping anyone already queued (exclude).
     */
    suggestions() {
      if(this.query) return [];
      const cands = this.candidates || [];
      if(cands.length === 0 || !this.stats) return [];

      const excluded = {};
      for(const n of this.exclude || []) excluded[n] = true;

      const score = (name) => {
        const s = this.stats[name] || {};
        return ((s.speeches || 0) * 90) + (s.spokenTime || 0) + ((s.motions || 0) * 60);
      };

      return cands.filter(n => !excluded[n] && n !== this.value)
        .slice()
        .sort((a, b) => score(a) - score(b))
        .slice(0, 10);
    },

    flat() {
      if(!this.query) return this.suggestions;
      return this.exact.concat(this.fuzzy);
    },

    /* At most 4 rows visible; arrow keys slide the window over the rest */
    visible() {
      return this.flat.slice(this.viewStart, this.viewStart + 4);
    },

    showList() {
      return this.focused && this.flat.length > 0;
    },
  },

  methods: {
    onInput() {
      this.hi = -1;
      this.viewStart = 0;
    },

    /* Backspace with nothing typed steps backwards through the list */
    onBackspace() {
      if((this.value || '').length === 0) this.$emit('backspace');
    },

    onBlur() {
      // Delayed so a mousedown on an entry lands first
      setTimeout(() => {
        this.focused = false;
        // Clicking away with an exact delegate name typed saves it
        const q = (this.value || '').trim().toLowerCase();
        if(!q) return;
        const match = (this.candidates || [])
          .filter(n => String(n).toLowerCase() === q)[0];
        if(match) {
          this.value = match; // canonical casing
          this.$emit('autosave');
        }
      }, 150);
    },

    move(delta) {
      if(this.flat.length === 0) return;
      let next = this.hi + delta;
      if(next < 0) next = this.flat.length - 1;
      if(next >= this.flat.length) next = 0;
      this.hi = next;
      // keep the highlight inside the 4-row window
      if(this.hi < this.viewStart) this.viewStart = this.hi;
      else if(this.hi >= this.viewStart + 4) this.viewStart = this.hi - 3;
    },

    complete() {
      if(this.flat.length === 0) return;
      this.pick(this.flat[this.hi >= 0 ? this.hi : 0], true);
    },

    pick(name, keepOpen) {
      this.value = name;
      this.hi = -1;
      this.viewStart = 0;
      if(!keepOpen) this.focused = false;
      this.$els.input.focus();
    },

    onEnter() {
      if(this.hi >= 0 && this.flat[this.hi]) {
        this.pick(this.flat[this.hi]);
        return;
      }
      this.focused = false;
      this.$emit('commit');
    },

    onEsc() {
      if(this.showList) {
        this.focused = false;
        return;
      }
      this.$emit('cancel');
    },
  },
});

Vue.component('delegate-selector', DelegateSelector);

module.exports = DelegateSelector;
