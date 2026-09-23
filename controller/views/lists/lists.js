// SPDX-License-Identifier: AGPL-3.0-or-later AND MIT
// Copyright (C) 2016 Liu Xiaoyi
// Copyright (C) 2018 Pan Ruizhe
// Modifications Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE, NOTICE, and LICENSES/MIT.txt for terms.

const Vue = require('vue');
const fs = require('fs');
const util = require('../../../shared/util.js');

const ListsView = Vue.extend({
  template: fs.readFileSync(`${__dirname}/lists.html`).toString('utf-8'),
  props: [
    'notesMeta',
    'lists',
    'authorized',
    {
      name: 'searchInput',
      default: '',
    },
  ],

  data: () => ({
    activeOnly: false,
    addFlag: false,
    name: '',
    totTime: 0,
    eachTime: 60,

    renameId: null,
    renameInput: '',
  }),

  computed: {
    shownItems() {
      if(!this.activeOnly) return this.lists;
      return this.lists.filter(l => util.isListActive(l));
    },
  },

  events: {
    'modal-esc': function modalEsc() {
      this.cancelAdd();
    },
    'modal-submit': function modalSubmit() {
      if(this.addFlag) this.performAdd();
    },
    'fab-primary': function fabPrimary() {
      if(this.authorized && !this.addFlag) this.add();
    },
  },

  methods: {
    hasNote(key) {
      return Boolean(this.notesMeta && this.notesMeta[key]);
    },

    note(item) {
      this.$dispatch('open-note', `list:${item.id}`,
        this.tf('noteEntityTitle', { name: item.name }));
    },

    toggleRename(list) {
      if(this.renameId === list.id) {
        this.renameId = null;
        return;
      }

      this.renameId = list.id;
      this.renameInput = list.name;

      this.$nextTick(() => {
        const input = this.$el.querySelector('.list-rename-input');
        if(input) input.focus();
      });
    },

    dispatchRename(list) {
      if(this._renameDebounce) clearTimeout(this._renameDebounce);
      this._renameDebounce = setTimeout(() => {
        const name = this.renameInput.trim();
        if(name === '' || name === list.name) return;

        this.$dispatch('rename-item', 'list', list.id, name);
      }, 300);
    },

    remove(list) {
      const msg = `${this.t('deleteListConfirm')}「${list.name}」? ${this.t('listTimersDeleted')}`;
      if(!confirm(msg)) return;
      this.$dispatch('remove-item', 'list', list.id);
    },
    add() {
      this.totTime = 0;
      this.eachTime = 60;
      this.name = '';
      this.addFlag = true;
    },

    cancelAdd() {
      this.addFlag = false;
      this.name = '';
      this.totTime = 0;
      this.eachTime = 60;
    },

    performAdd() {
      if(this.eachTime === 0) return;
      if(this.name === '') return;

      this.$dispatch('add-list', this.name, [], this.totTime, this.eachTime);
      this.addFlag = false;
    },

    project(list) {
      this.$dispatch('project-list', list);
    },

    navigateTo(list) {
      this.$dispatch('view-list', list);
    },
  },
});

module.exports = ListsView;
