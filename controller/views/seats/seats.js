// SPDX-License-Identifier: AGPL-3.0-or-later AND MIT
// Copyright (C) 2016 Liu Xiaoyi
// Copyright (C) 2018 Pan Ruizhe
// Modifications Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE, NOTICE, and LICENSES/MIT.txt for terms.

const Vue = require('vue');
const fs = require('fs');
const pinyin = require('pinyin');

const SeatsView = Vue.extend({
  template: fs.readFileSync(`${__dirname}/seats.html`).toString('utf-8'),
  props: ['seats', 'authorized'],

  data() {
    return {
      editFlag: false,
    };
  },

  events: {
    'modal-esc': function modalEsc() {
      if(this.editFlag) this.discardEditing();
    },
    'modal-submit': function modalSubmit() {
      if(this.editFlag) this.performEditing();
    },
    'fab-primary': function fabPrimary() {
      if(this.authorized && !this.editFlag) this.edit();
    },
  },

  methods: {
    project() {
      this.$dispatch('project-rollcall');
    },

    edit() {
      this.editFlag = true;
      this.$els.seatsInput.innerHTML = this.seats ? this.seats.map(e => e.name).join('\n') : '';
    },

    performEditing() {
      const str = this.$els.seatsInput.innerHTML
        .replace(/<br>/g, '');
      const seats =
        str.split('\n').filter(e => e.length > 0).map(e => ({ name: e, present: false }));
      this.$dispatch('update-seats', seats);
      this.editFlag = false;
    },

    discardEditing() {
      this.editFlag = false;
    },

    toggleStatus(seat) {
      if(!this.authorized) return;
      // TODO: immutables
      seat.present = !seat.present;
      this.$dispatch('update-seats', this.seats);
    },

    sort() {
      this.$els.seatsInput.innerHTML = this.$els.seatsInput.innerHTML
          .replace(/<br>/g, '')
          .split('\n')
          .filter(e => e.length > 0)
          .map(e => ({
            original: e,
            pinyin: pinyin(e, {
              style: pinyin.STYLE_NORMAL,
              segment: true,
            }),
          }))
          .sort((a, b) => {
            for(let i = 0; i <= a.original.length; ++i) {
              if(i === b.original.length)
                return i === a.original.length ? 0 : 1;
              else if(i === a.original.length) return -1;

              if(a.original.charCodeAt(i) > 127)
                if(b.original.charCodeAt(i) > 127) break;
                else return 1; // b[i] is ascii, a[i] is not
              else if(b.original.charCodeAt(i) > 127)
                return -1; // a[i] is ascii, b[i] is not

              const lc = a.original.charAt(i).localeCompare(b.original.charAt(i));
              if(lc !== 0) return lc;
            }

            for(let i = 0; i < a.pinyin.length; ++i) {
              if(i === b.pinyin.length) return 1; // a > b
              const lc = a.pinyin[i][0].localeCompare(b.pinyin[i][0]);
              if(lc !== 0) return lc;
            }

            if(a.pinyin.length < b.pinyin.length) return -1;
            else return 0;
          })
          .map(e => e.original)
          .join('\n');
    },
  },
});

module.exports = SeatsView;
