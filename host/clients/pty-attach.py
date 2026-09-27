#!/usr/bin/env python3
"""Interactive terminal for an actor, from a real terminal.

The browser page is fine for a shell; a full-screen agent TUI wants a real
terminal emulator. This connects to the host's framed PTY stream and
pipes the local tty through it, so the actor's pty sees your terminal and your
terminal renders what the actor draws.

    pty-attach.py --actor a-abc
    pty-attach.py --actor a-abc --send 'exec brayness'

`--send` types a line into the actor once attached - how the login wrapper
starts the agent instead of a shell.

Needs a tty on stdin, so run it under `ssh -t` or a terminal, not a pipe.
"""
import argparse
import base64
import json
import os
import select
import signal
import socket
import sys
import termios
import tty

DEFAULT_TIMEOUT = 30.0


class Refused(Exception):
    """The stream answered the hello with an error."""


def read_line(sock, buf=b""):
    while b"\n" not in buf:
        chunk = sock.recv(65536)
        if not chunk:
            return None, buf
        buf += chunk
    line, _, rest = buf.partition(b"\n")
    return line, rest


def send_frame(sock, payload):
    sock.sendall(json.dumps(payload).encode() + b"\n")


def terminal_size(fd):
    size = os.get_terminal_size(fd)
    return size.columns, size.lines


def attach(actor, host, port, send):
    fd = sys.stdin.fileno()
    cols, rows = terminal_size(fd)
    sock = socket.create_connection((host, port), timeout=DEFAULT_TIMEOUT)
    sock.settimeout(DEFAULT_TIMEOUT)
    send_frame(sock, {"actor": actor, "cols": cols, "rows": rows})
    line, buffered = read_line(sock)
    if line is None:
        raise Refused("stream closed before answering the hello")
    reply = json.loads(line)
    if "error" in reply:
        raise Refused(reply["error"])
    sock.settimeout(None)

    resized = {"flag": False}

    def on_winch(_signum, _frame):
        resized["flag"] = True

    old = termios.tcgetattr(fd)
    previous_winch = signal.signal(signal.SIGWINCH, on_winch)
    stdout = sys.stdout.buffer
    try:
        tty.setraw(fd)
        if send:
            send_frame(sock, {"op": "data", "data_b64": base64.b64encode((send + "\n").encode()).decode()})
        while True:
            readable, _, _ = select.select([fd, sock], [], [])
            if resized["flag"]:
                resized["flag"] = False
                cols, rows = terminal_size(fd)
                send_frame(sock, {"op": "resize", "cols": cols, "rows": rows})
            if fd in readable:
                data = os.read(fd, 65536)
                if not data:
                    break
                send_frame(sock, {"op": "data", "data_b64": base64.b64encode(data).decode()})
            if sock in readable:
                chunk = sock.recv(65536)
                if not chunk:
                    break
                buffered += chunk
                while b"\n" in buffered:
                    frame, _, buffered = buffered.partition(b"\n")
                    if not frame.strip():
                        continue
                    message = json.loads(frame)
                    if message.get("op") == "data":
                        stdout.write(base64.b64decode(message["data_b64"]))
                        stdout.flush()
                    elif message.get("op") == "exit":
                        return
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)
        signal.signal(signal.SIGWINCH, previous_winch)
        sock.close()


def parse_args(argv):
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--actor", required=True)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8081)
    parser.add_argument("--send", default="", help="a line to type once attached")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(sys.argv[1:] if argv is None else argv)
    if not sys.stdin.isatty():
        print("pty-attach needs a terminal (ssh -t)", file=sys.stderr)
        return 2
    try:
        attach(args.actor, args.host, args.port, args.send)
    except Refused as error:
        print(f"refused: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
