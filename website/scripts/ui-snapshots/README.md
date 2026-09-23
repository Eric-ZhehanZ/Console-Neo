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
node website/scripts/ui-snapshots/capture.cjs

# 3. The app's stylesheets, flattened (PYTHON: fontTools + brotli for WOFF2)
PYTHON=/path/to/python node website/scripts/ui-snapshots/bundle-css.cjs
```

Output goes to `website/public/ui/`. Quit the instance and delete `/tmp/cn-demo`
afterwards.
