const Vue = require('vue');
const fs = require('fs');

const TimerPageView = Vue.extend({
  template: fs.readFileSync(`${__dirname}/timerpage.html`).toString('utf-8'),
  props: [
    'focusTimer',
    'authorized',
  ],

  data: () => ({
    renaming: false,
    renameInput: '',
    editFlag: false,
    timerValue: 0,
    timerLeft: 0,
  }),

  methods: {
    toggle() {
      if(this.focusTimer.active)
        this.$dispatch('manipulate-timer', 'stop', this.focusTimer.id);
      else if(this.focusTimer.left === 0)
        this.$dispatch('manipulate-timer', 'restart', this.focusTimer.id);
      else this.$dispatch('manipulate-timer', 'start', this.focusTimer.id);
    },

    reset() {
      this.$dispatch('manipulate-timer', 'reset', this.focusTimer.id);
    },

    edit() {
      if(this.focusTimer.active) return;
      this.timerValue = this.focusTimer.value;
      this.timerLeft = this.focusTimer.left;
      this.editFlag = true;
    },

    performEdit() {
      if(this.timerValue <= 0) return;
      const valueChanged = this.timerValue !== this.focusTimer.value;
      if(valueChanged)
        this.$dispatch('update-timer', this.focusTimer.id, this.timerValue);

      // Remaining time follows the modal; a value edit alone resets it
      const resulting = valueChanged ? this.timerValue : this.focusTimer.left;
      const wanted = Math.min(this.timerLeft, this.timerValue);
      if(wanted !== resulting)
        this.$dispatch('update-timer-left', this.focusTimer.id, wanted);

      this.editFlag = false;
    },

    remove() {
      if(!confirm(`${this.t('deleteTimerConfirm')}「${this.focusTimer.name}」?`)) return;
      this.$dispatch('remove-item', 'timer', this.focusTimer.id);
    },

    startRename() {
      if(!this.authorized) return;

      this.renaming = true;
      this.renameInput = this.focusTimer.name;

      this.$nextTick(() => {
        const input = this.$el.querySelector('.list-brand-input');
        if(input) input.focus();
      });
    },

    dispatchRename() {
      if(this._renameDebounce) clearTimeout(this._renameDebounce);
      this._renameDebounce = setTimeout(() => {
        const name = this.renameInput.trim();
        if(name === '' || name === this.focusTimer.name) return;

        this.$dispatch('rename-item', 'timer', this.focusTimer.id, name);
      }, 300);
    },
  },

  events: {
    'fab-primary': function fabPrimary() {
      if(this.authorized) this.toggle();
    },
  },

  computed: {
    progressOffset() {
      if(this.focusTimer.value === 0) return 'translateX(0)';
      const pct = 100 - (100 * this.focusTimer.left / this.focusTimer.value);
      return `translateX(-${pct}%)`;
    },
  },
});

module.exports = TimerPageView;
