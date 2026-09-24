"""The seed, and a session's create/destroy cycle.

Two shapes, both proved by the node scripts they come from.

The seed is one booted template, paused and snapshotted (f4). Building it also
does the only cross-filesystem copy there is: the template lives on the host's
root disk, session disks have to live on the sessions volume for reflink to work
(f5b), so the seed holds the volume's own copy of `rootfs.ext4`. The seed is
never session-initialized - if it were, its id would be on its disk and every
clone would sit out init as "already this session" (f6's idempotence).

A session is a directory plus a process (f5c). The directory holds the disk it
writes, its sockets, its record and its log; Firecracker runs with that
directory as cwd, because a snapshot records its drive path relative to cwd
(f5a). Creating one is: reflink the seed disk, take a TAP, load the snapshot with
that TAP and a fresh vsock socket, wait for the agent, then run
`brayness-session-init` to set the clock and mint an identity (f6).

A failed create rolls back everything it took. Nothing half-built is left in the
volume, because a leftover TAP or process is invisible in a list of sessions.

Idle holds rented capacity, but a volume is rented capacity too. `export` writes
a session out as a bundle - its home directory as a tar, plus its trace - and
`restore` lands that bundle on a fresh disk. The session is stopped for both,
which is what makes the disk safe to mount on the host: a running guest writes
underneath a mount. Identity is not in the bundle (it lives in `/etc`), so two
restores of one export are two sessions.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import logging
import platform
import secrets
import shutil
import tarfile
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from . import firecracker, host, vsock

LOG = logging.getLogger(__name__)

# The disk filename inside the seed and every session directory.
DISK_NAME = "rootfs.ext4"
SESSION_STATE = "state"
SESSION_MEM = "mem"
SESSION_INIT = "/usr/local/bin/brayness-session-init"
FINGERPRINT_SCHEMA = 1
# Cheap fields decide whether a seed is stale. The sha256 is recorded, not
# re-checked at startup: hashing a 1.8 GiB template on every start buys nothing
# the size and mtime do not already say.
CHEAP_FIELDS = ("schema", "arch", "kernel", "firecracker", "template_size", "template_mtime_ns")
# What an export carries: the session's home directory, which holds the harness
# (`/root/brayness`) and its work/. Identity (`/etc`) is not an artifact -
# restoring an identity would make two sessions share one. Widening this tuple
# is the whole change if that moves.
ARTIFACT_PATHS = ("root",)
TRACE_DIR = "traces"
EXPORT_DIR = "exports"
# A published site: a directory copied out of a session and served by the host.
# Killed with the session - it is a copy for looking at, not a durable artifact;
# the bundle from `export` is the durable one.
PUBLISH_DIR = "published"
# Volume entries that are not sessions. `list` reads the volume, so a new kind
# of directory here has to be named or it is reported as an incomplete session.
NON_SESSION_DIRS = frozenset({"seed", TRACE_DIR, EXPORT_DIR, PUBLISH_DIR})


class NotFound(LookupError):
    """No such session in the volume."""


class Busy(RuntimeError):
    """The volume is in use and this would pull the ground out from under it."""


class BadRequest(ValueError):
    """The caller's request is malformed. The HTTP layer turns it into a 400."""


@dataclass
class Session:
    id: str
    created: str
    tap: str
    pid: int
    directory: Path
    api_sock: Path
    vsock_path: Path
    machine_id: str = ""
    hostname: str = ""
    boot_id: str = ""
    state: str = field(default="running")

    def to_json(self):
        return {
            "id": self.id,
            "state": self.state,
            "created": self.created,
            "tap": self.tap,
            "pid": self.pid,
            "hostname": self.hostname,
            "machine_id": self.machine_id,
            "boot_id": self.boot_id,
            "dir": str(self.directory),
        }


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256_file(path, chunk=1 << 20):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(chunk), b""):
            digest.update(block)
    return digest.hexdigest()


def mint_id():
    """Session ids are hex in the shape f6 hands out, so the guest's
    session-to-hostname derivation stays readable."""
    return f"s-{secrets.token_hex(6)}"


