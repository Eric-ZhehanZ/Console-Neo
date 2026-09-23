# Console Neo — working notes

Electron app for chairing Model United Nations conferences. One operator drives a
**controller** window; a **projector** window casts the current view to the room's
screen; other devices (co-chairs, observers) connect to the same session over the LAN
or through a relay and see everything live.

Forked from Console Lite (`CircuitCoder/Console-Lite`, later `JieJiSS/Console-Lite-Edited`).
The README in this repo is inherited from that fork and is largely out of date — trust
this file instead.

---

## 1. Ground rules

- **Never modify the `FCTC-COP` committee.** It is live production data. All testing goes
  in `测试委员会` or a throwaway committee in an isolated instance (§7).
- **Do not relaunch or restart the running app without being asked.** The user usually has
  a live dev instance open and tests each batch personally. If you need to see something
  running, spawn an *isolated* instance instead (§7).
- The relay's `console-neo-relay.zhehanz.workers.dev` URL returns a **302 to Cloudflare
  Access** — that is deliberate, not an outage. Don't "fix" it or remove the Access app.
  Production traffic uses `connect.consoleneo.com`.

---

## 2. Commands

```bash
npm start        # electron .            — full app (controller window)
npm run server   # electron server/main.js — headless server only
npm test         # eslint .              — the only automated check in the repo
npm run pack     # bin/pack.js           — platform/arch package
npm run build    # macOS universal via electron-packager → dist/
npm run reset    # wipe server/backend/storage/*.db
```

There is **no test suite and no build step** — HTML/CSS/JS are loaded straight from disk by
the renderer. `npm test` is only eslint. Always run `npx eslint <changed files>` after edits;
CI (Travis config is stale) will not catch anything for you.

Electron **22.3.27** → Chromium 108, **Node 16** in the renderer. `nodeIntegration: true`,
`contextIsolation: false`; renderers `require()` node modules directly.

---

## 3. Process & window layout

```
main.js  (main process)
├── controller  BrowserWindow → controller/index.html      the chair's UI
├── projector   BrowserWindow → projector/index.html       the room screen
├── note        BrowserWindow(s) → notes/note.html          per-key collaborative notes
├── importer    BrowserWindow → importer/index.html         data import/export (Edit menu)
└── server/server.js  in-process socket.io server on :3066 (embedded, optional)
```

`main.js` owns: window creation, the embedded server lifecycle, credential rotation
fan-out, the relay host agent, resume state, note windows, `clexport:` protocol for export,
tar import, power-save blocker, and global shortcuts.

**Global shortcuts**: `Cmd/Ctrl+\` focus controller · `Cmd/Ctrl+Shift+|` focus/open projector
· `Cmd/Ctrl+Shift+P` open devtools + `stopTheWorld()` (pauses the running timer, then
`debugger`) · `Cmd/Ctrl+1..9` jump to a controller page (`util.js`, Pages menu).

**Renderer supervision**: `watchRenderer()` in `main.js` logs `render-process-gone` /
`unresponsive` and reloads at most once per 30 s so a crash loop can't spin.
`EventEmitter.defaultMaxListeners = 40` — note windows and projector reopens legitimately
exceed the default 10 via `@electron/remote`.

---

## 4. Data flow

Everything is **socket.io 1.7**, one namespace per committee (`/<confId>`), plus the root
namespace for create/list. There is no REST API.

```
controller renderer                       server (in-process or remote)
  action.js  ──emit('addList', …)──▶  socket.js  ──▶  backend/conference.js
                                                          │ persists to LevelDB
      ◀──ack: socket.emit('addList', {ok, id})            │
      ◀──broadcast: nsp.emit('listAdded', {…}) ───────────┘   to every client
