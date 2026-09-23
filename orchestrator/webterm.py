"""The browser terminal: a websocket in front of the framed PTY stream.

One page and one websocket endpoint. `GET /` serves the terminal page from
`term/`, the built brayness-examples/terminal, shipped with this code
(built off-host); `GET /pty`
upgrades and then bridges websocket messages to the orchestrator's own terminal
stream on 127.0.0.1:8081 (`pty.py`), which is where the session's pty lives. This
module is transport, not terminal: it speaks the same frames and keeps one
protocol definition.

    127.0.0.1:8090/         the page, and a session for it if the URL names none
    127.0.0.1:8090/pty      websocket; query is the same hello (`?session=`, cols, rows)

A bare `GET /` is the door: the page cannot start a session itself (the API that
creates one is on loopback), so this server makes one in process and redirects to
the page with its id on the URL. Give it no `new_session` and it only serves
pages that already name one.

The websocket is RFC6455, implemented here on the stdlib rather than taking a
dependency: the orchestrator is stdlib by decision. Only text frames, ping, pong
and close are handled, which is all a typing terminal sends.
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
import socket
import struct
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

LOG = logging.getLogger(__name__)

PAGE_ROOT = Path(__file__).with_name("term")
CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".wasm": "application/wasm",
}
GUID = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
TEXT, CLOSE, PING, PONG = 0x1, 0x8, 0x9, 0xA


# ------------------------------------------------------------------ websocket
def read_exact(sock, count):
    """`count` bytes, or None when the peer closed. Blocking, which is why each
    direction gets its own thread rather than sharing a select loop with a
    frame parser."""
    buf = b""
    while len(buf) < count:
        chunk = sock.recv(count - len(buf))
        if not chunk:
            return None
        buf += chunk
    return buf


def read_frame(sock):
    """(opcode, payload, fin) or None. Browser frames are always masked."""
    header = read_exact(sock, 2)
    if header is None:
        return None
    first, second = header
    opcode = first & 0x0F
    fin = bool(first & 0x80)
    length = second & 0x7F
    if length == 126:
        length = struct.unpack("!H", read_exact(sock, 2))[0]
    elif length == 127:
        length = struct.unpack("!Q", read_exact(sock, 8))[0]
    mask = read_exact(sock, 4) if second & 0x80 else None
    payload = read_exact(sock, length) if length else b""
    if payload is None:
        return None
    if mask:
        payload = bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))
    return opcode, payload, fin


def write_frame(sock, opcode, payload):
    header = bytes([0x80 | opcode])
    length = len(payload)
    if length < 126:
        header += bytes([length])
    elif length < 1 << 16:
        header += bytes([126]) + struct.pack("!H", length)
    else:
        header += bytes([127]) + struct.pack("!Q", length)
    sock.sendall(header + payload)


def accept_key(key):
    return base64.b64encode(hashlib.sha1(key.encode() + GUID).digest()).decode()


# --------------------------------------------------------------------- bridge
def ws_to_pty(ws, pty):
    try:
        while True:
            frame = read_frame(ws)
            if frame is None:
                return
            opcode, payload, _ = frame
            if opcode == CLOSE:
                return
            if opcode == PING:
                write_frame(ws, PONG, payload)
                continue
            if opcode in (TEXT, 0x0):
                line = payload.decode(errors="replace").strip()
                if line:
                    pty.sendall(line.encode() + b"\n")
    except OSError:
        return
    finally:
        shutdown(pty)


def pty_to_ws(ws, pty):
    buf = b""
    try:
        while True:
            chunk = pty.recv(65536)
            if not chunk:
                return
            buf += chunk
            while b"\n" in buf:
                line, _, buf = buf.partition(b"\n")
                if line.strip():
                    write_frame(ws, TEXT, line)
    except OSError:
        return
    finally:
        try:
            write_frame(ws, CLOSE, b"")
        except OSError:
            pass
        shutdown(ws)


def shutdown(sock):
    try:
        sock.shutdown(socket.SHUT_RDWR)
    except OSError:
        pass


# --------------------------------------------------------------------- server
class WebTermHandler(BaseHTTPRequestHandler):
    server_version = "brayness-webterm/0.1"
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):
        LOG.info("%s - %s", self.address_string(), format % args)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in ("/", "/term", "/index.html"):
            return self._page(parsed)
        if parsed.path == "/pty" and self.headers.get("Upgrade", "").lower() == "websocket":
            return self._websocket(parsed)
        self._file(parsed.path)

    def _file(self, path):
        """A file from the built page: its hashed assets and the wasm."""
        root = PAGE_ROOT.resolve()
        target = (root / path.lstrip("/")).resolve()
        if root not in target.parents or not target.is_file():
            return self._text(404, b"no route\n")
        content_type = CONTENT_TYPES.get(target.suffix, "application/octet-stream")
        self._body(200, content_type, target.read_bytes())

    def _page(self, parsed):
        """The page, and a session for it when the URL does not name one.

        The page cannot start a session itself: the API that creates one is on
        loopback, and the browser would need that port open. So the door is here
        - a bare URL asks this server for a session, which it makes in process,
        and then serves the page that r5 proved with `?session=` on the URL. A
        refresh keeps the session it was given, and a second bare URL makes a
        second session, which is what an unauthenticated door does until h1.
        """
        query = parse_qs(parsed.query)
        if not (query.get("session") or [""])[0] and self.server.new_session is not None:
            try:
                record = self.server.new_session()
            except Exception as error:  # a stranger reads this page, not a log
                LOG.exception("could not create a session for a bare page")
                return self._text(502, f"could not start a session: {error}\n".encode())
            LOG.info("bare page: created %s", record.id)
            # The page runs `exec brayness` in the new shell, so pi's exit
            # lands in bash, as brayness-login.sh does.
            location = f"/?session={record.id}&exec=brayness"
            self.close_connection = True
            self.send_response(302)
            self.send_header("Location", location)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        index = PAGE_ROOT / "index.html"
        if not index.is_file():
            return self._text(503, b"no terminal page: term/ was not shipped\n")
        self._body(200, CONTENT_TYPES[".html"], index.read_bytes())

    def _text(self, status, body):
        self._body(status, "text/plain; charset=utf-8", body)

    def _body(self, status, content_type, body):
        # No keep-alive: one page, one websocket. Without this the base handler
        # reads another request after an error and logs a connection reset.
        self.close_connection = True
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _websocket(self, parsed):
        query = parse_qs(parsed.query)
        session = (query.get("session") or [""])[0]
        cols = (query.get("cols") or ["80"])[0]
        rows = (query.get("rows") or ["24"])[0]
        if not session:
            return self._text(400, b"no session\n")

        key = self.headers.get("Sec-WebSocket-Key")
        if not key:
            return self._text(400, b"no websocket key\n")

        try:
            pty = self._open_pty(session, cols, rows)
        except OSError as error:
            LOG.warning("pty bridge failed for %s: %s", session, error)
            return self._text(502, f"{error}\n".encode())

        self.send_response(101, "Switching Protocols")
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept_key(key))
        self.end_headers()
        self.wfile.flush()
        self.close_connection = True

        ws = self.connection
        out = threading.Thread(target=pty_to_ws, args=(ws, pty), daemon=True)
        out.start()
        ws_to_pty(ws, pty)
        out.join(timeout=2.0)
        pty.close()

    def _open_pty(self, session, cols, rows):
        """Connect to the framed stream and complete its hello, so a refusal
        (no such session) is a 502 on the websocket request rather than a
        confusing empty terminal."""
        sock = socket.create_connection(("127.0.0.1", self.server.stream_port), timeout=30.0)
        hello = json.dumps({"session": session, "cols": int(cols), "rows": int(rows)})
        sock.sendall(hello.encode() + b"\n")
        line = b""
        while b"\n" not in line:
            chunk = sock.recv(4096)
            if not chunk:
                break
            line += chunk
        answer = line.partition(b"\n")[0]
        if b'"error"' in answer:
            sock.close()
            raise OSError(answer.decode(errors="replace"))
        sock.settimeout(None)
        return sock


class WebTermServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, address, stream_port, new_session=None):
        self.stream_port = stream_port
        # A callable that returns a session record, or None to serve only pages
        # that already name one. Injected so this stays transport: it does not
        # need to know what a store is.
        self.new_session = new_session
        super().__init__(address, WebTermHandler)


def make_server(listen, port, stream_port, new_session=None):
    server = WebTermServer((listen, port), stream_port, new_session)
    LOG.info("browser terminal on %s:%s (pty stream %s%s)", listen, port, stream_port,
             ", makes a session for a bare URL" if new_session else "")
    return server
