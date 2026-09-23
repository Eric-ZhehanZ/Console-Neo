# Console Neo

A desktop console for chairing Model United Nations committees.

面向模拟联合国会议主席团的会议控制台。

One operator drives the **controller** window. A **projector** window casts the current view
to the room's screen. Co-chairs and observers join the same session from their own devices,
over the local network or through a relay, and see every change live.

## Features

- **Roll call and quorum.** Keeps the delegation roster; simple-majority, two-thirds and
  one-fifth thresholds update on the cast as attendance changes.
- **Speakers' lists** built for mispress safety: undo, play/pause and next, with a cooldown on
  next. Space toggles play/pause and never advances the list.
- **Motions** covering 14 types, ordered by disruptiveness. A passed motion creates and opens
  the list, timer, document or vote it authorizes.
- **Votes** for procedural and substantive matters, with multiple rounds and targets.
- **Timers** run on the server, so every connected device shows the same clock.
- **Documents** can be shared with the room and projected.
- **Per-delegate statistics** for speeches, speaking time and motions.
- **Collaborative notes** synced live between chairs.
- **Shared projection.** One device hosts the cast and the others mirror it.
- **Chinese and English** interfaces.

## Connecting devices

The host's session shows a **Session ID** and a rotating 6-character **Auth Code**, one for
chairs (read-write) and one for viewers (read-only). Other devices find the host on the local
network automatically. When there's no shared network, traffic goes through the relay at
`connect.consoleneo.com`. The relay only carries traffic; authentication happens against the
host.

Committee data lives on the host machine only. Connected devices hold a live copy while
they're in the session.

## Development

The app runs on Electron 22 (Chromium 108, Node 16).

```bash
npm install
npm run rebuildNative   # rebuild native modules for Electron
npm start               # full app
npm run server          # headless server only
npm test                # eslint
```

There is no build step: the renderers load HTML, CSS and JS straight from disk. Reload a
window to pick up changes.

`npm run reset` deletes local committee data stored under `server/backend/storage/`. On macOS
the app stores data under its user-data directory instead.

### Packaging

```bash
npm run build   # macOS universal app → dist/
npm run pack    # current platform and architecture
```

### Relay

`relay/` holds the relay as a Cloudflare Worker with one Durable Object per session.
`relay/local.js` is a dependency-free Node version for local testing:

```bash
RELAY_PORT=8787 node relay/local.js
```

## Lineage and license

Console Neo is a private, independently maintained revamp of
[Console Lite](https://github.com/CircuitCoder/Console-Lite) and
[Console Lite Edited](https://github.com/JieJiSS/Console-Lite-Edited). It includes their
MIT-licensed code, © 2016 Liu Xiaoyi and © 2018 Pan Ruizhe; see [LICENSE](LICENSE). Those
notices must be kept in any distribution. The license for the new work hasn't been decided yet.

Console Neo isn't affiliated with or endorsed by the United Nations.
