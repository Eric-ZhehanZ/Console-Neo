// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

/* Version, source link, and the notices required by the license (AGPL
   Sections 5(d) and 13, and the Section 7 terms in NOTICE) */

const { version } = require('../package.json');

const REPO_URL = 'https://github.com/Eric-ZhehanZ/Console-Neo';

// Required verbatim by NOTICE, Section 7(b)
const ATTRIBUTION = `Based on Console Neo by Zhehan Zhang (${REPO_URL})`;
const COPYRIGHT = 'Copyright (C) 2026 Zhehan Zhang';

// The files the About window can open, relative to the app root
const LEGAL_DOCS = ['LICENSE', 'NOTICE', 'LICENSES/MIT.txt', 'THIRD_PARTY_NOTICES.md'];

function sourceUrl(ver) {
  return ver ? `${REPO_URL}/tree/v${ver}` : REPO_URL;
}

module.exports = {
  version,
  REPO_URL,
  ATTRIBUTION,
  COPYRIGHT,
  LEGAL_DOCS,
  sourceUrl,
};
