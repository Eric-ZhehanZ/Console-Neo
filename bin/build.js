// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

// Packages Console Neo into dist/.
//   node bin/build.js darwin          macOS universal (Apple silicon + Intel)
//   node bin/build.js win32 [x64]     Windows
// @electron/packager 18 writes Windows resources with resedit, so no Wine is needed.

const packager = require('@electron/packager');
const path = require('path');
const { version } = require('../package.json');

const ROOT = path.join(__dirname, '..');
const NUMERIC = version.split('-')[0]; // OS version fields reject prerelease tags

const IGNORE = [
  // Sources and artifacts that are not part of the app
  /^\/(dist|docs|website|pending|test-results|relay|\.claude|\.vscode|\.github)(\/|$)/,
  // Local databases and uploaded files
  /^\/server\/.*\.db($|\/)/,
  /^\/server\/.*\.files($|\/)/,
];

function options(platform, arch) {
  const common = {
    dir: ROOT,
    out: path.join(ROOT, 'dist'),
    name: 'Console Neo',
    platform,
    overwrite: true,
    prune: true,
    ignore: IGNORE,
    appVersion: NUMERIC,
    appCopyright: 'Copyright (C) 2026 Zhehan Zhang',
  };

  if(platform === 'darwin')
    return Object.assign(common, {
      arch: arch || 'universal',
      icon: path.join(ROOT, 'images/icon.icns'),
      // Full prerelease version in CFBundleVersion, numeric in CFBundleShortVersionString
      buildVersion: version,
      osxUniversal: { x64ArchFiles: '**/*.node' },
      extendInfo: {
        NSLocalNetworkUsageDescription:
          'Console Neo discovers nearby sessions on your local network.',
        NSBonjourServices: ['_console-neo._tcp'],
      },
    });

  if(platform === 'win32')
    return Object.assign(common, {
      arch: arch || 'x64',
      icon: path.join(ROOT, 'images/icon.ico'),
      buildVersion: NUMERIC,
      win32metadata: {
        CompanyName: 'Zhehan Zhang',
        FileDescription: 'Console Neo',
        ProductName: 'Console Neo',
        InternalName: 'Console Neo',
        OriginalFilename: 'Console Neo.exe',
      },
    });

  return Object.assign(common, { arch: arch || process.arch });
}

function build(platform, arch) {
  return packager(options(platform, arch));
}

module.exports = { build, options };

if(require.main === module)
  build(process.argv[2] || process.platform, process.argv[3])
    .then(paths => console.log(`PACKAGED: ${paths.join(', ')}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
