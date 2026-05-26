#!/usr/bin/env bash
# Hot-patch loop for scripts/patches/*.js iteration.
#
# Stages a clean copy of the upstream extracted asar (auto-seeded from
# Codex.dmg on first run), runs the JS patcher against it, and copies the
# patched webview tree into the running install. Triggers a renderer
# reload via the webview-server SSE channel. No Electron restart, no
# asar repack — the renderer reloads in ~1s.
#
# main-process patches require an Electron restart; this script prints
# a warning when it detects the main bundle was touched.
#
# Pre-req: codex running with CODEX_LINUX_DEV_RELOAD=1 so webview-server
# has the SSE endpoint open.
set -Eeuo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

INSTALL_DIR="${CODEX_INSTALL_DIR:-$REPO_ROOT/codex-app}"
WEBVIEW_PORT="${CODEX_LINUX_WEBVIEW_PORT:-${CODEX_WEBVIEW_PORT:-5175}}"
BASELINE_DIR="${CODEX_DEV_BASELINE_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/codex-desktop-linux/dev/baseline}"
DMG_PATH="${CODEX_DMG_PATH:-$REPO_ROOT/Codex.dmg}"

[ -d "$INSTALL_DIR/content/webview" ] || {
    echo "error: $INSTALL_DIR/content/webview not found; run ./install.sh once" >&2
    exit 1
}

# Auto-seed the baseline on first run: extract Codex.dmg's asar into the
# cache. ~5s, one-time per upstream DMG. Skips native_modules — webview
# patches don't need them and main-process hot patching is Phase 2.
if [ ! -d "$BASELINE_DIR" ]; then
    [ -f "$DMG_PATH" ] || { echo "error: DMG not found at $DMG_PATH" >&2; exit 1; }
    echo "seeding baseline (one-time) from $DMG_PATH ..."
    seed_tmp=$(mktemp -d -t codex-seed-XXXX)
    trap 'rm -rf "$seed_tmp"' EXIT
    7z x -y -snl "$DMG_PATH" -o"$seed_tmp" >/dev/null
    app_dir=$(find "$seed_tmp" -maxdepth 3 -name "*.app" -type d | head -1)
    [ -n "$app_dir" ] || { echo "error: no .app in DMG" >&2; exit 1; }
    mkdir -p "$(dirname "$BASELINE_DIR")"
    npx --yes asar extract "$app_dir/Contents/Resources/app.asar" "$BASELINE_DIR"
    [ -d "$app_dir/Contents/Resources/app.asar.unpacked" ] &&
        cp -r "$app_dir/Contents/Resources/app.asar.unpacked/"* "$BASELINE_DIR/" 2>/dev/null || true
    rm -rf "$seed_tmp"
    trap - EXIT
    echo "baseline ready: $BASELINE_DIR ($(du -sh "$BASELINE_DIR" | cut -f1))"
fi

stage=$(mktemp -d -t codex-hot-XXXX)
trap 'rm -rf "$stage"' EXIT

# cp -a + --reflink=auto: instant CoW clone on btrfs/xfs/zfs, real copy
# elsewhere. Either way the stage's inodes are distinct so the patcher's
# in-place writes can't corrupt the baseline.
cp -a --reflink=auto "$BASELINE_DIR" "$stage/app-extracted"

node "$REPO_ROOT/scripts/patch-linux-window-ui.js" "$stage/app-extracted"

rsync -a --delete "$stage/app-extracted/webview/" "$INSTALL_DIR/content/webview/"

main_touched=0
if ! diff -rq "$BASELINE_DIR/.vite/build" "$stage/app-extracted/.vite/build" >/dev/null 2>&1; then
    main_touched=1
fi

reload=skipped
if curl -fsS -m 2 -X POST "http://127.0.0.1:$WEBVIEW_PORT/dev/notify-reload" >/dev/null 2>&1; then
    reload=ok
fi

echo
case "$reload" in
    ok) echo "✓ patched webview → renderer reloaded (port $WEBVIEW_PORT)" ;;
    *)  echo "! patched webview, but reload signal failed (port $WEBVIEW_PORT)"
        echo "  → ensure codex was launched with CODEX_LINUX_DEV_RELOAD=1" ;;
esac
if [ "$main_touched" -eq 1 ]; then
    echo "! main bundle changed — Electron is still running the old main.js"
    echo "  → restart Electron to load the new main-process patches"
fi
