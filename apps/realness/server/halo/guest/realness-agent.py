#!/usr/bin/env python3
"""Realness actor agent - the guest end of the vsock control channel.

One JSON object per line in, one per line out, over stdio. socat owns the vsock
listener and hands each connection to one copy of this process (see
realness-vsock.service).

  request   {"argv": ["curl","-sS","https://example.com"], "cwd": "/realness",
             "stdin_b64": ""}
  response  {"exit_code": 0, "stdout_b64": "...", "stderr_b64": "..."}

With "stream": true the response is one JSON object per line as output arrives,
then the exit:

  {"type": "stdout", "data_b64": "..."}
  {"type": "stderr", "data_b64": "..."}
  {"type": "exit", "exit_code": 0}

"timeout" seconds stops a streaming command and reports 124. Closing the
channel, which is how the halo cancels, kills it too.

Payloads are base64 so binary output and raw newlines survive a line-oriented
channel. There is no shell: argv is exec'd directly, by design. An actor that
wants a shell asks for one (["/bin/bash","-c",...]).

This is a stub. It runs everything as root with no authentication, which is
acceptable only because the channel is a halo-local unix socket.
Identity and egress constraints are in vault/Projects/realness.md.
"""
import base64
import json
import os
import signal
import subprocess
import sys
import threading

TIMEOUT_EXIT = 124
CHUNK = 65536


def env():
    return {**os.environ, "HOME": "/realness"}


def run(request):
    proc = subprocess.run(
        request["argv"],
        cwd=request.get("cwd") or "/realness",
        env=env(),
        input=base64.b64decode(request.get("stdin_b64") or ""),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return {
        "exit_code": proc.returncode,
        "stdout_b64": base64.b64encode(proc.stdout).decode(),
        "stderr_b64": base64.b64encode(proc.stderr).decode(),
    }


def stream(request):
    write_lock = threading.Lock()

    def emit(event):
        with write_lock:
            sys.stdout.write(json.dumps(event) + "\n")
            sys.stdout.flush()

    proc = subprocess.Popen(
        request["argv"],
        cwd=request.get("cwd") or "/realness",
        env=env(),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
    )
    timed_out = threading.Event()

    def kill():
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass

    def feed():
        try:
            proc.stdin.write(base64.b64decode(request.get("stdin_b64") or ""))
            proc.stdin.close()
        except (BrokenPipeError, ValueError):
            pass

    def pump(source, kind):
        try:
            while True:
                chunk = source.read1(CHUNK)
                if not chunk:
                    break
                emit({"type": kind, "data_b64": base64.b64encode(chunk).decode()})
        except (ValueError, OSError):
            pass

    def cancel():
        try:
            while sys.stdin.buffer.read(CHUNK):
                pass
        except (ValueError, OSError):
            pass
        kill()

    def expire():
        timed_out.set()
        kill()

    timer = None
    seconds = request.get("timeout")
    if isinstance(seconds, (int, float)) and seconds > 0:
        timer = threading.Timer(seconds, expire)
        timer.daemon = True
        timer.start()

    threads = [
        threading.Thread(target=feed, daemon=True),
        threading.Thread(target=pump, args=(proc.stdout, "stdout"), daemon=True),
        threading.Thread(target=pump, args=(proc.stderr, "stderr"), daemon=True),
        threading.Thread(target=cancel, daemon=True),
    ]
    for thread in threads:
        thread.start()
    code = proc.wait()
    for thread in threads[1:3]:
        thread.join()
    if timer:
        timer.cancel()
    emit({"type": "exit", "exit_code": TIMEOUT_EXIT if timed_out.is_set() else code})


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
            if request.get("stream") is True:
                stream(request)
                return
            response = run(request)
        except Exception as error:
            if isinstance(locals().get("request"), dict) and request.get("stream") is True:
                sys.stdout.write(
                    json.dumps(
                        {
                            "type": "stderr",
                            "data_b64": base64.b64encode(
                                str(error).encode()
                            ).decode(),
                        }
                    )
                    + "\n"
                )
                sys.stdout.write(json.dumps({"type": "exit", "exit_code": 127}) + "\n")
                sys.stdout.flush()
                return
            response = {
                "exit_code": 127,
                "stdout_b64": "",
                "stderr_b64": base64.b64encode(str(error).encode()).decode(),
            }
        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()


main()