#!/usr/bin/env bash
# Inject N fake notification cards into the avatar overlay via CDP.
#
# The overlay window is sized to the mascot only when notifications=0, so
# this script also dispatches the renderer→main `avatar-overlay-element-
# size-changed` IPC with isTrayVisible=true and a faked tray bound, which
# makes the main process resize the BrowserWindow to fit the cards.
#
# The cards are ephemeral: React re-renders may overwrite the IPC size hint
# back to mascot-only and shrink the window. Re-run this script to refresh.
#
# Usage:  ./scripts/dev-tray-mock.sh [count]   # default 4
#         ./scripts/dev-tray-mock.sh clear
#
# Pre-req: ./scripts/dev.sh running, ./scripts/dev-mascot.sh open.
set -Eeuo pipefail

CDP_PORT="${CODEX_LINUX_DEV_TOOLS_PORT:-9333}"

curl -fsS -m 2 "http://127.0.0.1:$CDP_PORT/json/version" >/dev/null 2>&1 || {
    echo "error: codex CDP not reachable on :$CDP_PORT (./scripts/dev.sh)" >&2
    exit 1
}

arg="${1:-4}"
mode="add"
count=0
case "$arg" in
    clear|reset) mode="clear" ;;
    ''|*[!0-9]*) echo "usage: $0 [count|clear]" >&2; exit 2 ;;
    *) count="$arg" ;;
esac

exec node - "$CDP_PORT" "$mode" "$count" <<'NODE'
const http = require("node:http");
const [PORT, MODE, COUNT] = [parseInt(process.argv[2],10), process.argv[3], parseInt(process.argv[4]||"0",10)];

const list = () => new Promise((r,e) => http.get(`http://127.0.0.1:${PORT}/json`, res => {
    let d=""; res.on("data",c=>d+=c); res.on("end",()=>r(JSON.parse(d)));
}).on("error",e));

const evalJS = (ws, expression) => new Promise((res, rej) => {
    const id = Math.random()*1e9|0;
    const h = (ev) => { const m=JSON.parse(ev.data);
        if (m.id===id){ ws.removeEventListener("message",h);
            m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }};
    ws.addEventListener("message",h);
    ws.send(JSON.stringify({id, method:"Runtime.evaluate", params:{expression, returnByValue:true, awaitPromise:true}}));
});

(async () => {
    const targets = await list();
    const overlay = targets.find(t => t.type==="page" && /avatar-overlay/.test(t.url));
    if (!overlay) {
        console.error("avatar overlay not open — run ./scripts/dev-mascot.sh open first");
        process.exit(1);
    }
    const ws = new WebSocket(overlay.webSocketDebuggerUrl);
    await new Promise((r,e)=>{ ws.onopen=r; ws.onerror=e; });

    if (MODE === "clear") {
        const r = await evalJS(ws, `
          (() => {
            const removed = [...document.querySelectorAll('[data-dev-mock-card]')].map(n => (n.remove(), 1)).length;
            const wrap = document.querySelector('[data-dev-mock-tray]');
            if (wrap) wrap.remove();
            // Tell main to re-evaluate window size (false → shrink back to mascot)
            window.electronBridge.sendMessageFromView({
                type: 'avatar-overlay-element-size-changed',
                isTrayVisible: false,
                mascot: { width: 80, height: 87 },
                tray: null,
            });
            return 'cleared ' + removed + ' cards + tray wrapper';
          })()
        `);
        console.log(r.result.value);
    } else {
        const r = await evalJS(ws, `
          (() => {
            // wipe previous mocks
            [...document.querySelectorAll('[data-dev-mock-card]')].forEach(n => n.remove());
            const existingWrap = document.querySelector('[data-dev-mock-tray]');
            if (existingWrap) existingWrap.remove();

            const N = ${COUNT};
            const titles = ['Mock task α', 'Mock task β', 'Mock task γ', 'Mock task δ', 'Mock task ε', 'Mock task ζ', 'Mock task η', 'Mock task θ'];
            const statuses = ['running', 'waiting', 'review', 'failed'];

            // Tray wrapper — fixed-positioned so React doesn't reconcile away.
            // Use the same data-avatar-overlay-size attrs as the real tray so
            // measurement / layout code recognizes the shape if it ever runs.
            const wrap = document.createElement('div');
            wrap.setAttribute('data-dev-mock-tray', 'true');
            wrap.setAttribute('data-avatar-overlay-size', 'notification-tray');
            wrap.style.cssText = 'position:fixed;top:8px;right:8px;width:296px;z-index:9999;pointer-events:auto;font-family:system-ui,sans-serif';

            const header = document.createElement('div');
            header.setAttribute('data-avatar-overlay-size', 'notification-tray-header');
            header.style.cssText = 'padding:6px 12px;font-size:11px;font-weight:600;opacity:.7;text-transform:uppercase;letter-spacing:.05em';
            header.textContent = 'Activity (mock)';
            wrap.appendChild(header);

            const listEl = document.createElement('div');
            listEl.setAttribute('data-avatar-overlay-size', 'notification-tray-list');
            listEl.setAttribute('role', 'list');
            listEl.style.cssText = 'display:flex;flex-direction:column;gap:4px';
            wrap.appendChild(listEl);

            const cardH = 56, gap = 4, headerH = 24;
            for (let i = 0; i < N; i++) {
                const row = document.createElement('div');
                row.setAttribute('role', 'listitem');
                row.setAttribute('data-avatar-overlay-measure', 'notification-tray-row');
                row.setAttribute('data-dev-mock-card', String(i+1));
                row.className = 'group no-drag relative w-full snap-start scroll-mt-2 text-left';
                row.style.cssText = 'background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:10px;padding:8px 12px;display:flex;align-items:center;gap:10px;box-shadow:0 1px 2px rgba(0,0,0,.04);height:'+cardH+'px;box-sizing:border-box';
                const hue = (i * 73) % 360;
                row.innerHTML = \`
                  <div style="width:32px;height:32px;border-radius:50%;flex:none;
                              display:flex;align-items:center;justify-content:center;
                              font-weight:600;font-size:12px;
                              background:hsl(\${hue},75%,85%);color:hsl(\${hue},50%,30%)">\${i+1}</div>
                  <div style="flex:1;min-width:0;overflow:hidden">
                    <div style="font-size:13px;font-weight:500;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${titles[i % titles.length]}</div>
                    <div style="font-size:11px;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">[\${statuses[i % statuses.length]}] mock card for hot-reload demo</div>
                  </div>
                \`;
                listEl.appendChild(row);
            }
            document.body.appendChild(wrap);

            // Tell main process the tray now exists so it grows the window.
            // Bounds are in screen px relative to mascot anchor; main does the math.
            const trayHeight = headerH + N * cardH + (N-1) * gap + 16;
            window.electronBridge.sendMessageFromView({
                type: 'avatar-overlay-element-size-changed',
                isTrayVisible: true,
                mascot: { width: 80, height: 87 },
                tray: { width: 296, height: trayHeight },
            });
            return { injected: N, trayHeight, totalCards: listEl.children.length };
          })()
        `);
        console.log(JSON.stringify(r.result.value));
    }
    ws.close();
})().catch(e => { console.error(e.message || e); process.exit(1); });
NODE
