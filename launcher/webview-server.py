#!/usr/bin/env python3
import ctypes
import ctypes.util
import functools
import http.server
import os
import signal
import sys
import threading
import time


def _install_parent_death_signal():
    # Ensure the kernel terminates this process if the launcher (parent) exits
    # without invoking its cleanup trap (SIGKILL, OOM, crash). Without this,
    # the HTTP server can outlive the launcher and block its webview port,
    # which is fatal for multi-instance launches pinned to a single port.
    if sys.platform != "linux":
        return
    libc_name = ctypes.util.find_library("c") or "libc.so.6"
    try:
        libc = ctypes.CDLL(libc_name, use_errno=True)
    except OSError:
        return
    PR_SET_PDEATHSIG = 1
    if libc.prctl(PR_SET_PDEATHSIG, signal.SIGTERM, 0, 0, 0) != 0:
        return
    # The parent may have died between fork() and prctl(); in that case the
    # death signal never fires. Bail out now so the port is freed promptly.
    if os.getppid() == 1:
        os._exit(0)


_install_parent_death_signal()


port = int(sys.argv[1])
bind = "127.0.0.1"
if len(sys.argv) >= 4 and sys.argv[2] == "--bind":
    bind = sys.argv[3]


# Dev hot-reload: when enabled, the server keeps an SSE channel that a tiny
# injected client subscribes to, and reloads the renderer on POST to
# /dev/notify-reload. Gated so production behavior is byte-identical when off.
DEV_RELOAD = os.environ.get("CODEX_LINUX_DEV_RELOAD") == "1"
RELOAD_CLIENT = (
    b"<script>"
    b"(()=>{const r=()=>{const e=new EventSource('/dev/reload');"
    b"e.addEventListener('reload',()=>location.reload());"
    b"e.onerror=()=>{e.close();setTimeout(r,1000)}};r()})();"
    b"</script>"
)

_reload_clients_lock = threading.Lock()
_reload_clients = []  # list of wfile streams holding open SSE connections


def _broadcast_reload():
    with _reload_clients_lock:
        dead = []
        for wfile in _reload_clients:
            try:
                wfile.write(b"event: reload\ndata: 1\n\n")
                wfile.flush()
            except Exception:
                dead.append(wfile)
        for wfile in dead:
            _reload_clients.remove(wfile)


class CodexWebviewHandler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        for header in ("If-Modified-Since", "If-None-Match"):
            if header in self.headers:
                del self.headers[header]
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        if DEV_RELOAD:
            if self.path == "/dev/reload":
                self._serve_sse()
                return
            if self.path == "/dev/notify-reload":
                _broadcast_reload()
                self.send_response(204)
                self.end_headers()
                return
            if self._is_html_request():
                self._serve_html_with_inject()
                return
        super().do_GET()

    def do_POST(self):
        if DEV_RELOAD and self.path == "/dev/notify-reload":
            _broadcast_reload()
            self.send_response(204)
            self.end_headers()
            return
        self.send_response(405)
        self.end_headers()

    def _is_html_request(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return os.path.exists(os.path.join(path, "index.html"))
        return path.endswith(".html")

    def _serve_html_with_inject(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            path = os.path.join(path, "index.html")
        try:
            with open(path, "rb") as f:
                content = f.read()
        except FileNotFoundError:
            self.send_error(404)
            return
        if b"</head>" in content:
            content = content.replace(b"</head>", RELOAD_CLIENT + b"</head>", 1)
        else:
            content = RELOAD_CLIENT + content
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _serve_sse(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        with _reload_clients_lock:
            _reload_clients.append(self.wfile)
        try:
            while True:
                time.sleep(30)
                self.wfile.write(b": ping\n\n")
                self.wfile.flush()
        except Exception:
            pass
        finally:
            with _reload_clients_lock:
                if self.wfile in _reload_clients:
                    _reload_clients.remove(self.wfile)


handler = functools.partial(CodexWebviewHandler, directory=".")
with http.server.ThreadingHTTPServer((bind, port), handler) as httpd:
    httpd.serve_forever()
