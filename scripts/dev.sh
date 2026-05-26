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
