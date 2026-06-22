#!/usr/bin/env bash
# Dev launcher: brings up codex against the locally-installed codex-app/
# payload with CODEX_LINUX_DEV_RELOAD / CODEX_LINUX_DEV_TOOLS defaulted ON
# so the running app is ready to receive hot patches.
#
# Bypasses install.sh's start.sh generation — execs launcher/start.sh.template
# directly with SCRIPT_DIR preset, so edits to the template are also live.
#
# Pre-req: ./install.sh has been run once so codex-app/ exists.
# Hot patches: edit scripts/patches/*.js then run ./scripts/dev-hot-patch.sh
# from another terminal — the renderer reloads via SSE in ~1s.
set -Eeuo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
SCRIPT_DIR="${CODEX_INSTALL_DIR:-$REPO_ROOT/codex-app}"
export SCRIPT_DIR

[ -d "$SCRIPT_DIR" ] || {
    echo "error: $SCRIPT_DIR not found; run ./install.sh once to seed the dev install" >&2
    exit 1
}

# Pin assertion: refuse to launch if codex-app/ is built against a different
# Codex version than the repo SoT. Without this dev silently drifts onto
# whatever rolling Codex.dmg was current when install.sh last ran.
pinned=$(<"$REPO_ROOT/CODEX_VERSION")
pinned=${pinned%$'\n'}
build_info="$SCRIPT_DIR/.codex-linux/build-info.json"
installed=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("upstreamDmg",{}).get("appVersion",""))' "$build_info" 2>/dev/null || true)
if [ -z "$installed" ]; then
    echo "error: $build_info missing/unreadable; rerun ./install.sh" >&2
    exit 1
fi
if [ "$installed" != "$pinned" ]; then
    cat >&2 <<EOF
error: codex-app/ built against $installed but CODEX_VERSION pins $pinned.
       rerun: rm -f Codex.dmg Codex-*.zip && ./install.sh
EOF
    exit 1
fi

# Identity defaults (install.sh would bake these); override for side-by-side.
export CODEX_LINUX_APP_ID="${CODEX_LINUX_APP_ID:-codex-desktop}"
export CODEX_LINUX_APP_DISPLAY_NAME="${CODEX_LINUX_APP_DISPLAY_NAME:-Codex Desktop}"
export CODEX_LINUX_WEBVIEW_PORT="${CODEX_WEBVIEW_PORT:-${CODEX_LINUX_WEBVIEW_PORT:-5175}}"
export CODEX_LINUX_SETTINGS_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/$CODEX_LINUX_APP_ID/settings.json"

# Dev defaults ON: renderer SSE live-reload + Chromium CDP attach.
# CDP port defaults to 9333 (not Chromium's usual 9222) to avoid clashing
# with a desktop Chrome that already squats 9222 via chrome-devtools-mcp.
export CODEX_LINUX_DEV_RELOAD="${CODEX_LINUX_DEV_RELOAD:-1}"
export CODEX_LINUX_DEV_TOOLS="${CODEX_LINUX_DEV_TOOLS:-1}"
export CODEX_LINUX_DEV_TOOLS_PORT="${CODEX_LINUX_DEV_TOOLS_PORT:-9333}"

exec bash "$REPO_ROOT/launcher/start.sh.template" "$@"
