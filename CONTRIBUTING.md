# Contributing to Console Neo

Thanks for helping. Bug reports, fixes, and translations are all welcome.

## Before you start

- For anything larger than a small fix, open an issue first so we can agree on the approach.
- Beta and app feedback: feedback@consoleneo.com.

## Development

```bash
npm install
npm run rebuildNative   # rebuild native modules for Electron
npm start               # full app
npm test                # eslint
node bin/check-spdx.js  # every source file carries a license header
```

The app runs on Electron 22 with Vue 1.0 renderers. Keep to the existing lint rules
(`.eslintrc.js`), and add both Chinese and English for every new UI string
(`shared/i18n.js`).

## License headers

New source files start with an SPDX header, for example:

```js
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.
```

Files derived from Console Lite or Console Lite Edited keep their upstream copyright lines
and use `AGPL-3.0-or-later AND MIT`. Never remove an upstream copyright or MIT notice.

## Licensing of contributions

Contributions are accepted under the GNU Affero General Public License v3.0 or later, the
same license as the project (see [LICENSE](LICENSE) and [NOTICE](NOTICE)).

Because the project also offers commercial licenses, contributors must sign the project's
Contributor License Agreement before their first pull request is merged.

TODO(maintainer): link CLA
