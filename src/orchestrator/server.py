"""The HTTP API: sessions over the host's network.

    GET    /v1/health              seed state, session counts
    GET    /v1/sessions            every session in the volume
    POST   /v1/sessions            create one ({"restore_from": id} restores a bundle)
    GET    /v1/sessions/{id}       one session
    DELETE /v1/sessions/{id}       destroy one
    POST   /v1/sessions/{id}/exec  run argv in one session
    POST   /v1/sessions/{id}/idle  put a session down (memory or disk tier)
    POST   /v1/sessions/{id}/reload  bring it back
    POST   /v1/sessions/{id}/export  write it out as artifacts + trace
    POST   /v1/sessions/{id}/publish copy a directory out, serve it at /s/{id}/
    GET    /v1/sessions/{id}/trace   its events
    GET    /v1/exports             every bundle in the volume
    GET    /s/{id}/<file>          a published site
    GET    /mermaid.min.js         the diagram bundle every page may ask for

Create is the slow one - it reflinks a disk, loads a snapshot, and waits for the
guest's control channel - so it answers with the session it made rather than a
job id. Nothing here is asynchronous yet; the plan's idle tiering is what will
need that.

Errors are JSON: 400 for a malformed request, 404 for an unknown session or
route, 500 with the message from the host or Firecracker layer, which is where
the fix usually is.
"""
from __future__ import annotations

import base64
import binascii
import json
import logging
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from . import firecracker, host, sessions, vsock

LOG = logging.getLogger(__name__)

# What the host serves beside the API: a published site at /s/<id>/, and the
# mermaid bundle a built page asks for by absolute path. The bundle rides with
# the orchestrator rather than in each site, so a published tree stays small.
STATIC_DIR = Path(__file__).with_name("static")
MERMAID_BUNDLE = STATIC_DIR / "mermaid.min.js"
CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
}


