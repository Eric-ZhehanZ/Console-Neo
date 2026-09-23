const Vue = require('vue');
const fs = require('fs');

const VoteView = Vue.extend({
  template: fs.readFileSync(`${__dirname}/votes.html`).toString('utf-8'),
  props: [
    'notesMeta',
    'votes',
    'seats',
    'authorized',
    {
      name: 'searchInput',
      default: '',
    },
  ],

  data: () => ({
    activeOnly: false,
    addFlag: false,
    inputName: '',
    inputRounds: 1,
    inputTarget: 0,
    isSubstantive: true,

    renameId: null,
    renameInput: '',
  }),

  methods: {
    hasNote(key) {
      return Boolean(this.notesMeta && this.notesMeta[key]);
    },

    note(item) {
      this.$dispatch('open-note', `vote:${item.id}`,
        this.tf('noteEntityTitle', { name: item.name }));
    },

    toggleRename(vote) {
      if(this.renameId === vote.id) {
        this.renameId = null;
        return;
      }

      this.renameId = vote.id;
      this.renameInput = vote.name;

      this.$nextTick(() => {
        const input = this.$el.querySelector('.vote-rename-input');
        if(input) input.focus();
      });
    },

    dispatchRename(vote) {
      if(this._renameDebounce) clearTimeout(this._renameDebounce);
      this._renameDebounce = setTimeout(() => {
        const name = this.renameInput.trim();
        if(name === '' || name === vote.name) return;

        this.$dispatch('rename-item', 'vote', vote.id, name);
      }, 300);
    },

    remove(vote) {
      if(!confirm(`${this.t('deleteVoteConfirm')}「${vote.name}」?`)) return;
      this.$dispatch('remove-item', 'vote', vote.id);
    },
    add() {
      this.addFlag = true;
      this.inputName = '';
      this.inputRounds = 0;
      this.inputTarget = 0;
      this.isSubstantive = true;
    },

    discardAddition() {
      this.addFlag = false;
    },

    performAddition() {
      if(this.inputName.length === 0) return;

      this.$dispatch('add-vote',
                     this.inputName,
                     this.isSubstantive ? -1 : this.inputTarget,
                     this.inputRounds,
                     this.seats.filter(e => e.present).map(e => e.name));

      this.addFlag = false;
    },

    viewVote(vote) {
      this.$dispatch('view-vote', vote);
    },

    setToHalf() {
      this.inputTarget = Math.floor(this.presentCount / 2) + 1;
    },

    setToTwoThird() {
      this.inputTarget = Math.ceil(this.presentCount * 2 / 3);
    },

    countVotes(vote, target) {
      return vote.matrix.reduce((prev, e) => e.vote === target ? prev + 1 : prev, 0);
    },

    getFileTwoThird(vote) {
      return Math.ceil((vote.matrix.length - this.countVotes(vote, -1)) * 2 / 3);
    },
  },

  events: {
    'modal-esc': function modalEsc() {
      if(this.addFlag) this.discardAddition();
    },
    'modal-submit': function modalSubmit() {
      if(this.addFlag) this.performAddition();
    },
    'fab-primary': function fabPrimary() {
      if(this.authorized && !this.addFlag) this.add();
    },
  },

  computed: {
    shownItems() {
      if(!this.activeOnly) return this.votes;
      return this.votes.filter(v => v.status && v.status.running);
    },

    presentCount() {
      return this.seats.reduce((prev, e) => e.present ? prev + 1 : prev, 0);
    },
  },
});

module.exports = VoteView;
