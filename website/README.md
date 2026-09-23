# Console Neo product site

A self-contained bilingual landing page and user-guide site for Console Neo.

## What is included

- Chinese and English product landing content with a persistent language switch.
- Animated controller/cast product demonstration with reduced-motion support.
- Searchable guides covering setup, meetings, collaboration, feature reference,
  data and backups, troubleshooting, and FAQ.
- Accurate data/privacy language and private-preview platform status.
- Scoped inherited MIT notice, original author attribution, and third-party
  font notices.
- Responsive layouts for desktop, tablet, and mobile.

## Local development

```bash
npm ci
npm run dev
```

The local preview is normally available at `http://localhost:3000`.

## Validation

```bash
npm run lint
npm test
```

`npm test` performs a production build and checks rendered content, bilingual
coverage, attribution, and required local assets.

## Publishing status

This site is intentionally not deployed. The repository, the current Console Neo
revamp, and the site-specific 2026 work are private. No public license is granted
for that new work while ownership and licensing are being decided.

Inherited Console Lite portions remain subject to the byte-exact MIT notice in
`public/licenses/INHERITED-MIT.txt`. Locally served Roboto and Material Icons font
files are listed in `public/NOTICE.txt` and accompanied by the Apache License 2.0
text in `public/licenses/APACHE-2.0.txt`. These inherited and third-party licenses
do not grant rights to the new 2026 revamp or website work.