class ApiHandler(BaseHTTPRequestHandler):
    server_version = "brayness-orchestrator/0.1"
    protocol_version = "HTTP/1.1"

    @property
    def store(self):
        return self.server.store

    def log_message(self, format, *args):
        LOG.info("%s - %s", self.address_string(), format % args)

    # ------------------------------------------------------------- routing
    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path == "/mermaid.min.js":
            return self._bundle(MERMAID_BUNDLE)
        if path == "/v1/health":
            return self._health()
        if path == "/v1/sessions":
            return self._json(200, {"sessions": [r.to_json() for r in self.store.list()]})
        if path == "/v1/exports":
            return self._json(200, {"exports": self.store.exports()})
        if path.startswith("/s/"):
            return self._site(path)
        if path.startswith("/v1/sessions/"):
            tail = path[len("/v1/sessions/"):]
            session_id, _, action = tail.partition("/")
            if action == "trace":
                return self._json(200, {"events": self.store.trace(session_id)})
            return self._one(tail)
        self._json(404, {"error": f"no route for GET {path}"})

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path == "/v1/sessions":
            return self._attempt(lambda: (201, self._create_or_restore().to_json()))
        if path.startswith("/v1/sessions/"):
            tail = path[len("/v1/sessions/"):]
            session_id, _, action = tail.partition("/")
            if action == "exec":
                return self._attempt(lambda: (200, self._exec(session_id)))
            if action == "idle":
                return self._attempt(lambda: (200, self._idle(session_id)))
            if action == "reload":
                self._drain_body()
                return self._attempt(lambda: (200, self.store.reload(session_id).to_json()))
            if action == "export":
                self._drain_body()
                return self._attempt(lambda: (200, self.store.export(session_id)))
            if action == "publish":
                return self._attempt(lambda: (200, self._publish(session_id)))
        self._drain_body()
        self._json(404, {"error": f"no route for POST {path}"})

    def do_DELETE(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        if not path.startswith("/v1/sessions/"):
            return self._json(404, {"error": f"no route for DELETE {path}"})
        session_id = path.rsplit("/", 1)[-1]
        self._attempt(lambda: (204, self.store.destroy(session_id).to_json()))

    # ------------------------------------------------------------ handlers
    def _health(self):
        seed = self.store.seed_status()
        records = self.store.list()
        counts = {}
        for record in records:
            counts[record.state] = counts.get(record.state, 0) + 1
        self._json(200, {
            "ok": True,
            "seed": {
                "built": seed["built"],
                "matches": seed["matches"],
                "mismatches": seed["mismatches"],
                "machine_id": (seed["record"] or {}).get("machine_id"),
                "boot_id": (seed["record"] or {}).get("boot_id"),
                "created": (seed["record"] or {}).get("created"),
            },
            "sessions": counts,
        })

    def _one(self, session_id):
        self._attempt(lambda: (200, self.store.get(session_id).to_json()))

    def _publish(self, session_id):
        """POST /v1/sessions/{id}/publish. `path` is a directory in the guest."""
        payload = self._read_json()
        tree = payload.get("path") or "/root/site"
        if not isinstance(tree, str):
            raise sessions.BadRequest("path must be a string")
        return self.store.publish(session_id, tree)

    # ------------------------------------------------------------- published
    def _site(self, path):
        """GET /s/<id>/<file>: a published tree, served from the host."""
        session_id, _, rel = path[len("/s/"):].partition("/")
        if not rel:
            rel = "index.html"
        root = self.store.published_site(session_id)
        if root is None:
            return self._plain(404, f"nothing published for {session_id}")
        target = (root / rel).resolve()
        if not target.is_relative_to(root.resolve()):
            return self._plain(403, "that path leaves the published site")
        if not target.is_file():
            return self._plain(404, f"no {rel} in {session_id}")
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPES.get(target.suffix.lower(), "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _bundle(self, path):
        """A file the host serves for every published site."""
        if not path.is_file():
            return self._plain(404, f"no {path.name} on this host")
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/javascript; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "public, max-age=86400")
        self.end_headers()
        self.wfile.write(body)

    def _plain(self, status, message):
        body = (message + "\n").encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _create_or_restore(self):
        """POST /v1/sessions: a new session, or a bundle landed on a fresh one."""
        payload = self._read_json()
        restore_from = payload.get("restore_from")
        if restore_from is None:
            return self.store.create()
        if not isinstance(restore_from, str) or not restore_from:
            raise sessions.BadRequest("restore_from must be an export id")
        return self.store.restore(restore_from)

    def _exec(self, session_id):
        """POST /v1/sessions/{id}/exec. Output stays base64 so binary survives
        JSON; a non-zero exit code is a 200, because the exec itself ran."""
        payload = self._read_json()
        stdin_b64 = payload.get("stdin_b64") or ""
        if not isinstance(stdin_b64, str):
            raise sessions.BadRequest("stdin_b64 must be a base64 string")
        try:
            stdin = base64.b64decode(stdin_b64, validate=True)
        except (binascii.Error, ValueError) as error:
            raise sessions.BadRequest(f"stdin_b64 is not base64: {error}")
        return self.store.exec_command(
            session_id, payload.get("argv"), cwd=payload.get("cwd"), stdin=stdin
        )

    def _idle(self, session_id):
        """POST /v1/sessions/{id}/idle. `tier` is `memory` (default) or `disk`."""
        payload = self._read_json()
        tier = payload.get("tier") or "memory"
        if not isinstance(tier, str):
            raise sessions.BadRequest("tier must be a string")
        return self.store.idle(session_id, tier).to_json()

    def _attempt(self, action):
        """Run a store action and turn its failure into a status code."""
        try:
            status, payload = action()
        except sessions.BadRequest as error:
            return self._json(400, {"error": str(error)})
        except sessions.NotFound:
            return self._json(404, {"error": "no such session"})
        except (sessions.Busy, host.HostError, firecracker.FirecrackerError, vsock.VsockError) as error:
            LOG.warning("request failed: %s", error)
            return self._json(500, {"error": str(error)})
        except OSError as error:
            LOG.exception("request failed")
            return self._json(500, {"error": f"{type(error).__name__}: {error}"})
        self._json(status, payload)

    # ------------------------------------------------------------ plumbing
    def _drain_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length:
            self.rfile.read(length)

    def _read_json(self):
        """The request body as a JSON object. An empty body is {}."""
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        if not raw:
            return {}
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as error:
            raise sessions.BadRequest(f"body is not JSON: {error}")
        if not isinstance(payload, dict):
            raise sessions.BadRequest("body must be a JSON object")
        return payload

    def _json(self, status, payload):
        body = b"" if status == 204 else json.dumps(payload, indent=2).encode() + b"\n"
        self.send_response(status)
        if body:
            self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)


def make_server(store, listen, port):
    server = ThreadingHTTPServer((listen, port), ApiHandler)
    server.store = store
    server.daemon_threads = True
    return server


def serve(store, listen, port):
    server = make_server(store, listen, port)
    LOG.info("listening on %s:%s", listen, port)
    server.serve_forever()
    return server