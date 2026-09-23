// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

/* About window: version, copyright, attribution, and the license files
   (AGPL Section 5(d) Appropriate Legal Notices, Section 7 attribution) */

const Vue = require('vue');
const { ipcRenderer, shell } = require('electron');
require('../shared/i18n');
const source = require('../shared/source');

const params = new URLSearchParams(window.location.search);

const DOC_LABELS = {
  LICENSE: 'docLicense',
  NOTICE: 'docNotice',
  'LICENSES/MIT.txt': 'docMit',
  'THIRD_PARTY_NOTICES.md': 'docThirdParty',
};

function setup() { // eslint-disable-line no-unused-vars
  // eslint-disable-next-line no-new
  new Vue({
    el: 'body',
    data: {
      version: source.version,
      // The host a remote client is connected to may run another version
      hostVersion: params.get('host') || '',
      copyright: source.COPYRIGHT,
      attribution: source.ATTRIBUTION,
      docs: source.LEGAL_DOCS.map(file => ({ file, label: DOC_LABELS[file] })),
    },
    methods: {
      openDoc(file) {
        ipcRenderer.send('openLegalDoc', file);
      },
      openSource(ver) {
        shell.openExternal(source.sourceUrl(ver));
      },
      mail(address) {
        shell.openExternal(`mailto:${address}`);
      },
    },
  });
}
