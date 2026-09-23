# UI snapshots

The site shows real Console Neo windows: DOM snapshots of the controller and
projector, rendered with the app's own stylesheets. Regenerate them whenever the
app's UI changes.

From the repository root:

```bash
# 1. An isolated app instance (its own data and port) with remote debugging
CLN_USERDATA=/tmp/cn-demo CLN_PORT=3466 npx electron . --remote-debugging-port=9225 &

# 2. Demo committees in both languages, then the snapshots
node website/scripts/ui-snapshots/setup.cjs
PYTHON=/path/to/python node website/scripts/ui-snapshots/capture.cjs

# 3. The app's stylesheets, flattened (PYTHON: fontTools + brotli for WOFF2, Pillow for WebP)
PYTHON=/path/to/python node website/scripts/ui-snapshots/bundle-css.cjs
```

Output: DOM snapshots in `website/public/ui/` (feature sections) and guide
screenshots in `website/public/guides/` (WebP when `PYTHON` also has Pillow). The
controller is captured at the app's own default window size, recorded in
`website/app/ui-sizes.json`. Quit the instance and delete `/tmp/cn-demo` afterwards.
