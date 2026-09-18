"""One Firecracker process: its unix-socket REST API, and its life.

The node scripts drive this with `curl --unix-socket`; the orchestrator needs
the same calls with a return value, so it speaks the API directly.

Two call sequences matter. Building the seed boots a fresh VM over the API,
pauses it, and writes `snapshot/create`. Starting a session is the reverse:
`snapshot/load` with `network_overrides` and `vsock_override`, which is how one
snapshot becomes many VMs with their own TAP and their own control channel
(f5c). A session's disk is not in the request at all - the snapshot records the
drive path relative to Firecracker's cwd (f5a), so the process's cwd is what
decides which disk it opens.
"""
from __future__ import annotations

import http.client
import json
import os
import signal
import socket
import subprocess
import time
from pathlib import Path

DEFAULT_BOOT_ARGS = "keep_bootcon console=ttyS0 reboot=k panic=1"


class FirecrackerError(RuntimeError):
    """Firecracker refused a call, or is not reachable."""


class _UnixConnection(http.client.HTTPConnection):
    """HTTP over an AF_UNIX socket - the only transport Firecracker speaks."""

    def __init__(self, sock_path, timeout):
        super().__init__("localhost", timeout=timeout)
        self.sock_path = str(sock_path)

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(self.sock_path)


class Api:
    """Firecracker's REST API on one process."""

    def __init__(self, sock_path, timeout=30.0):
        self.sock_path = Path(sock_path)
        self.timeout = timeout

    def call(self, method, path, body=None):
        payload = None if body is None else json.dumps(body).encode()
        connection = _UnixConnection(self.sock_path, self.timeout)
        try:
            connection.request(
                method,
                path,
                body=payload,
                headers={"Content-Type": "application/json"} if payload else {},
            )
            response = connection.getresponse()
            raw = response.read()
            status = response.status
        except (ConnectionError, OSError) as error:
            raise FirecrackerError(f"{method} {path}: {error}") from error
        finally:
            connection.close()
        if status >= 400:
            detail = raw.decode(errors="replace").strip()
            raise FirecrackerError(f"{method} {path}: {status} {detail}")
        return json.loads(raw) if raw else {}

    def put(self, path, body):
        return self.call("PUT", path, body)

    def patch(self, path, body):
        return self.call("PATCH", path, body)


