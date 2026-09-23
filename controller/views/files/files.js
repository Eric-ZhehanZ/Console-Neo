// SPDX-License-Identifier: AGPL-3.0-or-later AND MIT
// Copyright (C) 2016 Liu Xiaoyi
// Copyright (C) 2018 Pan Ruizhe
// Modifications Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE, NOTICE, and LICENSES/MIT.txt for terms.

const Vue = require('vue');
const fs = require('fs');

const FilesView = Vue.extend({
  template: fs.readFileSync(`${__dirname}/files.html`).toString('utf-8'),
  props: [
    'notesMeta',
    'files',
    'authorized',
    {
      name: 'searchInput',
      default: '',
    },
  ],

  data: () => ({

    renameId: null,
    renameInput: '',
  }),

  methods: {
    hasNote(key) {
      return Boolean(this.notesMeta && this.notesMeta[key]);
    },

    note(item) {
      this.$dispatch('open-note', `file:${item.id}`,
        this.tf('noteEntityTitle', { name: item.name }));
    },

    toggleRename(file) {
      if(this.renameId === file.id) {
        this.renameId = null;
        return;
      }

      this.renameId = file.id;
      this.renameInput = file.name;

      this.$nextTick(() => {
        const input = this.$el.querySelector('.file-rename-input');
        if(input) input.focus();
      });
    },

    dispatchRename(file) {
      if(this._renameDebounce) clearTimeout(this._renameDebounce);
      this._renameDebounce = setTimeout(() => {
        const name = this.renameInput.trim();
        if(name === '' || name === file.name) return;

        this.$dispatch('rename-item', 'file', file.id, name);
      }, 300);
    },

    remove(file) {
      if(!confirm(`${this.t('deleteFileConfirm')}「${file.name}」?`)) return;
      this.$dispatch('remove-item', 'file', file.id);
    },

    drop(e) {
      if(!this.authorized) return;
      const dt = e.dataTransfer;
      if(dt.files.length !== 1) {
        alert(this.t('oneFileOnly'));
        return;
      }

      const name = dt.files[0].name;
      const type = dt.files[0].type;

      fs.readFile(dt.files[0].path, (err, data) => {
        this.$dispatch('add-file', name, type, data);
      });
    },

    viewFile(file) {
      this.$dispatch('view-file', file);
    },

    triggerUpload() {
      this.$els.upload.click();
    },

    handleUpload(e) {
      if(e.target.files.length !== 1) return;

      const name = e.target.files[0].name;
      const type = e.target.files[0].type || 'application/octet-stream';
      const filePath = e.target.files[0].path;

      fs.readFile(filePath, (err, data) => {
        if(err) return void alert(this.t('errReadFile'));
        this.$dispatch('add-file', name, type, data);
        return undefined;
      });

      e.target.value = '';
    },
  },
});

module.exports = FilesView;
