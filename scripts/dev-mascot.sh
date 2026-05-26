#!/usr/bin/env bash
# Toggle the Codex Desktop avatar overlay (mascot) in a running ./scripts/dev.sh
# session, by attaching to the renderer via CDP and dispatching the same IPC
# message the in-app toggle button sends (`avatar-overlay-open`).
#
# Idempotent on open: if the overlay is already open, this is a no-op.
# Use ./scripts/dev-mascot.sh --close to force-close instead.
#
# Pre-req: codex running under ./scripts/dev.sh (CDP exposed on :9333 by default).
set -Eeuo pipefail

CDP_PORT="${CODEX_LINUX_DEV_TOOLS_PORT:-9333}"

curl -fsS -m 2 "http://127.0.0.1:$CDP_PORT/json/version" >/dev/null 2>&1 || {
    echo "error: codex CDP not reachable on :$CDP_PORT" >&2
    echo "       start codex first via ./scripts/dev.sh" >&2
    exit 1
}

mode="${1:-open}"
overlay_open=$(curl -s "http://127.0.0.1:$CDP_PORT/json" | grep -cE "(/|%2F)avatar-overlay" || true)

case "$mode" in
    open)
        if [ "$overlay_open" -gt 0 ]; then
            echo "✓ avatar overlay already open"
            exit 0
        fi
        action="opening"
        ;;
    close)
        if [ "$overlay_open" -eq 0 ]; then
            echo "✓ avatar overlay already closed"
            exit 0
        fi
        action="closing"
        ;;
    toggle)
        action="toggling"
        ;;
    *)
        echo "usage: $0 [open|close|toggle]" >&2
        exit 2
        ;;
esac

echo "$action avatar overlay..."

# The main-process IPC dispatcher (in app.asar's main bundle) handles a
# `{type: "avatar-overlay-open"}` message by calling
# avatarOverlayManager.toggle(). Dispatched from the main renderer (the one
# without `/avatar-overlay` in its URL) via the preload bridge.
exec node - "$CDP_PORT" <<'NODE'
const http = require("node:http");
const PORT = parseInt(process.argv[2], 10);

const list = () => new Promise((r, e) =>
    http.get(`http://127.0.0.1:${PORT}/json`, res => {
        let d = "";
        res.on("data", c => (d += c));
        res.on("end", () => r(JSON.parse(d)));
    }).on("error", e),
);

const evalJS = (ws, expression) => new Promise((res, rej) => {
    const id = Math.random() * 1e9 | 0;
    const h = ev => {
        const m = JSON.parse(ev.data);
        if (m.id === id) {
            ws.removeEventListener("message", h);
            m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
        }
    };
    ws.addEventListener("message", h);
    ws.send(JSON.stringify({
        id, method: "Runtime.evaluate",
        params: { expression, returnByValue: true, awaitPromise: true },
    }));
});

(async () => {
    const targets = await list();
    const main = targets.find(t =>
        t.type === "page" && !t.url.includes("/avatar-overlay"),
    );
    if (!main) {
        console.error("no main renderer page found");
        process.exit(1);
    }
    const ws = new WebSocket(main.webSocketDebuggerUrl);
    await new Promise((r, e) => { ws.onopen = r; ws.onerror = e; });
    await evalJS(ws,
        "window.electronBridge.sendMessageFromView({ type: 'avatar-overlay-open' })",
    );
    ws.close();
    console.log("✓ done");
})().catch(e => { console.error(e.message || e); process.exit(1); });
NODE
