"""Local pty bridge for the dev server: one websocket is one shell process.

Speaks the orchestrator's pty protocol (text frames of JSON), so the page is
the same page a hosted session serves:

    client -> server   {"op": "data", "data_b64": "..."}
                       {"op": "resize", "cols": 100, "rows": 30}
    server -> client   {"op": "data", "data_b64": "..."}
                       {"op": "exit", "code": 0}

The relay does not parse VT. Vite starts it and proxies /pty to it
(vite.config.js). The command is TERMINAL_COMMAND, default `pi`.

Run alone: python3 bridge.py [port]
"""
from __future__ import annotations

import base64
import fcntl
import hashlib
import json
import os
import pty
import shlex
import signal
import struct
import subprocess
import sys
import termios
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

COMMAND = shlex.split(os.environ.get("TERMINAL_COMMAND", "pi"))
GUID = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
TEXT, BINARY, CLOSE, PING, PONG = 0x1, 0x2, 0x8, 0x9, 0xA


# ------------------------------------------------------------------ websocket
def read_exact(sock, count):
    buf = b""
    while len(buf) < count:
        chunk = sock.recv(count - len(buf))
        if not chunk:
            return None
        buf += chunk
    return buf


def read_frame(sock):
    header = read_exact(sock, 2)
    if header is None:
        return None
    first, second = header
    opcode = first & 0x0F
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
    return opcode, payload


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


def shutdown(sock):
    try:
        sock.shutdown(2)
    except OSError:
        pass


# ---------------------------------------------------------------------- pty
def spawn(cols, rows):
    master, slave = pty.openpty()
    fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
    env = dict(os.environ)
    env["TERM"] = "xterm-256color"
    env["COLORTERM"] = "truecolor"
    proc = subprocess.Popen(
        COMMAND,
        stdin=slave,
        stdout=slave,
        stderr=slave,
        env=env,
        start_new_session=True,
        close_fds=True,
    )
    os.close(slave)
    return master, proc


def set_winsize(master, cols, rows):
    fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))


def send_json(ws, message):
    write_frame(ws, TEXT, json.dumps(message).encode())


def pty_to_ws(ws, master, proc):
    try:
        while True:
            try:
                chunk = os.read(master, 65536)
            except OSError:
                return
            if not chunk:
                return
            send_json(ws, {"op": "data", "data_b64": base64.b64encode(chunk).decode()})
    except OSError:
        return
    finally:
        try:
            send_json(ws, {"op": "exit", "code": proc.wait(timeout=2.0)})
        except (OSError, subprocess.TimeoutExpired):
            pass
        try:
            write_frame(ws, CLOSE, b"")
        except OSError:
            pass
        shutdown(ws)


def ws_to_pty(ws, master, proc):
    try:
        while True:
            frame = read_frame(ws)
            if frame is None:
                return
            opcode, payload = frame
            if opcode == CLOSE:
                return
            if opcode == PING:
                write_frame(ws, PONG, payload)
                continue
            if opcode != TEXT:
                continue
            try:
                message = json.loads(payload)
            except ValueError:
                continue
            if message.get("op") == "data":
                os.write(master, base64.b64decode(message["data_b64"]))
            elif message.get("op") == "resize":
                set_winsize(master, int(message["cols"]), int(message["rows"]))
    except OSError:
        return
    finally:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            pass
        try:
            os.close(master)
        except OSError:
            pass
        shutdown(ws)


# --------------------------------------------------------------------- server
class BridgeHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/pty" and self.headers.get("Upgrade", "").lower() == "websocket":
            return self._websocket(parsed)
        return self._text(404, b"only /pty\n")

    def _text(self, status, body):
        self._body(status, "text/plain; charset=utf-8", body)

    def _body(self, status, content_type, body):
        self.close_connection = True
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _websocket(self, parsed):
        query = parse_qs(parsed.query)
        cols = int((query.get("cols") or ["100"])[0])
        rows = int((query.get("rows") or ["30"])[0])
        key = self.headers.get("Sec-WebSocket-Key")
        if not key:
            return self._text(400, b"no websocket key\n")

        master, proc = spawn(cols, rows)

        self.send_response(101, "Switching Protocols")
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept_key(key))
        self.end_headers()
        self.wfile.flush()
        self.close_connection = True

        ws = self.connection
        out = threading.Thread(target=pty_to_ws, args=(ws, master, proc), daemon=True)
        out.start()
        ws_to_pty(ws, master, proc)
        out.join(timeout=2.0)
        try:
            proc.wait(timeout=2.0)
        except subprocess.TimeoutExpired:
            pass


class BridgeServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("BRIDGE_PORT", "8779"))
    server = BridgeServer(("127.0.0.1", port), BridgeHandler)
    print(f"bridge on 127.0.0.1:{port}, running {shlex.join(COMMAND)}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
