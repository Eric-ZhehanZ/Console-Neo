# Console Neo site

The bilingual product site and user guides for Console Neo.

Feature sections show real controller and cast windows: DOM snapshots of the app,
rendered with its own stylesheets (`public/ui/`). See
`scripts/ui-snapshots/README.md` to regenerate them after UI changes.

## Development

```bash
npm ci
npm run dev
```

The preview runs at `http://localhost:3000`.

## Checks

```bash
npm run lint
npm test
```

`npm test` builds the site and checks the rendered page, the UI snapshots, the
guides, attribution, and local assets.

## Licensing

The site is part of Console Neo and shares its license: GNU AGPL v3.0 or later,
with the additional terms in the repository's `NOTICE`. The site serves the
license text at `public/licenses/AGPL-3.0.txt` and the inherited Console Lite MIT
notice at `public/licenses/INHERITED-MIT.txt`. Roboto and Material Icons are
listed in `public/NOTICE.txt`, with the Apache License 2.0 in
`public/licenses/APACHE-2.0.txt`.
