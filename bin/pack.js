// SPDX-License-Identifier: AGPL-3.0-or-later AND MIT
// Copyright (C) 2016 Liu Xiaoyi
// Copyright (C) 2018 Pan Ruizhe
// Modifications Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE, NOTICE, and LICENSES/MIT.txt for terms.

const process = require('process');
const { build } = require('./build');

// Packages for the current platform and architecture into dist/ (see bin/build.js)
function pack(cb, silent) {
  if(!silent) {
    console.log(`Building package for ${process.platform} - ${process.arch}.`);
    console.log('Please ensure that native dependecies are built using correct ABI version');
  }

  build(process.platform, process.arch)
    .then((paths) => {
      if(!silent)
        console.log(`Package outputted to: ${paths}`);
      if(cb) cb(null, paths);
    })
    .catch((err) => {
      if(!silent) {
        console.error('Packager failed:');
        console.error(err.stack);
      }
      if(cb) cb(err);
    });
}

/* eslint-disable global-require */

if(require.main === module) {
  const ora = require('ora');
  const ind = ora('Packaging').start();

  pack((err, paths) => {
    if(err) {
      ind.fail();
      console.error(err.stack);
    } else {
      ind.text = `Package outputted to: ${paths}`;
      ind.succeed();
    }
  }, true);
}

module.exports = pack;
