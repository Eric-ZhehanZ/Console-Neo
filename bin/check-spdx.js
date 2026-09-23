// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

// Lists tracked source files that lack an SPDX-License-Identifier header.
// Usage: node bin/check-spdx.js   (exits 1 when any file is missing one)

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXT = /\.(js|mjs|cjs|css|html|sh|ts|tsx)$/;
const GENERATED = /^(website\/public\/ui\/|dist\/|website\/dist\/)/;

// Deliberately left without a header
const EXEMPT = new Set([
  // Unmodified upstream Console Lite / Console Lite Edited files (MIT, see LICENSES/MIT.txt)
  '.eslintrc.js', 'bin/deploy-travis.js', 'clear-map.js', 'controller/views/timers/timers.css',
  'importer/index.html', 'predeploy.sh', 'projector/styles/override/list.css', 'server/main.js',
  'shared/components/timer-input-1.html', 'shared/components/timer-input-1.js',
  'shared/components/timer-input.html', 'shared/components/timer-input.js',
  'shared/style/common.css', 'shared/trie.js',
  // Third-party code carrying its own license
  'controller/jquery-3.3.1.min.js', 'typings/electron.d.ts',
  'packages/ipv4/detectors/freebsd.js', 'packages/ipv4/detectors/ifconfig.js',
  'packages/ipv4/detectors/index.js', 'packages/ipv4/detectors/linux.js',
  'packages/ipv4/detectors/windows.js',
  // Framework scaffolding for the website
  'website/build/sites-vite-plugin.ts', 'website/eslint.config.mjs', 'website/next.config.ts',
  'website/postcss.config.mjs', 'website/vite.config.ts', 'website/worker/index.ts',
]);

const files = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter(f => EXT.test(f) && !GENERATED.test(f) && !EXEMPT.has(f));

const missing = files.filter(f =>
  !fs.readFileSync(path.join(ROOT, f), 'utf8').slice(0, 800).includes('SPDX-License-Identifier'));

console.log(`${files.length} source files checked, ${EXEMPT.size} exempt, `
  + `${missing.length} missing a header`);
missing.forEach(f => console.log(`  ${f}`));
process.exit(missing.length ? 1 : 0);
