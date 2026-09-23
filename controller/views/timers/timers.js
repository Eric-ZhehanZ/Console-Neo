const Vue = require('vue');
const fs = require('fs');

const TimersView = Vue.extend({
  template: fs.readFileSync(`${__dirname}/timers.html`).toString('utf-8'),
  props: [
    'notesMeta',
    'timers',
    'authorized',
    {
      name: 'searchInput',
      default: '',
    },
  ],
  data: () => ({
    activeOnly: false,
    editFlag: false,
    timerName: '',
    timerValue: 0,
    timerLeft: 0,
    timerId: 0,
    additionMode: false,
  }),
  computed: {
    shownItems() {
      if(!this.activeOnly) return this.timers;
      return this.timers.filter(t => t.active);
    },
  },

  events: {
    'modal-esc': function modalEsc() {
      this.editFlag = false;
    },
    'modal-submit': function modalSubmit() {
      if(this.editFlag) this.performEdit();
    },
    'fab-primary': function fabPrimary() {
      if(this.authorized && !this.editFlag) this.add();
    },
  },

  methods: {
    hasNote(key) {
      return Boolean(this.notesMeta && this.notesMeta[key]);
    },

    note(item) {
      this.$dispatch('open-note', `timer:${item.id}`,
        this.tf('noteEntityTitle', { name: item.name }));
    },

    add() {
      this.timerName = '';
      this.timerValue = 0;
      this.editFlag = true;
      this.additionMode = true;
    },

    edit(timer) {
      if(timer.active) return;

      this.timerId = timer.id;
      this.timerName = timer.name;
      this.timerValue = timer.value;
      this.timerLeft = timer.left;
      this.originalName = timer.name;
      this.originalValue = timer.value;
      this.originalLeft = timer.left;

      this.additionMode = false;
      this.editFlag = true;
    },

    remove(timer) {
      if(!confirm(`${this.t('deleteTimerConfirm')}「${timer.name}」?`)) return;
      this.$dispatch('remove-item', 'timer', timer.id);
    },

    discardEdit() {
      this.editFlag = false;
    },

    performEdit() {
      if(this.timerName === '' || this.timerValue <= 0) return;
      if(this.additionMode) this.$dispatch('add-timer', this.timerName, this.timerValue);
      else {
        const valueChanged = this.timerValue !== this.originalValue;
        if(valueChanged)
          this.$dispatch('update-timer', this.timerId, this.timerValue);

        // Remaining time follows the modal; a value edit alone resets it
        const resulting = valueChanged ? this.timerValue : this.originalLeft;
        const wanted = Math.min(this.timerLeft, this.timerValue);
        if(wanted !== resulting)
          this.$dispatch('update-timer-left', this.timerId, wanted);

        if(this.timerName !== this.originalName)
          this.$dispatch('rename-item', 'timer', this.timerId, this.timerName);
      }
      this.editFlag = false;
    },

    toggle(timer) {
      if(timer.active) this.$dispatch('manipulate-timer', 'stop', timer.id);
      else if(timer.left === 0) this.$dispatch('manipulate-timer', 'restart', timer.id);
      else this.$dispatch('manipulate-timer', 'start', timer.id);
    },

    view(timer) {
      this.$dispatch('view-timer', timer);
    },

    isStandaloneTimer(timer) {
      return timer.type === 'standalone';
    },
  },
});

module.exports = TimersView;
