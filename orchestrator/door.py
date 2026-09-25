"""The door: requests a session makes of its host, over guest-initiated vsock.

A guest that connects to CID 2 port DOOR_PORT reaches, through Firecracker, the
unix socket `<session>/vsock.sock_<DOOR_PORT>` on the host. Only that session's
VM can open it, so the socket is the session's identity: no token, no network.

One JSON line in, one JSON line out:

    {"op": "publish", "path": "/root/site"}
    {"ok": true, "url": "http://<id>.localhost:18080/"}

One listener per running session, kept in step with the session list by a
reconciler rather than hooks in every start, reload, and destroy path.
"""
from __future__ import annotations

import json
import logging
import os
import socket
import threading
import time

from . import sessions

LOG = logging.getLogger(__name__)

DOOR_PORT = 54
LINE_LIMIT = 1 << 16
RECONCILE_SECONDS = 0.5


def door_path(record):
    return f"{record.vsock_path}_{DOOR_PORT}"


class Door:
    def __init__(self, store, site_url="/s/{id}/"):
        self.store = store
        # Where a published site is seen, with {id} for the session.
        self.site_url = site_url
        self.listeners = {}  # session id -> (socket path, listening socket)

    def serve_forever(self):
        while True:
            try:
                self.reconcile()
            except Exception:  # a bad pass must not end the door for everyone
                LOG.exception("door reconcile failed")
            time.sleep(RECONCILE_SECONDS)

    def reconcile(self):
        live = {record.id: record for record in self.store.live_sessions()}
        for session_id in list(self.listeners):
            path, listener = self.listeners[session_id]
            if session_id not in live or not os.path.exists(path):
                listener.close()
                del self.listeners[session_id]
        for session_id, record in live.items():
            if session_id not in self.listeners:
                self._listen(record)

    def _listen(self, record):
        path = door_path(record)
        try:
            os.unlink(path)
        except FileNotFoundError:
            pass
        listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        listener.bind(path)
        listener.listen(4)
        self.listeners[record.id] = (path, listener)
        threading.Thread(target=self._accept, args=(record.id, listener), daemon=True).start()

    def _accept(self, session_id, listener):
        while True:
            try:
                conn, _ = listener.accept()
            except OSError:
                return  # closed by reconcile
            threading.Thread(target=self._handle, args=(session_id, conn), daemon=True).start()

    def _handle(self, session_id, conn):
        with conn:
            try:
                reply = self._answer(session_id, self._read_line(conn))
            except (sessions.BadRequest, ValueError) as error:
                reply = {"ok": False, "error": str(error)}
            except Exception as error:
                LOG.exception("door request from %s failed", session_id)
                reply = {"ok": False, "error": f"{type(error).__name__}: {error}"}
            try:
                conn.sendall(json.dumps(reply).encode() + b"\n")
            except OSError:
                pass

    def _read_line(self, conn):
        conn.settimeout(10)
        buf = b""
        while b"\n" not in buf:
            chunk = conn.recv(4096)
            if not chunk:
                break
            buf += chunk
            if len(buf) > LINE_LIMIT:
                raise ValueError("request line is too long")
        return json.loads(buf.partition(b"\n")[0] or b"{}")

    def _answer(self, session_id, request):
        if request.get("op") != "publish":
            raise ValueError(f"unknown op {request.get('op')!r}")
        path = request.get("path") or "/root/site"
        self.store.publish(session_id, path)
        LOG.info("door: %s published %s", session_id, path)
        return {"ok": True, "url": self.site_url.replace("{id}", session_id)}
