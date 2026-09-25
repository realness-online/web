"""The session terminal: a framed TCP stream into a guest pty.

One TCP connection is one terminal. The client's first line is a hello naming
the session and the window size; the server answers `{"ok": true}`, and from then
on the two sides exchange frames that the relay does not parse:

    client -> server   {"op": "data", "data_b64": "..."}
                       {"op": "resize", "cols": 100, "rows": 30}
    server -> client   {"op": "data", "data_b64": "..."}
                       {"op": "exit", "code": 0}

Those frames are the guest agent's (`brayness-pty`, vsock port 53). The relay
just copies bytes, so the protocol has one definition and the browser websocket
(r5) can speak the same one. Base64 keeps a terminal's binary intact; lines are
the framing f2 already proved for the exec channel.

The terminal outlives the connection: the guest's brayness-pty holds the shell
and Pi, and a reconnect reattaches to them. An
idle session is reloaded before the shell starts, so the tiers are invisible
here too.

Needs root only because the vsock socket does (Firecracker creates it as root).
"""
from __future__ import annotations

import json
import logging
import select
import socketserver

from . import firecracker, host, sessions, vsock

LOG = logging.getLogger(__name__)

PTY_PORT = sessions.PTY_PORT
HELLO_LIMIT = 1 << 16


class PtyError(RuntimeError):
    """The client's hello was unusable."""


def read_hello(sock, limit=HELLO_LIMIT):
    """One newline-terminated line, raw, plus whatever followed it.

    Raw rather than a buffered reader for the same reason as vsock.read_line:
    the relay selects on this socket, and read-ahead would hide bytes from it.
    """
    buf = b""
    while b"\n" not in buf:
        chunk = sock.recv(4096)
        if not chunk:
            return None, buf
        buf += chunk
        if len(buf) > limit:
            raise PtyError("hello line is too long")
    line, _, leftover = buf.partition(b"\n")
    return line, leftover


class PtyHandler(socketserver.BaseRequestHandler):
    """One connection: hello, then a byte pump between the client and the
    session's own vsock socket. The vsock path is what keeps terminals in
    different sessions apart - there is no session id in the frames."""

    def handle(self):
        client = self.request
        client.settimeout(self.server.hello_timeout)
        try:
            hello, leftover = read_hello(client)
        except PtyError as error:
            return self._reject(str(error))
        except OSError:
            # Timed out or reset before a hello arrived: nothing to answer.
            return
        if hello is None:
            return

        request = self._parse_hello(hello)
        if request is None:
            return
        session_id, cols, rows = request

        try:
            record = self.server.store.ensure_running(session_id)
            guest = vsock.connect(record.vsock_path, PTY_PORT)
        except sessions.NotFound:
            return self._reject(f"no such session {session_id}")
        except (vsock.VsockError, firecracker.FirecrackerError, host.HostError, sessions.Busy) as error:
            return self._reject(str(error))

        LOG.info("pty attached to %s from %s", session_id, self.client_address[0])
        try:
            guest.sendall(json.dumps({"op": "resize", "cols": cols, "rows": rows}).encode() + b"\n")
            client.sendall(b'{"ok": true}\n')
            client.settimeout(None)
            if leftover:
                guest.sendall(leftover)
            self._pump(client, guest)
        except OSError as error:
            LOG.info("pty for %s ended: %s", session_id, error)
        finally:
            guest.close()
        LOG.info("pty detached from %s", session_id)

    def _parse_hello(self, hello):
        """The hello as (session_id, cols, rows), or None after refusing."""
        try:
            request = json.loads(hello)
            session_id = request["session"]
            cols = int(request.get("cols") or 80)
            rows = int(request.get("rows") or 24)
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
            self._reject(f"bad hello: {error}")
            return None
        if not isinstance(session_id, str) or not session_id:
            self._reject("hello needs a session id")
            return None
        return session_id, cols, rows

    def _pump(self, client, guest):
        """Copy in both directions until either end closes. A terminal can sit
        idle for a long time, so this waits rather than times out."""
        while True:
            readable, _, _ = select.select([client, guest], [], [])
            for source in readable:
                chunk = source.recv(65536)
                if not chunk:
                    return
                (guest if source is client else client).sendall(chunk)

    def _reject(self, message):
        LOG.warning("pty refused: %s", message)
        try:
            self.request.sendall(json.dumps({"error": message}).encode() + b"\n")
        except OSError:
            pass


class PtyServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, store, address, hello_timeout=30.0):
        self.store = store
        self.hello_timeout = hello_timeout
        super().__init__(address, PtyHandler)


def make_server(store, listen, port, hello_timeout=30.0):
    server = PtyServer(store, (listen, port), hello_timeout)
    LOG.info("pty stream on %s:%s", listen, port)
    return server


def serve(store, listen, port, hello_timeout=30.0):
    server = make_server(store, listen, port, hello_timeout)
    server.serve_forever()
    return server
