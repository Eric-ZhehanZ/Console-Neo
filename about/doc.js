// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

/* Shows one bundled license file as plain text, offline */

const fs = require('fs');
const path = require('path');
const { LEGAL_DOCS } = require('../shared/source');

function setup() { // eslint-disable-line no-unused-vars
  const doc = new URLSearchParams(window.location.search).get('doc');
  if(LEGAL_DOCS.indexOf(doc) === -1) return;
  document.title = doc;
  document.getElementById('doc').textContent =
    fs.readFileSync(path.join(__dirname, '..', doc), 'utf8');
}
