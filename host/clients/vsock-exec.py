#!/usr/bin/env python3
"""Run a command inside a microVM over Firecracker's vsock control channel.

  sudo python3 vsock-exec.py --uds /tmp/f2-v.sock -- curl -sS https://example.com

Firecracker maps guest AF_VSOCK ports 1:1 onto host unix sockets. The host
connects to uds_path, writes "CONNECT <port>\n", and reads "OK <host_port>\n"
before the channel is a plain byte stream (docs/vsock.md, "Host-Initiated
Connections"). On the other end is brayness-agent, which speaks one JSON line
in, one JSON line out.

Prints the command's stdout, relays its stderr to stderr, and exits with the
command's own exit code, so ordinary shell composition works:

  if sudo python3 vsock-exec.py --uds "$V" -- test -e /dev/vsock; then ...

Needs root because Firecracker creates the unix socket as root and the socket
mode does not allow other users to connect.
"""
import argparse
import base64
import json
import socket
import sys

CHUNK = 65536


def connect(uds, port):
    """Return a socket wired to guest `port`."""
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        sock.connect(uds)
    except OSError as error:
        # Normal while a VM is booting: the uds_path does not exist yet.
        raise SystemExit(f"vsock: cannot reach {uds} ({error.strerror})")
    sock.sendall(f"CONNECT {port}\n".encode())

    reader = sock.makefile("rb")
    ack = reader.readline().decode(errors="replace").strip()
    if not ack.startswith("OK "):
        # Firecracker closes the connection outright when nothing is listening
        # in the guest, so anything that is not "OK" means the agent is down.
        raise SystemExit(f"vsock: no agent on port {port} (firecracker said {ack!r})")
    return sock, reader


def exec_in_guest(uds, port, argv, cwd=None, stdin=b"", timeout=None):
    sock, reader = connect(uds, port)
    with sock:
        if timeout is not None:
            sock.settimeout(timeout)
        request = {
            "argv": argv,
            "cwd": cwd,
            "stdin_b64": base64.b64encode(stdin).decode(),
        }
        sock.sendall((json.dumps(request) + "\n").encode())
        line = reader.readline()
    if not line:
        raise SystemExit(f"vsock: agent closed the channel (argv={argv!r})")
    response = json.loads(line)
    return (
        response["exit_code"],
        base64.b64decode(response["stdout_b64"]),
        base64.b64decode(response["stderr_b64"]),
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--uds", required=True, help="the VM's vsock uds_path")
    parser.add_argument("--port", type=int, default=52, help="guest vsock port")
    parser.add_argument("--cwd", default=None, help="directory to run in")
    parser.add_argument("--timeout", type=float, default=90.0, help="seconds")
    parser.add_argument("argv", nargs=argparse.REMAINDER)
    args = parser.parse_args()

    argv = args.argv[1:] if args.argv[:1] == ["--"] else args.argv
    if not argv:
        parser.error("nothing to run")

    code, out, err = exec_in_guest(
        args.uds, args.port, argv, cwd=args.cwd, timeout=args.timeout
    )
    if out:
        sys.stdout.buffer.write(out)
        sys.stdout.buffer.flush()
    if err:
        sys.stderr.buffer.write(err)
        sys.stderr.buffer.flush()
    return code


if __name__ == "__main__":
    sys.exit(main())