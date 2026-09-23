// SPDX-License-Identifier: AGPL-3.0-or-later AND MIT
// Copyright (C) 2016 Liu Xiaoyi
// Copyright (C) 2018 Pan Ruizhe
// Modifications Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE, NOTICE, and LICENSES/MIT.txt for terms.

const Vue = require('vue');
const fs = require('fs');
const reminder = require('../reminder');

const Timer = Vue.extend({
  template: fs.readFileSync(`${__dirname}/timer.html`).toString('utf-8'),
  props: ['time', 'fixHour', 'fixMinute', 'alertValue'],
  computed: {
    hour() {
      return Math.floor(this.time / 3600);
    },

    minute() {
      return Math.floor(this.time / 60) % 60;
    },

    second() {
      return this.time % 60;
    },

    showHour() {
      return this.fixHour || this.hour > 0;
    },

    showMinute() {
      // Countdowns always render as M : SS, never a bare seconds number
      return true;
    },

    minuteStr() {
      if(this.minute >= 10 || !this.showHour) return this.minute;
      else return `0${this.minute}`;
    },

    secondStr() {
      if(this.second >= 10 || !this.showMinute) return this.second;
      else return `0${this.second}`;
    },

    alertActive() {
      if(!this.alertValue || this.time <= 0) return false;
      const dep = reminder.store.rules; // reactive dependency
      return dep && this.time <= reminder.activeThreshold(this.alertValue);
    },
  },
});

Vue.component('timer', Timer);

// Lets templates color icons next to a countdown when it enters alert range
Vue.mixin({
  methods: {
    timerAlertOn(timer) {
      if(!timer || !timer.value || timer.left <= 0) return false;
      const dep = reminder.store.rules; // reactive dependency
      return dep && timer.left <= reminder.activeThreshold(timer.value);
    },
  },
});

module.exports = Timer;