def version(binary):
    """The first line of `--version`. Firecracker follows it with a timestamped
    exit banner on stderr, which would otherwise land in the seed fingerprint
    and make every start look like a mismatch."""
    result = subprocess.run(
        [str(binary), "--version"], check=False, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    return result.stdout.strip().splitlines()[0].strip() if result.stdout.strip() else "unknown"


def spawn(binary, cwd, api_sock, log_path):
    """Start Firecracker with `cwd` as its working directory.

    The cwd is load-bearing: a relative `path_on_host` in a snapshot resolves
    against it (f5a), and that is what gives each session its own disk.
    """
    log = open(log_path, "ab", buffering=0)
    return subprocess.Popen(
        [str(binary), "--api-sock", str(api_sock)],
        cwd=str(cwd),
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=subprocess.STDOUT,
    )


def wait_for_api_socket(sock_path, timeout=10.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if Path(sock_path).exists():
            return True
        time.sleep(0.05)
    raise FirecrackerError(f"no api socket at {sock_path} after {timeout}s")


def pid_for_api_sock(api_sock):
    """The Firecracker process that owns `api_sock`, or None.

    The process's own command line is the identity, not the pid we recorded:
    after a host reboot a reused pid would point at something unrelated.
    """
    want = str(Path(api_sock).resolve())
    for entry in Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        try:
            argv = (entry / "cmdline").read_bytes().split(b"\0")
        except OSError:
            continue
        # The flag is `--api-sock`; matching a bare `api-sock` never fired and a
        # live session read as stopped, which made r4's reload double-attach a
        # TAP that was already open.
        args = [arg.decode(errors="replace") for arg in argv if arg]
        if "--api-sock" not in args:
            continue
        recorded = args[args.index("--api-sock") + 1]
        if str(Path(recorded).resolve()) == want:
            return int(entry.name)
    return None


def alive(pid):
    """Whether this pid is a running process. A zombie is not: it holds no
    disk, no TAP and no memory, and it is still named firecracker."""
    if not pid:
        return False
    try:
        # Field 3 of /proc/<pid>/stat. Split on the last ')' because the comm
        # field is parenthesised and may itself contain spaces or brackets.
        state = Path(f"/proc/{pid}/stat").read_text().rsplit(") ", 1)[1].split()[0]
    except (OSError, IndexError):
        return False
    if state == "Z":
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def reap(pid, timeout=5.0):
    """Collect a child this process started.

    Polling rather than one WNOHANG: a SIGKILLed Firecracker takes a moment to
    actually die, so a wait that arrives too early returns 0 and leaves a zombie
    nobody ever collects. A pid that is not our child (one picked up after a
    host reboot) belongs to init, and waitpid says ChildProcessError.
    """
    if not pid:
        return
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            reaped, _ = os.waitpid(pid, os.WNOHANG)
        except (ChildProcessError, OSError):
            return
        if reaped == pid:
            return
        time.sleep(0.05)


def terminate(pid, timeout=10.0):
    """SIGTERM, then SIGKILL, then reap.

    Reaping is not bookkeeping. An unreaped Firecracker is a zombie, a zombie is
    still a process named firecracker, and that name is what the idle guard
    looks for - one would hold a host awake forever, and `pgrep -x firecracker`
    would keep reporting a session that is gone.
    """
    if alive(pid):
        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            pass
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline and alive(pid):
            time.sleep(0.05)
        if alive(pid):
            try:
                os.kill(pid, signal.SIGKILL)
            except OSError:
                pass
            time.sleep(0.1)
    reap(pid)


def boot(api, kernel, disk, tap, uds_path, guest_mac, guest_cid, vcpu_count, mem_mib,
         boot_args=DEFAULT_BOOT_ARGS):
    """Configure and start a fresh VM from the template disk.

    The seed is the only VM that boots this way; sessions load a snapshot
    instead. It carries the TAP and the vsock device because the snapshot has to
    contain the devices a session will be given overrides for.
    """
    api.put("/boot-source", {"kernel_image_path": str(kernel), "boot_args": boot_args})
    api.put("/drives/rootfs", {
        "drive_id": "rootfs",
        "path_on_host": str(disk),
        "is_root_device": True,
        "is_read_only": False,
    })
    api.put("/machine-config", {"vcpu_count": vcpu_count, "mem_size_mib": mem_mib})
    api.put("/network-interfaces/eth0", {
        "iface_id": "eth0",
        "host_dev_name": tap,
        "guest_mac": guest_mac,
    })
    api.put("/vsock", {"guest_cid": guest_cid, "uds_path": str(uds_path)})
    api.put("/actions", {"action_type": "InstanceStart"})


def pause(api):
    api.patch("/vm", {"state": "Paused"})


def create_snapshot(api, state_path, mem_path):
    api.put("/snapshot/create", {
        "snapshot_type": "Full",
        "snapshot_path": str(state_path),
        "mem_file_path": str(mem_path),
    })


def load_snapshot(api, state_path, mem_path, tap, uds_path):
    """Resume a snapshot as a session: its own TAP, its own channel.

    `resume_vm` starts execution in the same call, so a loaded session is
    running the moment this returns - at snapshot time, with the seed's identity
    until `brayness-session-init` sets the clock and mints a new one (f6).
    """
    api.put("/snapshot/load", {
        "snapshot_path": str(state_path),
        "mem_backend": {"backend_path": str(mem_path), "backend_type": "File"},
        "network_overrides": [{"iface_id": "eth0", "host_dev_name": tap}],
        "vsock_override": {"uds_path": str(uds_path)},
        "resume_vm": True,
    })