```

- `server/socket.js` (~790 ln) is the wire protocol: one `socket.on(op)` per operation,
  each replying to the caller with `{ ok, … }` **and** broadcasting a past-tense event
  (`listAdded`, `timerTick`, `motionExecuted`, …) to the namespace.
- `controller/connection/conference.js` mirrors that: `pushSocketListener(event, [fields])`
  registers each broadcast so `action.js` can subscribe with plain callbacks. **When you add
  a server op you must touch three files**: `server/backend/conference.js` (logic + persist),
  `server/socket.js` (auth + ack + broadcast), `controller/connection/conference.js`
  (listener registration) — then handle it in `controller/action.js`.
- Authorization: `authenticate(socket)` in `server/socket.js`. Chair passkey ⇒ write;
  reader key ⇒ read-only. Every mutating op re-checks and answers `NotAuthorized`.

**Storage** — `classic-level` (LevelDB), JSON values, one DB per committee:
`app.getPath('userData')/storage/<confId>.db` on macOS (`server/backend/` elsewhere), with
uploaded files beside it in `<confId>.files`. `server/backend/conference.js` (~1260 ln) is
the model: timers, seats, files, votes, lists, motions, history, notes, per-delegate stats.
Timers tick server-side (`_startTimer`) so every client agrees on the clock.

**Projection** is two-layered:
- Local: `ipcRenderer.send('toProjector', …)` → `main.js` → projector's `fromController`.
- Shared ("sync cast"): one client holds the cast **host** claim (`projClaimHost`), and
  `projSet` / `projExtra` broadcast the current layer so remote clients mirror it.
  `castFallback` (`base` / `keep`, persisted in localStorage) decides what a non-host
  shows when the host goes away.

---

## 5. Connectivity — this is the subtle part

### Session identity & credentials (`server/server.js`)
- `idkey` = `<8 hex>-<4 digits>`, generated per server start. This doubles as the **relay
  session id**.
- **Codes** (6 chars, alphabet excludes `I`/`O`): `code` = chair, `readerCode` = viewer.
  Rotate every **30 s**.
- **Keys** (long alphanumeric): `passkey` (18), `readerkey` (`R` + 12). Rotate every **10 min**.
- Rotation only affects *new* connections. Established sessions hold a `sessionToken`
  (`adoptSessionToken` in `controller/action.js`), so they survive rotation and reconnects.
- `main.js` re-broadcasts rotations to the controller as `serverKeysRotated`.

### LAN discovery (`shared/discovery.js`)
Three transports in parallel, deduped by id: UDP broadcast on **:3067** (both
`255.255.255.255` and every interface's directed subnet broadcast), an explicit probe /
unicast-response round trip (survives networks that drop server broadcasts), and
Bonjour/mDNS `_console-neo._tcp`. Announcements carry `{id, port, conf}` — **never** the
connect code.

### Local-network presence (`shared/network.js`)
`hasLocalNetwork()` enumerates interfaces. Tunnels (`lo utun awdl llw vmnet docker veth tun
tap anpi`) are skipped; **bridges are not** — a device-initiated hotspot appears as
`bridge100` and is a legitimate LAN. Link-local `169.254.x` counts. Polled by
`startNetWatch()`; when false the UI blurs codes, disables connect actions, and offers a
manual re-check.

### Relay (`shared/tunnel.js`, `relay/`)
When there's no shared LAN, a reverse tunnel (ngrok-shaped) carries socket.io:

```
client app → 127.0.0.1:<ephemeral> ══wss══▶ relay ◀══wss══ host agent → 127.0.0.1:3066
```

- Binary frames `[type u8][connId u32BE][payload]`, `OPEN=1 DATA=2 CLOSE=3 PING=4 PONG=5`,
  chunked at 256 KB (Workers' 1 MB message ceiling). One WebSocket per device multiplexes
  every stream.
- Heartbeat `PING_INTERVAL = 15 s`, `PONG_TIMEOUT = 40 s`; relay drops a host after
  `HOST_STALE = 45 s`.
- **`4409` = session already registered.** It is almost always our own zombie registration
  after a silent drop, so the host agent must keep retrying (20 s) — treating it as fatal
  strands every client permanently. This was a real bug; don't reintroduce it.
- The relay is a **dumb pipe**. All auth stays end-to-end against the host's own server.
- `relay/worker.js` + `relay/wrangler.toml` — Cloudflare Worker + Durable Object
  (`RelaySession`, one DO per session, `new_sqlite_classes`). Deployed on the **ZhehanZ**
  account at `connect.consoleneo.com`.
- `relay/local.js` — dependency-free Node relay for local testing (`RELAY_PORT`, default 8787).
- Routing preference lives in Settings: `lan` (default; LAN short-circuits, relay is backup)
  or `relay` (always). Custom relay URL supported. Persisted as `cln-route-pref` /
  `cln-relay-url`.
- Client-side drop handling grants a **90 s** grace on relay sessions vs 30 s on LAN
  (`_watchRemoteDrop`), because relay reconnects are slower.

### Resume
`setResumeState` / `getResumeState` keep the snapshot in **main-process memory only**. So a
renderer reload resumes straight back into the session, while a full app restart returns to
the welcome page — that asymmetry is intentional. Resume through the relay retries 3× within
a 45 s budget. The startup layer is `v-show="!picker && !frame"` — both flags matter, or a
dead non-interactive overlay covers the resumed session.

---

## 6. Renderer conventions

### Vue **1.0.26** — not Vue 2, not Vue 3
Every renderer builds one root instance over `<body>`. Things that will bite you:

- No `v-else-if`. Chain `v-if` with negated conditions.
- Transitions are `transition="name"` **attributes**, with `.xxx-transition/-enter/-leave`
  CSS classes; there is no `<transition>` element.
- `track-by="uid"` on `v-for` over objects, or list reordering thrashes the DOM.
- `v-el:name` → `this.$els.name`. Refs are `v-ref:`.
- Parent↔child messaging is `this.$dispatch('event', …)` up and `this.$broadcast(…)` down,
  received via the `events: { … }` component option. Props sync with `.sync` where needed.
- `Vue.extend({ template: fs.readFileSync(`${__dirname}/x.html`) })` — templates are read
  off disk at require time. No bundler, no hot reload; changing HTML needs a window reload.

### Controller structure
`controller/action.js` (~2600 ln) is the whole application state machine: startup/picker,
connection, every socket subscription, navigation, projection, keyboard handling. Views are
components swapped through `<component :is="activeView">` in `controller/index.html`, each a
folder under `controller/views/<name>/` with `.js` / `.html` / `.css`:

`home seats timers files votes lists motions stats delegate settings` (list pages) and
`file vote list timerpage` (detail pages). `navigate(dest)` pushes onto `viewStack` for back.

Every view template starts with its watermark:
`<div class="ctrl-watermark-clip"><i class="material-icons ctrl-watermark">icon</i></div>` —
new views must include one or they'll look broken.

### i18n
`shared/i18n.js` — flat `DICT` of `key: { zh, en }` plus a reactive `store`. Requiring it
installs a **global `Vue.mixin`** giving every component `t(key)` and `tf(key, params)`
(`{n}`-style interpolation); `t()` reads `store.lang` inside the method so templates
re-render on language change. Language persists as `cln-lang`. **Add both languages for
every new string**; zh is the primary audience.

### CSS notes worth keeping
- Sizes are mostly `vw` on the projector so the cast scales with the display.
- `word-break: break-word` shrinks min-content width inside grid/flex and causes mid-word
  breaks in delegation names — use `overflow-wrap: break-word`.
- `text-align: right` cannot right-align a line that overflows its box. Anchor the box
  (`align-items: flex-end` on a flex column) instead. This has been "fixed" wrongly twice.
- Prefer normal flow over absolute positioning for anything that sits below variable-length
  content (see `.voter-progress-container`) — a long list will run under an absolute element.

### Design taste the user has enforced
- No cards/boxes/backgrounds around the session codes. Plain stacked text:
  `Session ID / 会话 ID`, then `Auth Code / 验证码`, then the Chair/Viewer selector plus the
  eye toggle beneath it (`shared/components/code-badge.js`). No step numbering.
- Codes default to blurred (`filter: blur(5px); opacity:.8` — light enough that the shape
  shows through). Click to toggle. Auto re-blur after **two automatic code refreshes**;
  manual Chair↔Viewer switching must not count (the counter lives in the `chair()` watcher,
  not `shown()`).
- No sudden layout shifts. Bottom-right anchoring on the home page, centered on launch.
- Every line of the badge is `white-space: nowrap` — variable code width otherwise wraps the
  label above it.

---

## 7. Testing an isolated instance

There is no test runner. What has worked is driving a second, fully isolated app over the
Chrome DevTools Protocol while the user's own instance keeps running:

```bash
CLN_USERDATA=<scratch>/userdata CLN_PORT=3266 \
  npx electron . --remote-debugging-port=9223 > <scratch>/app.log 2>&1 &
