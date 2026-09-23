// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

const Vue = require('vue');
const fs = require('fs');
const i18n = require('../../../shared/i18n');
const motionTypes = require('../../../shared/motion-types');

const OUTCOME_KEY = {
  pending: 'outcomePending',
  passed: 'outcomePassed',
  failed: 'outcomeFailed',
  withdrawn: 'outcomeWithdrawn',
};

const ENTRY_ICONS = {
  'motion-add': 'gavel',
  'motion-outcome': 'gavel',
  'speech-start': 'record_voice_over',
};

const DelegateView = Vue.extend({
  template: fs.readFileSync(`${__dirname}/delegate.html`).toString('utf-8'),
  props: [
    'delegateFocus',
    'delegates',
    'motions',
    'history',
    'lists',
    'notesMeta',
    'authorized',
  ],

  methods: {
    formatTime(time) {
      const d = new Date(time);
      const pad = n => (n < 10 ? `0${n}` : `${n}`);
      return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    formatDuration(t) {
      const pad = n => (n < 10 ? `0${n}` : `${n}`);
      const v = t || 0;
      const h = Math.floor(v / 3600);
      const m = Math.floor((v % 3600) / 60);
      const s = v % 60;
      if(h > 0) return `${h}:${pad(m)}:${pad(s)}`;
      return `${m}:${pad(s)}`;
    },

    outcomeKey(outcome) {
      return OUTCOME_KEY[outcome] || outcome;
    },

    displayName(motion) {
      if(motionTypes.isDefaultName(motion, i18n.DICT))
        return this.t(motionTypes.get(motion.type).labelKey);
      return motion.name;
    },

    typeLabel(key) {
      const lk = motionTypes.labelKey(key);
      return lk ? this.t(lk) : motionTypes.label(key);
    },

    timerInfo(motion) {
      const p = motion.params || {};
      const parts = [];
      if(p.totTime) parts.push(this.formatDuration(p.totTime));
      if(p.eachTime) parts.push(`${this.formatDuration(p.eachTime)}${this.t('perPersonSuffix')}`);
      return parts.join(' · ');
    },

    docInfo(motion) {
      const p = motion.params || {};
      if(p.fileNames && p.fileNames.length > 0) return p.fileNames.join(' · ');
      return null;
    },

    noteMotion(motion) {
      this.$dispatch('open-note', `motion:${motion.id}`,
        this.tf('noteMotionTitle', { who: motion.proposer, name: motion.name }));
    },

    /** Resolves a history entry to a live entity whose note can open */
    entryNote(entry) {
      const d = entry.data || {};
      if(entry.type === 'motion-add' || entry.type === 'motion-outcome') {
        const m = (this.motions || [])
          .filter(x => x.name === d.name && x.proposer === d.proposer)[0];
        if(m)
          return {
            key: `motion:${m.id}`,
            title: this.tf('noteMotionTitle', { who: m.proposer, name: m.name }),
          };
      } else if(entry.type === 'speech-start' && d.speaker) {
        const l = (this.lists || []).filter(x => x.name === d.list)[0];
        const seat = l && l.seats.filter(x => x.name === d.speaker)[0];
        if(seat && seat.uid)
          return {
            key: `seat:${l.id}:${seat.uid}`,
            title: this.tf('noteSeatTitle', { who: d.speaker, name: l.name }),
          };
      }
      return null;
    },

    openEntryNote(entry) {
      const target = this.entryNote(entry);
      if(target) this.$dispatch('open-note', target.key, target.title);
    },

    entryIcon(entry) {
      return ENTRY_ICONS[entry.type] || 'info_outline';
    },

    openNoteRow(row) {
      this.$dispatch('open-note', row.key, row.title);
    },

    entryLabel(entry) {
      const d = entry.data || {};
      const en = i18n.store.lang === 'en';
      if(entry.type === 'speech-start') {
        const dur = d.duration ? ` · ${this.formatDuration(d.duration)}` : '';
        return (en ? `Spoke on: ${d.list}` : `发言：${d.list}`) + dur;
      }
      if(entry.type === 'motion-add')
        return en ? `Proposed motion: ${d.name}` : `提出动议：${d.name}`;
      if(entry.type === 'motion-outcome') {
        const outcome = this.t(OUTCOME_KEY[d.outcome] || d.outcome);
        return en ? `Motion "${d.name}" — ${outcome}` : `动议「${d.name}」结果：${outcome}`;
      }
      return entry.type;
    },
  },

  computed: {
    stats() {
      return (this.delegates && this.delegates[this.delegateFocus])
        || { speeches: 0, spokenTime: 0, motions: 0 };
    },

    avgSpeech() {
      if(!this.stats.speeches) return 0;
      return Math.round(this.stats.spokenTime / this.stats.speeches);
    },

    passedCount() {
      return this.theirMotions.filter(m => m.outcome === 'passed').length;
    },

    passRate() {
      if(this.theirMotions.length === 0) return 0;
      return Math.round((this.passedCount / this.theirMotions.length) * 100);
    },

    theirMotions() {
      return (this.motions || []).filter(m => m.proposer === this.delegateFocus);
    },

    speechEntries() {
      return (this.history || [])
        .filter(e => e.type === 'speech-start' && e.data && e.data.speaker === this.delegateFocus)
        .slice(0, 150);
    },

    timeline() {
      const name = this.delegateFocus;
      return (this.history || []).filter(e => {
        const d = e.data || {};
        if(e.type === 'speech-start') return d.speaker === name;
        if(e.type === 'motion-add' || e.type === 'motion-outcome') return d.proposer === name;
        return false;
      }).slice(0, 150);
    },

    /**
     * Notes touching this delegate: their motions and presentations
     * directly, plus any note whose text mentions their name.
     */
    relatedNotes() {
      const name = this.delegateFocus;
      const meta = this.notesMeta || {};
      const out = [];

      for(const key of Object.keys(meta)) {
        let label = null;
        let title = null;
        let direct = false;

        if(key.indexOf('motion:') === 0) {
          const m = (this.motions || []).filter(x => `motion:${x.id}` === key)[0];
          if(m) {
            label = m.name;
            title = this.tf('noteMotionTitle', { who: m.proposer, name: m.name });
            direct = m.proposer === name;
          }
        } else if(key.indexOf('seat:') === 0) {
          const parts = key.split(':');
          const l = (this.lists || []).filter(x => x.id === parts[1])[0];
          const seat = l && l.seats.filter(x => x.uid === parts[2])[0];
          if(seat) {
            label = `${seat.name} · ${l.name}`;
            title = this.tf('noteSeatTitle', { who: seat.name, name: l.name });
            direct = seat.name === name;
          }
        } else if(key.indexOf('list:') === 0) {
          const l = (this.lists || []).filter(x => `list:${x.id}` === key)[0];
          if(l) {
            label = l.name;
            title = this.tf('noteEntityTitle', { name: l.name });
          }
        }

        const mentions = name && (meta[key].text || '').indexOf(name) !== -1;
        if(direct || mentions)
          out.push({
            key,
            label: label || key,
            title: title || this.t('openNote'),
            mentions: !direct && mentions,
          });
      }

      return out;
    },
  },
});

module.exports = DelegateView;