class SessionStore:
    def __init__(self, volume, template, kernel, firecracker_binary, guest_mac,
                 guest_cid=3, vsock_port=vsock.VSOCK_PORT, vcpu_count=2, mem_mib=512,
                 tap_prefix="fc-tap", boot_timeout=60.0, api_timeout=30.0, seed_tap="fc-tap0"):
        self.volume = Path(volume)
        self.template = Path(template)
        self.kernel = Path(kernel)
        self.firecracker = Path(firecracker_binary)
        self.guest_mac = guest_mac
        self.guest_cid = guest_cid
        self.vsock_port = vsock_port
        self.vcpu_count = vcpu_count
        self.mem_mib = mem_mib
        self.tap_prefix = tap_prefix
        self.boot_timeout = boot_timeout
        self.api_timeout = api_timeout
        self.seed_tap = seed_tap
        self.seed_dir = self.volume / "seed"
        self.traces_dir = self.volume / TRACE_DIR
        self.exports_dir = self.volume / EXPORT_DIR
        self.published_dir = self.volume / PUBLISH_DIR
        self._lock = threading.RLock()
        # Asked for once: it runs the binary, and it feeds the seed fingerprint.
        self.firecracker_version = firecracker.version(self.firecracker)
        self._check_host()

    # ------------------------------------------------------------------ host
    def _check_host(self):
        host.require_root("creating TAPs and Firecracker")
        host.require_mount(str(self.volume), "mount the sessions volume (the dev stack script)")
        sample = self.volume / mint_id() / "vsock.sock"
        if not host.is_short_enough_for_af_unix(sample):
            raise host.HostError(
                f"{self.volume} is too long for AF_UNIX socket paths (108 bytes); "
                "mount the sessions volume somewhere shorter"
            )

    def reflink_warning(self):
        return host.warn_if_no_reflink(str(self.volume))

    # ------------------------------------------------------------------ seed
    def cheap_fingerprint(self):
        """What the seed has to match to be reusable, without reading the
        template's bytes: a 1.8 GiB hash on every start buys nothing size and
        mtime do not already say."""
        stat = self.template.stat()
        return {
            "schema": FINGERPRINT_SCHEMA,
            "arch": platform.machine(),
            "kernel": self.kernel.name,
            "firecracker": self.firecracker_version,
            "template_size": stat.st_size,
            "template_mtime_ns": stat.st_mtime_ns,
        }

    def build_fingerprint(self):
        """The record written next to a seed: what it was built from, sha256
        included, so a later audit can say what the sessions forked from."""
        record = self.cheap_fingerprint()
        record["template_sha256"] = sha256_file(self.template)
        return record

    def seed_status(self):
        """Whether a seed exists, and whether it matches the current build.

        A stale seed forks quietly with an old kernel or an old pi, so the
        mismatch has to be loud - and the sha256 in the record is what tells a
        human later what was actually forked from.
        """
        record_path = self.seed_dir / "seed.json"
        state = {"built": False, "matches": False, "mismatches": [], "record": None}
        if not record_path.exists() or not (self.seed_dir / "state").exists():
            return state
        record = read_json(record_path)
        state["built"] = True
        state["record"] = record
        current = self.cheap_fingerprint()
        for key in CHEAP_FIELDS:
            if record.get(key) != current[key]:
                state["mismatches"].append(f"{key}: {record.get(key)} != {current[key]}")
        state["matches"] = not state["mismatches"]
        return state

    def ensure_seed(self, rebuild=False):
        status = self.seed_status()
        if status["matches"] and not rebuild:
            return status
        if rebuild and self.live_sessions():
            raise Busy("sessions are running from this seed; destroy them before --rebuild-seed")
        self.build_seed(status)
        return self.seed_status()

    def build_seed(self, status=None):
        """Boot the template once, snapshot it, and stop it.

        Kept as a direct translation of f6's seed section: the same boot, the
        same pause, the same Full snapshot. The markers it writes are not for
        the seed - they are what lets a later check prove a session did not
        inherit the seed's boot (f6a).
        """
        if status is None:
            status = self.seed_status()
        target = self.seed_dir
        if status["built"]:
            LOG.warning("seed does not match the current build: %s", "; ".join(status["mismatches"]))
        LOG.info("building the seed from %s", self.template)
        if target.exists():
            shutil.rmtree(target)
        target.mkdir(parents=True)

        disk = target / DISK_NAME
        host.run(["cp", "--sparse=always", str(self.template), str(disk)])

        if not host.tap_exists(self.seed_tap):
            raise host.HostError(f"no {self.seed_tap}: run 'sudo bash orchestrator/scripts/net-up.sh' first")

        api_sock = target / "api.sock"
        uds_path = target / "vsock.sock"
        for stale in (api_sock, uds_path):
            stale.unlink(missing_ok=True)

        LOG.info("booting the template")
        process = firecracker.spawn(self.firecracker, target, api_sock, target / "firecracker.log")
        try:
            firecracker.wait_for_api_socket(api_sock)
            api = firecracker.Api(api_sock, self.api_timeout)
            firecracker.boot(
                api, self.kernel, DISK_NAME, self.seed_tap, uds_path, self.guest_mac,
                self.guest_cid, self.vcpu_count, self.mem_mib,
            )
            vsock.wait_for_agent(uds_path, self.boot_timeout, self.vsock_port)
            vsock.exec_in_guest(
                uds_path,
                ["/bin/sh", "-c",
                 "logger -t brayness-seed 'seed boot marker'; touch /tmp/brayness-seed-marker; sync"],
                timeout=self.api_timeout,
                port=self.vsock_port,
            )
            identity = self.identity(uds_path)
            LOG.info("seed is up: hostname %s", identity["hostname"])

            LOG.info("pausing and snapshotting")
            firecracker.pause(api)
            firecracker.create_snapshot(api, target / "state", target / "mem")
        finally:
            firecracker.terminate(process.pid)

        record = self.build_fingerprint()
        record.update({
            "created": now_iso(),
            "machine_id": identity["machine_id"],
            "boot_id": identity["boot_id"],
        })
        write_json(target / "seed.json", record)
        LOG.info("seed built: %s", target)
        return record

    # -------------------------------------------------------------- sessions
    def create(self):
        with self._lock:
            seed = self.ensure_seed()
            if not seed["matches"]:
                raise Busy(f"seed does not match the current build: {'; '.join(seed['mismatches'])}")

            session_id = mint_id()
            directory = self.volume / session_id
            record = Session(
                id=session_id,
                created=now_iso(),
                tap="",
                pid=0,
                directory=directory,
                api_sock=directory / "api.sock",
                vsock_path=directory / "vsock.sock",
            )
            try:
                directory.mkdir(parents=True)
                self._reflink_seed_disk(directory)
                record.tap = host.free_tap(self.tap_prefix)
                host.create_tap(record.tap)
                self._start(record, self.seed_dir / SESSION_STATE, self.seed_dir / SESSION_MEM)
                identity = self._init_session(record)
                record.machine_id = identity["machine_id"]
                record.hostname = identity["hostname"]
                record.boot_id = identity["boot_id"]
                self._write(record)
                self._trace(record.id, "create", hostname=record.hostname,
                            machine_id=record.machine_id, tap=record.tap, pid=record.pid)
            except BaseException:
                LOG.warning("create failed for %s, rolling back", session_id)
                self._teardown(record)
                raise
            LOG.info("session %s running (tap %s, pid %s)", record.id, record.tap, record.pid)
            return record

    def _reflink_seed_disk(self, directory):
        source = self.seed_dir / DISK_NAME
        try:
            host.run(["cp", "--reflink=always", str(source), str(directory / DISK_NAME)])
        except host.HostError as error:
            raise host.HostError(
                f"reflink failed: {error}\n"
                f"session disks are reflinks of {source}, which needs xfs (or btrfs) at {self.volume}"
            ) from error

    def _start(self, record, state_path, mem_path):
        """Load a snapshot as this session: its TAP, its vsock socket, and (from
        the process cwd) its own disk. Both idle tiers end here; `state_path`
        decides whether it resumes the session's memory or the seed's."""
        # Terminating a process leaves its sockets behind, and Firecracker cannot
        # bind an api-sock path that already exists.
        for stale in (record.api_sock, record.vsock_path):
            stale.unlink(missing_ok=True)
        process = firecracker.spawn(
            self.firecracker, record.directory, record.api_sock, record.directory / "firecracker.log"
        )
        # The Popen pid is Firecracker itself: no jailer, no sudo wrapper.
        record.pid = process.pid
        try:
            firecracker.wait_for_api_socket(record.api_sock)
            api = firecracker.Api(record.api_sock, self.api_timeout)
            firecracker.load_snapshot(api, state_path, mem_path, record.tap, record.vsock_path)
            vsock.wait_for_agent(record.vsock_path, self.boot_timeout, self.vsock_port)
        except BaseException:
            firecracker.terminate(record.pid)
            raise

    def _init_session(self, record):
        """Turn the resumed clone into this session (f6).

        The step that is easy to lose: without it the clone is the seed's boot
        resumed, with the seed's identity, journal and clock.
        """
        code, out, err = vsock.exec_in_guest(
            record.vsock_path,
            [SESSION_INIT, record.id, str(int(time.time())), f"{host.tap_guest(record.tap)}/30"],
            timeout=self.boot_timeout,
            port=self.vsock_port,
        )
        if code != 0:
            raise vsock.VsockError(
                f"session-init on {record.id} exited {code}: {err.decode(errors='replace').strip()}"
            )
        LOG.info("session %s initialized: %s", record.id, out.decode(errors="replace").strip())
        return self.identity(record.vsock_path)

    def identity(self, uds_path):
        output = vsock.run_ok(
            uds_path,
            ["/bin/sh", "-c",
             'printf "%s %s %s %s\\n" "$(cat /etc/machine-id)" "$(hostname)"'
             ' "$(cat /proc/sys/kernel/random/boot_id)" "$(date +%s)"'],
            timeout=self.api_timeout,
            port=self.vsock_port,
        )
        machine_id, hostname, boot_id, clock = output.split()
        return {"machine_id": machine_id, "hostname": hostname, "boot_id": boot_id, "clock": int(clock)}

    def exec_command(self, session_id, argv, cwd=None, stdin=b"", timeout=None):
        """Run argv in one session and return the guest's result.

        Sessions do not cross: the id resolves to one directory and one vsock
        socket, and the guest agent execs argv directly - no shell, so nothing
        in the arguments is parsed. The channel is `socat ... fork`, so a
        long exec in one session does not block a create or another exec. An
        idle session is reloaded first; exec never sees the tiers.
        """
        if not isinstance(argv, list) or not argv or not all(isinstance(item, str) and item for item in argv):
            raise BadRequest("argv must be a non-empty list of strings")
        if cwd is not None and not isinstance(cwd, str):
            raise BadRequest("cwd must be a string")
        record = self.ensure_running(session_id)
        started = time.monotonic()
        code, out, err = vsock.exec_in_guest(
            record.vsock_path, argv, cwd=cwd, stdin=stdin,
            timeout=timeout or self.api_timeout, port=self.vsock_port,
        )
        self._trace(record.id, "exec", argv=argv, cwd=cwd, exit_code=code,
                    ms=int((time.monotonic() - started) * 1000),
                    stdout_bytes=len(out), stderr_bytes=len(err))
        return {
            "exit_code": code,
            "stdout_b64": base64.b64encode(out).decode(),
            "stderr_b64": base64.b64encode(err).decode(),
        }

    def ensure_running(self, session_id):
        """The record with a live process, reloading an idle or stopped session
        first. Callers - exec, the terminal - never see the tiers."""
        record = self.get(session_id)
        if record.state == "running":
            return record
        return self.reload(session_id)

    def idle(self, session_id, tier="memory"):
        """Put a running session down. `memory` writes a resumable snapshot of
        the session itself; `disk` keeps only the disk, which is the session.
        Idempotent, and `disk` demotes an already-idle session."""
        if tier not in ("memory", "disk"):
            raise BadRequest(f"unknown idle tier {tier!r}; expected memory or disk")
        with self._lock:
            record = self.get(session_id)
            if record.state == "running":
                pid = firecracker.pid_for_api_sock(record.api_sock) or record.pid
                self._sync(record)
                api = firecracker.Api(record.api_sock, self.api_timeout)
                firecracker.pause(api)
                if tier == "memory":
                    firecracker.create_snapshot(
                        api, record.directory / SESSION_STATE, record.directory / SESSION_MEM
                    )
                firecracker.terminate(pid)
            if tier == "disk":
                (record.directory / SESSION_STATE).unlink(missing_ok=True)
                (record.directory / SESSION_MEM).unlink(missing_ok=True)
            self._trace(session_id, "idle", tier=tier)
            LOG.info("session %s idle (%s tier)", session_id, tier)
            return self.get(session_id)

    def _sync(self, record):
        """Flush the guest's page cache to its disk before the memory goes.

        A guest write lands in the guest kernel's page cache and reaches the
        block device later. A memory snapshot keeps it either way; a cold boot
        reads the disk, so an unflushed tail would be lost. r3a's own checks hid
        this by calling `sync` after every write.
        """
        try:
            vsock.run_ok(record.vsock_path, ["/bin/sync"],
                         timeout=self.api_timeout, port=self.vsock_port)
        except vsock.VsockError as error:
            LOG.warning("session %s did not sync before idle: %s", record.id, error)

    def _boot_session(self, record):
        """Cold tier: boot the session's own disk.

        Loading the seed's memory instead resumes a kernel whose mounted
        filesystem is stale relative to a disk the session has been writing -
        the seed's cached view of `/root` hides the session's files, and
        dropping the caches surfaces an unclean ext4 journal (`Bad message`).
        A boot replays the journal and mounts the disk it is actually given.
        """
        for stale in (record.api_sock, record.vsock_path):
            stale.unlink(missing_ok=True)
        process = firecracker.spawn(
            self.firecracker, record.directory, record.api_sock, record.directory / "firecracker.log"
        )
        record.pid = process.pid
        try:
            firecracker.wait_for_api_socket(record.api_sock)
            api = firecracker.Api(record.api_sock, self.api_timeout)
            firecracker.boot(
                api, self.kernel, DISK_NAME, record.tap, record.vsock_path,
                self.guest_mac, self.guest_cid, self.vcpu_count, self.mem_mib,
            )
            vsock.wait_for_agent(record.vsock_path, self.boot_timeout, self.vsock_port)
        except BaseException:
            firecracker.terminate(record.pid)
            raise

    def reload(self, session_id):
        """Bring a session back. A memory snapshot is a restore; without one the
        session's own disk is booted, so files and identity persist and the
        processes are gone."""
        with self._lock:
            record = self.get(session_id)
            if record.state == "running":
                return record
            state = record.directory / SESSION_STATE
            mem = record.directory / SESSION_MEM
            if state.exists() and mem.exists():
                LOG.info("reloading session %s from its memory snapshot", session_id)
                self._start(record, state, mem)
            else:
                LOG.info("booting session %s from its disk", session_id)
                self._boot_session(record)
            identity = self._init_session(record)
            record.machine_id = identity["machine_id"]
            record.hostname = identity["hostname"]
            record.boot_id = identity["boot_id"]
            self._write(record)
            self._trace(record.id, "reload", from_memory=state.exists() and mem.exists(),
                        machine_id=record.machine_id, hostname=record.hostname)
            LOG.info("session %s is up, %s", session_id, record.hostname)
            return self.get(session_id)

    def destroy(self, session_id):
        with self._lock:
            record = self.get(session_id)
            LOG.info("destroying session %s", record.id)
            self._trace(record.id, "destroy")
            self._teardown(record)
            return record

    def _teardown(self, record):
        """Kill the process, drop the TAP, remove the directory. Order matters
        only in that the process has to be gone before its disk is removed."""
        pid = firecracker.pid_for_api_sock(record.api_sock) or record.pid
        firecracker.terminate(pid)
        if record.tap:
            host.delete_tap(record.tap)
        shutil.rmtree(record.directory, ignore_errors=True)
        shutil.rmtree(self.published_dir / record.id, ignore_errors=True)

    # --------------------------------------------------------------- trace
    def _trace_path(self, session_id):
        return self.traces_dir / f"{session_id}.jsonl"

    def _trace(self, session_id, event, **fields):
        """Append one event to a session's trace.

        The trace is the record of what happened, not a script: nothing replays
        it. Best effort on purpose - a trace that cannot be written must not fail
        the thing it is describing.
        """
        line = {"ts": now_iso(), "event": event}
        line.update(fields)
        try:
            self.traces_dir.mkdir(exist_ok=True)
            with open(self._trace_path(session_id), "a") as handle:
                handle.write(json.dumps(line, sort_keys=True) + "\n")
        except OSError as error:
            LOG.warning("could not trace %s %s: %s", session_id, event, error)

    def trace(self, session_id, limit=None):
        """One session's events, oldest first."""
        path = self._trace_path(session_id)
        if not path.exists():
            return []
        events = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
        return events[-limit:] if limit else events

    # ----------------------------------------------------------- published
    def publish(self, session_id, tree="/root/site"):
        """Copy a directory out of a running session and serve it.

        The session keeps running: this is the "seen" half of a session, not a
        bundle. The tree comes out over the exec channel as a gzipped tar, which
        bounds it at a few megabytes (vsock reads a line at 4 MiB) and is why a
        published site is HTML and CSS rather than the toolchain that built it.

        `filter="data"` refuses absolute paths, links out of the tree, and
        device nodes: a published tree is untrusted input even though it came
        from a session we made.
        """
        if not isinstance(tree, str) or not tree.startswith("/") or ".." in tree.split("/"):
            raise BadRequest("path must be absolute, with no .. segments")
        self.ensure_running(session_id)
        result = self.exec_command(session_id, ["tar", "-czf", "-", "-C", tree, "."])
        if result["exit_code"] != 0:
            detail = base64.b64decode(result["stderr_b64"]).decode(errors="replace").strip()
            raise BadRequest(f"nothing to publish at {tree}: {detail or 'tar failed'}")
        archive = base64.b64decode(result["stdout_b64"])
        target = self.published_dir / session_id
        staging = self.published_dir / f".{session_id}.part"
        shutil.rmtree(staging, ignore_errors=True)
        staging.mkdir(parents=True)
        with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as bundle:
            try:
                bundle.extractall(staging, filter="data")
            except TypeError:  # python < 3.12 has no extraction filter
                bundle.extractall(staging)
        shutil.rmtree(target, ignore_errors=True)
        staging.rename(target)
        files = [path for path in target.rglob("*") if path.is_file()]
        published = {
            "id": session_id,
            "path": tree,
            "files": len(files),
            "bytes": sum(path.stat().st_size for path in files),
            "url": f"/s/{session_id}/",
        }
        self._trace(session_id, "publish", **published)
        return published

    def published_site(self, session_id):
        """The published tree on disk, or None if nothing was published."""
        root = self.published_dir / session_id
        return root if root.is_dir() else None

    # ------------------------------------------------------------- exports
    def exports(self):
        """Every bundle in the volume, newest first."""
        if not self.exports_dir.exists():
            return []
        manifests = []
        for entry in sorted(self.exports_dir.iterdir()):
            if (entry / "manifest.json").exists():
                manifests.append(read_json(entry / "manifest.json"))
        return sorted(manifests, key=lambda item: item.get("exported", ""), reverse=True)

    def seed_fingerprint(self):
        """The seed a session forked from, for a bundle's record: a restore onto
        a different seed is a different machine underneath the same files."""
        record = self.seed_status()["record"] or {}
        return {key: record.get(key) for key in CHEAP_FIELDS + ("template_sha256",)}

    def export(self, session_id):
        """Write a session out as a bundle: its artifacts and its trace.

        The session is stopped first and left stopped - a disk a live guest is
        writing must not be mounted underneath it, and a session that had to
        stop to be exported should not quietly restart. `reload` brings it back.
        """
        with self._lock:
            record = self.get(session_id)
            if record.state == "running":
                record = self.idle(session_id, "disk")
            disk = record.directory / DISK_NAME
            if not disk.exists():
                raise Busy(f"session {session_id} has no disk to export")

            target = self.exports_dir / session_id
            staging = self.exports_dir / f".{session_id}.part"
            shutil.rmtree(staging, ignore_errors=True)
            staging.mkdir(parents=True)
            try:
                artifacts = staging / "artifacts.tar.gz"
                with host.mounted(disk) as tree:
                    host.run(["tar", "-czf", str(artifacts), "-C", str(tree), *ARTIFACT_PATHS])
                listed = host.run(["tar", "-tzf", str(artifacts)]).stdout
                trace_path = self._trace_path(session_id)
                trace_text = trace_path.read_text() if trace_path.exists() else ""
                (staging / "trace.jsonl").write_text(trace_text)
                manifest = {
                    "schema": 1,
                    "id": session_id,
                    "exported": now_iso(),
                    "session": {
                        "id": record.id,
                        "created": record.created,
                        "machine_id": record.machine_id,
                        "hostname": record.hostname,
                    },
                    "artifacts": {
                        "path": "artifacts.tar.gz",
                        "bytes": artifacts.stat().st_size,
                        "sha256": sha256_file(artifacts),
                        "entries": len(listed.splitlines()),
                        "paths": list(ARTIFACT_PATHS),
                    },
                    "trace": {
                        "path": "trace.jsonl",
                        "events": len([line for line in trace_text.splitlines() if line.strip()]),
                        "bytes": len(trace_text),
                    },
                    "seed": self.seed_fingerprint(),
                }
                write_json(staging / "manifest.json", manifest)
                shutil.rmtree(target, ignore_errors=True)
                staging.rename(target)
            except BaseException:
                shutil.rmtree(staging, ignore_errors=True)
                raise
            self._trace(session_id, "export", export=str(target),
                        artifacts_sha256=manifest["artifacts"]["sha256"],
                        bytes=manifest["artifacts"]["bytes"])
            LOG.info("session %s exported to %s (%s bytes)",
                     session_id, target, manifest["artifacts"]["bytes"])
            return manifest

    def restore(self, export_id, start=True):
        """Land a bundle on a fresh disk.

        A fresh session from the seed, stopped, the artifacts untarred into it,
        then started: the files are the export's, the identity is the new
        session's. The bundle's trace is carried over, so the record of how the
        files got here survives the session they came from.
        """
        with self._lock:
            export_dir = self.exports_dir / export_id
            if not (export_dir / "manifest.json").exists():
                raise NotFound(f"export {export_id}")
            manifest = read_json(export_dir / "manifest.json")
            artifacts = export_dir / manifest["artifacts"]["path"]
            digest = sha256_file(artifacts)
            if digest != manifest["artifacts"]["sha256"]:
                raise BadRequest(
                    f"export {export_id} is corrupt: {digest[:12]} != "
                    f"{manifest['artifacts']['sha256'][:12]}"
                )

            record = self.create()
            try:
                self.idle(record.id, "disk")
                with host.mounted(record.directory / DISK_NAME) as tree:
                    host.run(["tar", "-xzf", str(artifacts), "-C", str(tree), "--no-same-owner"])
                previous = (export_dir / "trace.jsonl").read_text()
                trace_path = self._trace_path(record.id)
                current = trace_path.read_text() if trace_path.exists() else ""
                trace_path.write_text(previous + current)
                self._trace(record.id, "restore", source=export_id, artifacts_sha256=digest,
                            seed=self.seed_fingerprint(), seed_of_export=manifest.get("seed"),
                            seed_matches=self.seed_fingerprint() == manifest.get("seed"))
                if start:
                    record = self.reload(record.id)
            except BaseException:
                LOG.warning("restore of %s failed, rolling back", export_id)
                self._teardown(record)
                raise
            LOG.info("session %s restored from %s", record.id, export_id)
            return record

    # ------------------------------------------------------------- records
    def _record_path(self, directory):
        return directory / "session.json"

    def _write(self, record):
        write_json(self._record_path(record.directory), {
            "id": record.id,
            "created": record.created,
            "tap": record.tap,
            "pid": record.pid,
            "machine_id": record.machine_id,
            "hostname": record.hostname,
            "boot_id": record.boot_id,
        })

    def _read(self, directory):
        stored = read_json(self._record_path(directory))
        record = Session(
            id=stored["id"],
            created=stored.get("created", ""),
            tap=stored.get("tap", ""),
            pid=stored.get("pid", 0),
            directory=directory,
            api_sock=directory / "api.sock",
            vsock_path=directory / "vsock.sock",
            machine_id=stored.get("machine_id", ""),
            hostname=stored.get("hostname", ""),
            boot_id=stored.get("boot_id", ""),
        )
        # State comes from what is on disk, not the record: after a host reboot
        # a recorded pid would be a stranger, and a session with no process is
        # either idle (a memory snapshot to resume) or stopped (disk only).
        if firecracker.pid_for_api_sock(record.api_sock):
            record.state = "running"
        elif (directory / SESSION_STATE).exists() and (directory / SESSION_MEM).exists():
            record.state = "idle"
        else:
            record.state = "stopped"
        return record

    def get(self, session_id):
        directory = self.volume / session_id
        if not self._record_path(directory).exists():
            raise NotFound(session_id)
        return self._read(directory)

    def list(self):
        records = []
        for entry in sorted(self.volume.iterdir()):
            if not entry.is_dir() or entry.name in NON_SESSION_DIRS:
                continue
            if self._record_path(entry).exists():
                records.append(self._read(entry))
            else:
                # A directory with no record is a create that died mid-flight.
                # Reported rather than skipped: a leak nobody can see is worse.
                LOG.warning("incomplete session directory: %s", entry)
                records.append(Session(
                    id=entry.name, created="", tap="", pid=0, directory=entry,
                    api_sock=entry / "api.sock", vsock_path=entry / "vsock.sock",
                    state="incomplete",
                ))
        return records

    def live_sessions(self):
        return [record for record in self.list() if record.state == "running"]


def write_json(path, payload):
    Path(path).write_text(json.dumps(payload, indent=2) + "\n")


def read_json(path):
    return json.loads(Path(path).read_text())
