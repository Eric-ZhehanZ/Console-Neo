// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

// Builds THIRD_PARTY_NOTICES.md from license-checker output:
//   npx license-checker --production --json \
//     | node bin/third-party-notices.js > THIRD_PARTY_NOTICES.md
// Identical license texts are printed once and referenced from the table.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const deps = JSON.parse(fs.readFileSync(0, 'utf8'));
const LICENSE_FILE = /^(licen[cs]e|copying|notice)/i;

const texts = [];
function textRef(text) {
  const key = text.replace(/\s+/g, ' ').trim();
  let i = texts.findIndex(t => t.key === key);
  if(i === -1) i = texts.push({ key, text: text.trim() }) - 1;
  return i + 1;
}

function copyrightOf(text, fallback) {
  const line = (text || '').split('\n')
    .map(l => l.trim())
    .find(l => ((/^copyright/i.test(l) && /\d{4}|\(c\)|©/i.test(l))
        || /^(\(c\)|©)\s*\d{4}/i.test(l))
      && !/\[yyyy\]|license to|notice|holders? be liable/i.test(l));
  return line || fallback || '';
}

const rows = [];
for(const [id, info] of Object.entries(deps)) {
  if(id.startsWith('console-neo@')) continue;
  const at = id.lastIndexOf('@');
  const file = info.licenseFile && path.resolve(ROOT, info.licenseFile);
  const isLicense = file && LICENSE_FILE.test(path.basename(file));
  const text = isLicense ? fs.readFileSync(file, 'utf8') : null;
  rows.push({
    name: id.slice(0, at),
    version: id.slice(at + 1),
    license: String(info.licenses),
    copyright: copyrightOf(text, info.publisher),
    ref: text ? textRef(text) : null,
  });
}

// Shipped with the app but not installed through npm
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const apache = textRef(read('packages/ipv4/LICENSE'));
rows.push({
  name: 'jQuery (controller/jquery-3.3.1.min.js)',
  version: '3.3.1',
  license: 'MIT',
  copyright: '(c) JS Foundation and other contributors, https://jquery.org/license',
  ref: null,
}, {
  name: 'local-ipv4-address (packages/ipv4, modified)',
  version: '0.0.2',
  license: 'Apache-2.0',
  copyright: 'Ben Hutchison',
  ref: apache,
}, {
  name: 'Roboto (fonts/)',
  version: '2.001047',
  license: 'Apache-2.0',
  copyright: 'Copyright 2015 Google Inc. All Rights Reserved.',
  ref: apache,
}, {
  name: 'Material Icons (fonts/material.woff2)',
  version: '1.017',
  license: 'Apache-2.0',
  copyright: 'Copyright 2018 Google, Inc. All Rights Reserved.',
  ref: apache,
});
rows.sort((a, b) => a.name.localeCompare(b.name));

const cell = s => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const out = [];
out.push('# Third-party notices', '');
out.push('Console Neo distributions include the third-party software listed below. Each entry',
  'names its license; where the package ships a license file, its text is reproduced under',
  '"License texts" and referenced by number.', '');
out.push('Electron bundles Chromium and other components. Their notices ship inside the',
  'Electron distribution as `LICENSES.chromium.html` (in the app bundle next to the Electron',
  'framework, or beside the executable on Windows and Linux).', '');
out.push(`Generated with \`license-checker --production\`: ${rows.length} entries.`, '');
out.push('| Package | Version | License | Copyright | Text |', '| --- | --- | --- | --- | --- |');
for(const r of rows)
  out.push(`| ${cell(r.name)} | ${cell(r.version)} | ${cell(r.license)} | ${cell(r.copyright)} | `
    + `${r.ref ? `[${r.ref}](#text-${r.ref})` : ''} |`);
out.push('', '## License texts', '');
texts.forEach((t, i) => {
  const body = t.text.replace(/```/g, "'''");
  out.push(`### <a id="text-${i + 1}"></a>${i + 1}`, '', '```text', body, '```', '');
});
process.stdout.write(`${out.join('\n')}\n`);
