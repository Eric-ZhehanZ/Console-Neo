// SPDX-License-Identifier: AGPL-3.0-or-later AND MIT
// Copyright (C) 2016 Liu Xiaoyi
// Copyright (C) 2018 Pan Ruizhe
// Modifications Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE, NOTICE, and LICENSES/MIT.txt for terms.

const Vue = require('vue');
const fs = require('fs');
const util = require('../../../shared/util.js');

const HomeView = Vue.extend({
  template: fs.readFileSync(`${__dirname}/home.html`).toString('utf-8'),
  props: ['timers', 'votes', 'lists', 'confTitle', 'authorized',
    'serverCode', 'serverReaderCode', 'serverId', 'isLocalServer',
    'netOk', 'relayOk', 'netChecking', 'relayChecking', 'collabOk'],

  data: () => ({
    renaming: false,
    renameInput: '',
  }),

  methods: {
    startRename() {
      if(!this.authorized) return;

      this.renaming = true;
      this.renameInput = this.confTitle;

      this.$nextTick(() => {
        const input = this.$el.querySelector('.home-title-input');
        if(input) {
          input.style.height = 'auto';
          input.style.height = `${input.scrollHeight}px`;
          input.focus();
        }
      });
    },

    onRenameInput(e) {
      e.target.style.height = 'auto';
      e.target.style.height = `${e.target.scrollHeight}px`;

      if(this._renameDebounce) clearTimeout(this._renameDebounce);
      this._renameDebounce = setTimeout(() => {
        const name = this.renameInput.trim();
        if(name === '' || name === this.confTitle) return;
        this.$dispatch('rename-conf', name);
      }, 400);
    },

    navigateTo(dest) {
      this.$dispatch('navigate', dest);
    },

    activeList(list) {
      return util.isListActive(list);
    },

    viewList(list) {
      this.$dispatch('view-list', list);
    },

    activeStandaloneTimer(timer) {
      return timer.type === 'standalone' && timer.active;
    },

    gotoTimer(name) {
      this.$dispatch('navigate', 'timers', { search: name });
    },

    activeVote(vote) {
      if(vote.rounds > 0 && vote.status.iteration > 0 && vote.status.iteration < vote.rounds)
        return true;

      return vote.status.running;
    },

    countVotes(vote, target) {
      return vote.matrix.reduce((prev, e) => e.vote === target ? prev + 1 : prev, 0);
    },

    getVoteTarget(vote) {
      if(vote.target > 0) return vote.target;
      if(vote.target === -1)
        return Math.ceil((vote.matrix.length - this.countVotes(vote, -1)) * 2 / 3);
      return 0;
    },

    viewVote(vote) {
      this.$dispatch('view-vote', vote);
    },
  },
});

module.exports = HomeView;