```

`CLN_USERDATA` redirects `app.setPath('userData')` (so a separate LevelDB) and `CLN_PORT`
moves the embedded server off 3066. Both exist purely for this.

Then over CDP: connect to `ws://127.0.0.1:9223/json` → pick the target whose URL contains
`controller/index.html` → `Runtime.evaluate` against `document.body.__vue__`, which is the
root Vue instance, so every method and data field is reachable
(`__vue__.createBackend()`, `.performConfCreation()`, `.startChairing()`, `.updateSeats(…)`,
`.addVote(…)`, `.projectVote(…)`, …). `Page.captureScreenshot` gives you the projector layout.

Gotchas learned the hard way:
- Poll with **serializable** expressions (`!!document.querySelector(...)`), never a raw
  element — CDP can't return DOM nodes by value.
- View changes crossfade. Wait ~650 ms and read the **last** matching element, or you'll
  measure the outgoing view.
- Always clean up: kill the instance and delete its scratch userdata; check the log for
  `crash` / `uncaught` lines afterwards.

Harnesses used previously (`e2e.js` 67 checks, `e2e-relay.js` / `e2e-relay-prod.js` 13 checks,
`vote-shot.js` layout metrics) lived in the session scratchpad and are gone; the recipe above
is what matters.

---

## 8. Domain model

