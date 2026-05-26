---
name: codex-dev
description: >
  Codex Desktop Linux fork — fast patch iteration workflow. Use when:
  (1) editing scripts/patches/*.js and wanting ~1s renderer hot-reload
  (2) editing launcher/start.sh.template or launcher/webview-server.py
  (3) running / driving a dev codex against the local codex-app/ install
      without going through pacman or ./install.sh re-runs
  (4) inspecting the running codex (DOM, console, network) via the
      codex-devtools MCP attached to its CDP port
  (5) triggering codex internal IPC actions (open mascot, etc.) via CDP
---

# Codex Dev Workflow

Fast-loop primitives for iterating on the Linux fork's patches and launcher
without paying `./install.sh`'s 2-minute rebuild cost.

## When to Use This

Use when working in this repo and you want to:

- See a `scripts/patches/*.js` change reflected in the running codex within
  ~1 second (renderer SSE reload)
- Edit `launcher/start.sh.template` and re-run codex against it directly
  (no install.sh regeneration)
- Drive the running codex programmatically (CDP attach for DOM/Network/
  Console inspection, or IPC-level actions like toggling the avatar overlay)

Do NOT use for: production install workflows (`./install.sh`, AUR/.deb/
.rpm builds), `codex-app-next/` rebuild candidate flow.

## Quick Reference

```
./scripts/dev.sh                    launch codex against codex-app/ with
                                    CODEX_LINUX_DEV_RELOAD + DEV_TOOLS on
                                    (CDP @ :9333, SSE reload @ :5175)

./scripts/dev-hot-patch.sh          re-apply scripts/patches/*.js + rsync
                                    webview tree + POST /dev/notify-reload
                                    → renderer reloads in ~1s
                                    auto-seeds asar baseline on first run

./scripts/dev-mascot.sh [open|close|toggle]
                                    drive avatar overlay via CDP IPC dispatch
                                    (sendMessageFromView avatar-overlay-open)

./scripts/dev-tray-mock.sh [N|clear]
                                    DOM-inject N fake tray cards + size IPC
                                    (eyeball only — bypasses React data flow)
```

## Architecture

```
   install.sh pipeline stages we slice into:

   ┌──── extract DMG → patch asar → electron rebuild → install ────┐
   │       (5s)        (5s)         (60s)              (5s)         │
   │                    │                                            │
   │                    ▼                                            │
   │              dev-hot-patch.sh re-runs JUST THE PATCHER         │
   │              against the cached baseline, rsyncs webview/,     │
   │              POSTs reload → ~1s end-to-end                     │
   │                                                                 │
   └──── render launcher (start.sh) from launcher/start.sh.template ┘
                                    │
                                    ▼
                              dev.sh execs the template DIRECTLY
                              (skip install.sh's create_start_script),
                              so template edits are live
```

## Workflow Sequences

### Patch iteration (the common case)

```bash
# One-time:
./install.sh        # produces codex-app/, baseline auto-seeds on first hot-patch

# Per session:
./scripts/dev.sh    # leave running in one terminal

# Per edit:
$EDITOR scripts/patches/webview-assets.js
./scripts/dev-hot-patch.sh   # renderer reloads in ~1s

# If you edited a main-process patch (scripts/patches/main-process.js
# or scripts/patches/avatar-overlay.js), dev-hot-patch.sh will warn
# you to restart Electron — close the codex window and re-run dev.sh.
```

### Launcher template iteration

`dev.sh` execs `launcher/start.sh.template` directly with `SCRIPT_DIR`
preset, so edits to the template take effect on next `./scripts/dev.sh`
without any rerender step.

### Driving the running codex (mascot, tray)

```bash
./scripts/dev-mascot.sh open     # avatar overlay appears
./scripts/dev-tray-mock.sh 4     # 4 fake tray cards (DOM-level)
./scripts/dev-tray-mock.sh clear # remove fake cards
./scripts/dev-mascot.sh close    # hide overlay
```

### Side-by-side isolated dev install

If you want to iterate without touching your main install's settings/
login/state, build a separate `codex-cua-lab-app/`:

```bash
# Once:
make build-dev-app DMG=Codex.dmg

# Then point dev.sh at it:
CODEX_LINUX_APP_ID=codex-cua-lab \
CODEX_LINUX_APP_DISPLAY_NAME="Codex CUA Lab" \
CODEX_INSTALL_DIR="$PWD/codex-cua-lab-app" \
    ./scripts/dev.sh
```

The dev scripts respect those env overrides; everything (state dir,
config, port, Electron user-data) gets a parallel namespace.

## Hot-Reload Coverage

| Patch phase | scripts/patches/ file | Hot reload? | Action needed |
|---|---|---|---|
| `webview-asset` | `webview-assets.js` and most | ✅ ~1s | `dev-hot-patch.sh` |
| `main-bundle` | `main-process.js`, `avatar-overlay.js`, etc. | ❌ | restart Electron |
| Launcher template | `launcher/start.sh.template` | ✅ next `dev.sh` | restart codex |
| Webview server | `launcher/webview-server.py` | ❌ | restart codex |

`dev-hot-patch.sh` detects whether the main bundle was touched (diffs
`.vite/build/` against the baseline) and prints a warning telling you to
restart Electron when applicable.

## codex-devtools MCP

A project-scoped MCP server (`.mcp.json` at repo root) attaches Chrome
DevTools Protocol tools to the running codex's CDP at `:9333`. Tools
become available under the `mcp__codex-devtools__*` prefix — distinct
from the global `mcp__chrome-devtools__*` which targets the user's
regular Chrome.

The MCP server can only connect once codex is running under `dev.sh`.
If it fails to start, the codex CDP port isn't up yet — start `dev.sh`
and reconnect.

Common uses:

| Tool | Use case |
|---|---|
| `mcp__codex-devtools__list_pages` | enumerate main renderer + overlay |
| `mcp__codex-devtools__take_snapshot` | a11y tree of the renderer (better than raw DOM) |
| `mcp__codex-devtools__evaluate_script` | run JS in the renderer (IPC dispatch, fiber walk) |
| `mcp__codex-devtools__take_screenshot` | visual capture of either renderer |

## Reverse Engineering Notes

Upstream codex code (in `app.asar` + `webview/assets/*`) is minified
webpack/vite output with **no source maps shipped**. To work on it:

- **Patch via regex with sentinel comments** — same pattern as
  `scripts/patches/avatar-overlay.js`. Anchor on stable structural
  shapes (function call sites, attribute names, value clusters), not on
  identifier names (which rotate per build).
- **IPC channel discovery** — `grep` for backtick-quoted strings in
  `~/.cache/codex-desktop-linux/dev/baseline/.vite/build/main-*.js`.
  The main process IPC dispatcher uses a `switch` over `type` field;
  channel names show up as `case ` followed by backtick string.
- **Renderer state introspection** — codex doesn't ship the React
  DevTools global hook, but each React-managed DOM node exposes a
  `__reactFiber$<key>` property. Walk `.return` to traverse up the tree;
  `memoizedProps` / `memoizedState` reveal current props / hook state.
  Use `evaluate_script` via the MCP for this.

The data layer (notifications array, conversation list, …) reaches the
renderer through TanStack Query subscribing to the codex CLI's
WebSocket app-server. Faking data at that layer is genuinely deep
reverse engineering. For dev verification that visible state changes,
prefer triggering real conversations (and editing patches that affect
their rendering) over faking the data flow.

## Common Gotchas

- **`:9222` clashes** with user's Chrome (chrome-devtools-mcp usually
  squats it). `dev.sh` defaults to `:9333` to dodge this.
- **Warm-start handoff** — if a `codex-desktop` instance is already
  running (e.g., from `/opt/codex-desktop/start.sh`), a new `dev.sh`
  hands off to it instead of starting fresh. Kill the existing instance
  first, or use a side-by-side `CODEX_LINUX_APP_ID`.
- **DOM injection is ephemeral** — `dev-tray-mock.sh` puts cards into
  DOM outside React's reconciliation. Any `dev-hot-patch.sh` reload
  wipes them; re-run the script. They also don't trigger React's tray
  cap / overflow badge logic.
- **Baseline staleness** — when the upstream DMG bumps, the seeded
  baseline at `~/.cache/codex-desktop-linux/dev/baseline/` is stale.
  Delete that directory; next `dev-hot-patch.sh` re-seeds.

## Files

```
scripts/
├── dev.sh                  long-running launcher (exec template)
├── dev-hot-patch.sh        one-shot: re-patch + rsync + reload
├── dev-mascot.sh           CDP toggle of avatar overlay window
└── dev-tray-mock.sh        CDP DOM-inject N fake tray cards

launcher/
├── start.sh.template       runtime launcher (SCRIPT_DIR is overridable)
└── webview-server.py       static server + dev SSE reload channel

.mcp.json                   project MCP — codex-devtools attached to :9333
.claude/skills/codex-dev/   this skill
```
