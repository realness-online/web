"""The guest control channel, from the host side.

Firecracker maps guest AF_VSOCK ports 1:1 onto host unix sockets. The host
connects to `uds_path`, writes "CONNECT <port>\\n", and reads "OK <host_port>\\n"
before the channel is a plain byte stream (Firecracker docs/vsock.md,
Host-Initiated Connections). On the other end is `brayness-agent`, one JSON
request per line and one response per line.

This is the same protocol as scripts/vsock-exec.py. That script stays as it is:
it is the evidence runner for f2-f6, and those checks have to keep working
regardless of what r3 does. The cost is one duplicated connect-and-frame
routine, which is cheaper than an evidence script that breaks when the
orchestrator is refactored.

Needs root: Firecracker creates the socket as root.
"""
from __future__ import annotations

import base64
import json
import socket
import time

VSOCK_PORT = 52
HANDSHAKE_TIMEOUT = 10.0


class VsockError(RuntimeError):
    """The channel is unreachable, or the agent closed it."""


def read_line(sock, limit=1 << 22):
    """One newline-terminated line, read raw.

    Not `makefile().readline()`: a buffered reader hides read-ahead from
    `select`, and the pty relay selects on the same socket it handshakes on. A
    line larger than `limit` is truncated rather than a memory risk.
    """
    buf = b""
    while b"\n" not in buf:
        chunk = sock.recv(65536)
        if not chunk:
            break
        buf += chunk
        if len(buf) > limit:
            break
    return buf.partition(b"\n")[0]


def connect(uds_path, port=VSOCK_PORT):
    """Return a socket wired to the guest's `port`, handshake complete."""
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        sock.connect(str(uds_path))
    except OSError as error:
        # Normal while a VM is booting: uds_path does not exist yet.
        raise VsockError(f"cannot reach {uds_path} ({error.strerror})") from error
    sock.settimeout(HANDSHAKE_TIMEOUT)
    sock.sendall(f"CONNECT {port}\n".encode())
    ack = read_line(sock).decode(errors="replace").strip()
    if not ack.startswith("OK "):
        # Firecracker closes the connection outright when nothing in the guest
        # is listening, so anything but "OK" means the agent is not up.
        sock.close()
        raise VsockError(f"no agent on port {port} (firecracker said {ack!r})")
    sock.settimeout(None)
    return sock


def exec_in_guest(uds_path, argv, cwd=None, stdin=b"", timeout=90.0, port=VSOCK_PORT):
    """Run argv in the guest. Returns (exit_code, stdout, stderr) as bytes."""
    sock = connect(uds_path, port)
    with sock:
        sock.settimeout(timeout)
        request = {
            "argv": list(argv),
            "cwd": cwd,
            "stdin_b64": base64.b64encode(stdin).decode(),
        }
        sock.sendall((json.dumps(request) + "\n").encode())
        line = read_line(sock)
    if not line:
        raise VsockError(f"agent closed the channel (argv={list(argv)!r})")
    response = json.loads(line)
    return (
        response["exit_code"],
        base64.b64decode(response["stdout_b64"]),
        base64.b64decode(response["stderr_b64"]),
    )


def run_ok(uds_path, argv, timeout=90.0, port=VSOCK_PORT):
    """Run argv and return stdout as text, raising if it failed."""
    code, out, err = exec_in_guest(uds_path, argv, timeout=timeout, port=port)
    if code != 0:
        raise VsockError(f"{list(argv)} exited {code}: {err.decode(errors='replace').strip()}")
    return out.decode(errors="replace")


def wait_for_agent(uds_path, timeout=60.0, port=VSOCK_PORT):
    """Wait until /bin/true answers in the guest.

    The agent answering is the readiness signal for both a boot and a
    snapshot/load: it means the guest is up, the vsock device works, and
    brayness-vsock.service started.
    """
    deadline = time.monotonic() + timeout
    last = None
    while time.monotonic() < deadline:
        try:
            exec_in_guest(uds_path, ["/bin/true"], timeout=10.0, port=port)
            return True
        except (VsockError, OSError) as error:
            last = error
        time.sleep(0.5)
    raise VsockError(f"no agent on {uds_path} after {timeout}s ({last})")