- **Seats** — the delegation roster (`{name, present}`). Drives quorum figures on the cast
  bottom bar (simple majority / two-thirds / one-fifth).
- **Motions** (`shared/motion-types.js`) — 14 types; `fields` decides which inputs the modal
  shows (`topic title totTime eachTime file files comment`), `action` decides what executing
  one creates (`list timer prolong tour file pvote svote` or nothing). `compareDisruptive`
  implements MUN precedence: type rank first (`DISRUPTIVE_ORDER`), then **longer total time
  is more disruptive**, then **longer per-delegate time**, then more attached files. A passed
  motion's action link must create *and navigate into* the instance, not the feature index.
- **Speakers' lists** — the highest-stakes screen. Three mispress-safe buttons: undo /
  play-pause / next, with a 700 ms cooldown on next (`nextGuarded`) and a snapshot-based
  `undoStep`. **Space is play/pause and never advances.** Backspace/Enter walk the list:
  Enter commits a row and opens the next for editing, Backspace on an empty box eats the
  newest entry or steps back. Both current and total remaining time are editable when the
  timer isn't running (`updateTimerLeft` op).
- **Votes** — `matrix` of `{name, vote}` with `1` for, `-2` against, `-1` abstain; rounds and
  target (`-1` = two-thirds).
- **Notes** — Yjs CRDT + Quill, one mini-window per key, synced through the conference socket
  (`getNote` / `setNote`, `noteMeta` broadcast). Markdown shortcuts on `# `, `- `, `> `, etc.
- **Stats / delegate pages** — per-delegate speech counts and motion counts accumulated by
  `_bumpDelegate` / `_flushStats`. The stats table cycles each column off → sort → reverse,
  up to 3 active sort columns compared in click order.

---

## 9. Lint

`eslint 3` + `airbnb-base`, config in `.eslintrc.js`. The unusual bits:

- **`keyword-spacing` is inverted** for `if`/`for`/`while`/`catch`: write `if(x)`, not `if (x)`.
- `max-len` 100.
- `curly` off, `no-else-return` off, `no-param-reassign` off, `no-underscore-dangle` off,
  `no-console` off, `no-void` off (`return void cb(err)` is the house idiom for callbacks).
- `consistent-return` with `treatUndefinedAsUnspecified` — mixing bare `return` and
  `return value` in one function still errors.

For tricky in-place edits, a python heredoc with `assert old in s` before replacing is safer
than a fragile regex; follow with `npx eslint <file>`.

---

## 10. State of the tree (as of 2026-09-22)

- Branch `main`, pushed to `github.com/Eric-ZhehanZ/Console-Neo`. History starts at the
  initial commit; the Console Lite fork's history was not carried over. `pending/` (new icon
  drafts) and `test-results/` are deliberately not tracked.
- Version `2.0.0-beta.1` (semver prerelease). macOS builds put the numeric part in
  `CFBundleShortVersionString` and the full string in `CFBundleVersion`. `npm run build`
  writes `dist/` (git-ignored); rebuild after any change before distributing.
- App icon master is `images/icon.png` (full-bleed 1024). `icon.icns` puts it on Apple's
  824/1024 grid with a drop shadow; `icon.ico` and the window PNGs use it full-bleed.
- `website/` is a separate Next.js (vinext) project. Its feature sections embed DOM
  snapshots of the real app (`website/public/ui/`); regenerate them after UI changes with
  `website/scripts/ui-snapshots/` (see its README).
- The relay is live and verified end-to-end through production Cloudflare.
