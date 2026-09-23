// SPDX-License-Identifier: AGPL-3.0-or-later AND MIT
// Copyright (C) 2016 Liu Xiaoyi
// Copyright (C) 2018 Pan Ruizhe
// Modifications Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE, NOTICE, and LICENSES/MIT.txt for terms.

const Vue = require('vue');
const fs = require('fs');

const util = require('../../../shared/util.js');

const VoteView = Vue.extend({
  template: fs.readFileSync(`${__dirname}/vote.html`).toString('utf-8'),
  props: [
    'vote',
    'altHold',
    'authorized',
  ],

  data: () => ({
    mat: [],
    manipulateFlag: false,
    targetVoter: { },
    targetVote: 0,

    autoMode: false,
    autoIndex: 0,
    updatingVote: false,
    _pendingIteration: null,

    VOTE_ROWS: [
      { code: 0, key: 'passOrNoVote' },
      { code: 1, key: 'favor' },
      { code: -2, key: 'against' },
      { code: -1, key: 'abstain' },
    ],
  }),

  transitions: {
    item: {
      enter(el, done) {
        done();
      },

      leave(el, done) {
        done();
      },
    },
  },


  activate(done) {
    // Generate id for voters

    this.mat = [...this.vote.matrix];

    this.vote.matrix.forEach((e, i) => {
      e.originalId = i;
    });

    if(!this.vote.status.running)
      this.rearrange();

    this.$on('vote-rearrange', () => {
      setTimeout(() => {
        // Never shuffle rows while the chair is mid-entry
        if(this.manipulateFlag) return;
        this.rearrange();
      }, 100);
    });

    done();
  },

  methods: {

    rearrange() {
      util.sortVoteMatrix(this.mat);
    },

    start() {
      if(this.vote.status.running) return false;

      const beyondPlannedRounds = this.vote.rounds > 0
        && this.vote.status.iteration >= this.vote.rounds;

      if(beyondPlannedRounds) {
        if(!confirm(this.t('confirmRoundsDone'))) return false;
      } else if(this.emptyCount === 0)
        if(!confirm(this.t('confirmAllVoted'))) return false;

      this._pendingIteration = this.vote.status.iteration + 1;

      this.$dispatch('iterate-vote', this.vote.id, {
        iteration: this._pendingIteration,
        running: true,
      });

      return true;
    },

    autoStart() {
      if(!this.start()) return false;
      this.autoIndex = -1;
      this.autoMode = true;
      this.autoManipulate(0);
      return true;
    },

    autoManipulate(i) {
      if(i === this.mat.length) {
        /*
         * Because in the auto mode
         * The user must have be warned about a empty value at these round
         * Additionally, we have to wait for the broadcast event from the server
         * which is hard to implement,
         * So we use a force stop here
         */

        this.stop(true);
        this.manipulateFlag = false;
        this.autoMode = false;
      } else if(this.mat[i].vote !== 0)
        this.autoManipulate(i + 1);
      else {
        this.autoIndex = i;
        this.manipulate(this.mat[i]);
      }
    },

    stop(force = false) {
      if(!this.vote.status.running) return false;

      if(!force && this.isFinalRound)
        if(this.vote.matrix.some(e => e.vote === 0))
          if(!confirm(this.t('confirmLastRoundEnd'))) return false;

      this.$dispatch('iterate-vote', this.vote.id, {
        iteration: this.vote.status.iteration,
        running: false,
      });

      return true;
    },

    manipulate(voter) {
      if(!this.authorized) return;

      this.targetVoter = voter;
      this.targetVote = voter.vote;
      this.manipulateFlag = true;
    },

    toggleRound() {
      if(this.vote.status.running) this.stop();
      else if(this.emptyCount === 0 || this.altHold) this.start();
      else this.autoStart();
    },

    discardManipulation() {
      if(this.autoMode) {
        if(!confirm(this.t('confirmExitAuto'))) return;
        this.autoMode = false;
      }

      this.manipulateFlag = false;
    },

    performManipulation() {
      if(this.updatingVote) return;
      const voteRunning = this.vote.status.running || this.autoMode;
      if(this.targetVote === 0 && voteRunning && this.isFinalRound)
        if(!confirm(this.t('confirmLastRoundPass'))) return;

      const finish = () => {
        if(this.autoMode)
          this.autoManipulate(this.autoIndex + 1);
        else
          this.manipulateFlag = false;
      };

      if(this.targetVote !== this.targetVoter.vote) { // Changed
        this.updatingVote = true;
        this.$dispatch('update-vote', this.vote.id, this.targetVoter.originalId,
          this.targetVote, (err) => {
            this.updatingVote = false;
            if(!err) finish();
          });
      } else finish();
    },

    project() {
      this.$dispatch('project-vote', this.vote);
    },
  },

  events: {
    'modal-esc': function modalEsc() {
      if(this.manipulateFlag) this.discardManipulation();
    },
    'modal-submit': function modalSubmit() {
      if(this.manipulateFlag) this.performManipulation();
    },
    'fab-primary': function fabPrimary() {
      if(this.authorized && !this.manipulateFlag) this.toggleRound();
    },
  },

  computed: {
    isFinalRound() {
      if(this.vote.rounds <= 0) return false;

      const iteration = this.vote.status.running
        ? this.vote.status.iteration
        : this._pendingIteration;
      return iteration !== null && iteration >= this.vote.rounds;
    },

    roundFabTitle() {
      if(this.vote.status.running)
        return this.tf('endRoundFmt', { n: this.vote.status.iteration });
      const n = this.vote.status.iteration + 1;
      if(this.emptyCount === 0 || this.altHold) return this.tf('startRoundManualFmt', { n });
      return this.tf('startRoundFmt', { n });
    },

    positiveCount() {
      return this.vote.matrix.reduce((prev, e) => e.vote === 1 ? prev + 1 : prev, 0);
    },

    negativeCount() {
      return this.vote.matrix.reduce((prev, e) => e.vote === -2 ? prev + 1 : prev, 0);
    },

    abstainedCount() {
      return this.vote.matrix.reduce((prev, e) => e.vote === -1 ? prev + 1 : prev, 0);
    },

    fileTwoThird() {
      return Math.ceil((this.vote.matrix.length - this.abstainedCount) * 2 / 3);
    },

    emptyCount() {
      return this.vote.matrix.reduce((prev, e) => e.vote === 0 ? prev + 1 : prev, 0);
    },

    voteRoundComplete() {
      return this.vote.status.iteration > 0 && !this.vote.status.running;
    },
  },
});

module.exports = VoteView;
