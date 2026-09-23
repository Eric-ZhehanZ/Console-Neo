// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

const Vue = require('vue');
const fs = require('fs');
const i18n = require('../../../shared/i18n');

const OUTCOME_KEY = {
  pending: 'outcomePending',
  passed: 'outcomePassed',
  failed: 'outcomeFailed',
  withdrawn: 'outcomeWithdrawn',
};

const ENTRY_ICONS = {
  'motion-add': 'gavel',
  'motion-outcome': 'gavel',
  'vote-add': 'thumbs_up_down',
  'vote-round-start': 'thumbs_up_down',
  'vote-round-end': 'thumbs_up_down',
  'list-add': 'record_voice_over',
  'speech-start': 'record_voice_over',
  'timer-add': 'timer',
  'file-add': 'folder',
};

const StatsView = Vue.extend({
  template: fs.readFileSync(`${__dirname}/stats.html`).toString('utf-8'),
  props: [
    'notesMeta',
    'motions',
    'votes',
    'lists',
    'files',
    'timers',
    'seats',
    'history',
    'spokenTime',
    'brand',
    'delegates',
    'authorized',
  ],

  data: () => ({
    brandInput: '',
    // Active sort columns in click order: the first entry compares first.
    // Each column cycles off -> default direction -> reversed -> off.
    sortKeys: [],
  }),

  created() {
    this.brandInput = this.brand || '';
  },

  watch: {
    brand(value) {
      this.brandInput = value || '';
    },
  },

  methods: {
    applyBrand() {
      this.$dispatch('set-brand', this.brandInput.trim());
    },

    setSort(key) {
      // metrics default to descending, names ascending
      const dft = key === 'name' ? 1 : -1;
      for(let i = 0; i < this.sortKeys.length; ++i)
        if(this.sortKeys[i].key === key) {
          if(this.sortKeys[i].dir === dft) this.sortKeys[i].dir = -dft;
          else this.sortKeys.splice(i, 1);
          return;
        }

      this.sortKeys.push({ key, dir: dft });
      // At most three columns participate; the oldest one drops out
      if(this.sortKeys.length > 3) this.sortKeys.shift();
    },

    sortState(key) {
      for(let i = 0; i < this.sortKeys.length; ++i)
        if(this.sortKeys[i].key === key)
          return { order: i + 1, dir: this.sortKeys[i].dir };
      return null;
    },

    sortIcon(key) {
      const s = this.sortState(key);
      if(!s) return '';
      return s.dir === 1 ? 'arrow_upward' : 'arrow_downward';
    },

    openDelegate(name) {
      this.$dispatch('view-delegate', name);
    },

    /** Resolves a history entry to a live entity whose note can open */
    noteTarget(entry) {
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
      } else if(entry.type === 'list-add') {
        const l = (this.lists || []).filter(x => x.name === d.name)[0];
        if(l)
          return {
            key: `list:${l.id}`,
            title: this.tf('noteEntityTitle', { name: l.name }),
          };
      }
      return null;
    },

    openEntryNote(entry) {
      const target = this.noteTarget(entry);
      if(target) this.$dispatch('open-note', target.key, target.title);
    },

    entryHasNote(entry) {
      const target = this.noteTarget(entry);
      return Boolean(target && this.notesMeta && this.notesMeta[target.key]);
    },

    formatTime(time) {
      const d = new Date(time);
      const pad = n => (n < 10 ? `0${n}` : `${n}`);
      return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    formatDuration(t) {
      const pad = n => (n < 10 ? `0${n}` : `${n}`);
      const h = Math.floor(t / 3600);
      const m = Math.floor((t % 3600) / 60);
      const s = t % 60;
      if(h > 0) return `${h}:${pad(m)}:${pad(s)}`;
      return `${m}:${pad(s)}`;
    },

    entryIcon(entry) {
      return ENTRY_ICONS[entry.type] || 'info_outline';
    },

    entryText(entry) {
      const d = entry.data || {};
      const en = i18n.store.lang === 'en';
      const outcome = this.t(OUTCOME_KEY[d.outcome] || d.outcome);
      switch (entry.type) {
        case 'motion-add':
          return en ? `Motion: ${d.name} (by ${d.proposer})` : `动议：${d.name}（${d.proposer} 提出）`;
        case 'motion-outcome':
          return en ? `Motion "${d.name}" — ${outcome}` : `动议「${d.name}」结果：${outcome}`;
        case 'vote-add':
          return en ? `New vote: ${d.name} (${d.seatCount} seats)`
            : `新投票：${d.name}（${d.seatCount} 席参与）`;
        case 'vote-round-start':
          return en ? `Vote "${d.name}" round ${d.iteration} started`
            : `投票「${d.name}」第 ${d.iteration} 轮开始`;
        case 'vote-round-end':
          return en ? `Vote "${d.name}" round ${d.iteration} ended `
            + `(For ${d.positive} / Against ${d.negative} / Abstain ${d.abstained}`
            + ` / Pass / No Vote ${d.passOrNoVote || 0})`
            : `投票「${d.name}」第 ${d.iteration} 轮结束`
            + `（赞成 ${d.positive} / 反对 ${d.negative} / 弃权 ${d.abstained}`
            + ` / 过 / 未投票 ${d.passOrNoVote || 0}）`;
        case 'list-add':
          return en ? `New speakers’ list: ${d.name}` : `新发言名单：${d.name}`;
        case 'speech-start': {
          const dur = d.duration ? ` · ${this.formatDuration(d.duration)}` : '';
          if(d.speaker)
            return (en ? `${d.speaker} began speaking (${d.list})`
              : `${d.speaker} 开始发言（${d.list}）`) + dur;
          return (en ? `Speakers’ list "${d.list}" timer started`
            : `发言名单「${d.list}」计时开始`) + dur;
        }
        case 'timer-add':
          return `${en ? `New timer: ${d.name}` : `新计时器：${d.name}`}`
            + `${d.value ? ` · ${this.formatDuration(d.value)}` : ''}`;
        case 'file-add':
          return en ? `New document: ${d.name}` : `新文件：${d.name}`;
        default:
          return entry.type;
      }
    },
  },

  computed: {
    spokenFormatted() {
      const t = this.spokenTime || 0;
      const pad = n => (n < 10 ? `0${n}` : `${n}`);
      const h = Math.floor(t / 3600);
      const m = Math.floor((t % 3600) / 60);
      const s = t % 60;
      if(h > 0) return `${h}:${pad(m)}:${pad(s)}`;
      return `${m}:${pad(s)}`;
    },

    passedCount() {
      return this.motions.reduce((prev, e) => e.outcome === 'passed' ? prev + 1 : prev, 0);
    },

    failedCount() {
      return this.motions.reduce((prev, e) => e.outcome === 'failed' ? prev + 1 : prev, 0);
    },

    voteRounds() {
      return this.votes.reduce((prev, e) => prev + (e.status ? e.status.iteration : 0), 0);
    },

    presentCount() {
      return this.seats.reduce((prev, e) => e.present ? prev + 1 : prev, 0);
    },

    /* Rendering thousands of rows makes the page crawl - cap the log */
    shownHistory() {
      return (this.history || []).slice(0, 300);
    },

    totalSpeeches() {
      let n = 0;
      for(const name of Object.keys(this.delegates)) n += this.delegates[name].speeches || 0;
      return n;
    },

    avgSpeech() {
      if(this.totalSpeeches === 0) return 0;
      return Math.round((this.spokenTime || 0) / this.totalSpeeches);
    },

    participation() {
      const present = this.seats.filter(s => s.present);
      if(present.length === 0) return 0;
      const spoke = present
        .filter(s => this.delegates[s.name] && this.delegates[s.name].speeches > 0);
      return Math.round((spoke.length / present.length) * 100);
    },

    delegateRows() {
      const empty = { speeches: 0, spokenTime: 0, motions: 0 };
      const rows = [];
      const seen = {};

      for(const s of this.seats) {
        seen[s.name] = true;
        rows.push(Object.assign(
          { name: s.name, present: s.present, inSeats: true },
          this.delegates[s.name] || empty));
      }

      // Delegates with recorded activity that are no longer on the seat list
      for(const name of Object.keys(this.delegates))
        if(!seen[name])
          rows.push(Object.assign(
            { name, present: false, inSeats: false },
            this.delegates[name]));

      const passedBy = {};
      const proposedBy = {};
      for(const m of this.motions) {
        proposedBy[m.proposer] = (proposedBy[m.proposer] || 0) + 1;
        if(m.outcome === 'passed') passedBy[m.proposer] = (passedBy[m.proposer] || 0) + 1;
      }

      for(const r of rows) {
        r.avg = r.speeches > 0 ? Math.round(r.spokenTime / r.speeches) : 0;
        r.passed = passedBy[r.name] || 0;
        r.proposedNow = proposedBy[r.name] || 0;
        r.passRate = r.proposedNow > 0 ? Math.round((r.passed / r.proposedNow) * 100) : 0;
      }

      const keys = this.sortKeys;
      const metric = (row, key) => {
        if(key === 'present') return row.present ? 1 : 0;
        return row[key] || 0;
      };
      if(keys.length > 0) rows.sort((a, b) => {
        for(const s of keys) {
          let cmp;
          if(s.key === 'name') cmp = String(a.name).localeCompare(String(b.name), 'zh');
          else cmp = metric(a, s.key) - metric(b, s.key);
          if(cmp !== 0) return s.dir * cmp;
        }
        return String(a.name).localeCompare(String(b.name), 'zh');
      });

      return rows;
    },
  },
});

module.exports = StatsView;
