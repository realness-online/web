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
import select
import signal
import subprocess
import sys
import tempfile
import threading

TIMEOUT_EXIT = 124
CHUNK = 65536


def env(request):
    inherited = {**os.environ, "HOME": "/realness"}
    return {
        **(inherited if request.get("inherit_env", True) else {}),
        **request.get("env", {}),
    }


def run(request):
    proc = subprocess.run(
        request["argv"],
        cwd=request.get("cwd") or "/realness",
        env=env(request),
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
    spill = request.get("spill")
    prefix = bytearray()
    output_bytes = 0
    output_lines = 0
    spill_file = None
    spill_path = None
    output_errors = []

    def emit(event, chunk=None):
        nonlocal output_bytes, output_lines, spill_file, spill_path
        with write_lock:
            if spill and chunk:
                output_bytes += len(chunk)
                output_lines += chunk.count(b"\n")
                if spill_file is None:
                    prefix.extend(chunk)
                    lines = output_lines + (0 if chunk.endswith(b"\n") else 1)
                    if (output_bytes > spill["afterBytes"] or
                            lines > spill["afterLines"]):
                        directory = os.path.join(
                            os.environ.get("REALNESS_ROOT", "/realness"),
                            "artifacts", "realness"
                        )
                        os.makedirs(directory, exist_ok=True)
                        fd, spill_path = tempfile.mkstemp(
                            prefix="exec-", suffix=".log", dir=directory
                        )
                        spill_file = os.fdopen(fd, "wb")
                        spill_file.write(prefix)
                        prefix.clear()
                else:
                    spill_file.write(chunk)
            sys.stdout.write(json.dumps(event) + "\n")
            sys.stdout.flush()

    proc = subprocess.Popen(
        request["argv"],
        cwd=request.get("cwd") or "/realness",
        env=env(request),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
    )
    timed_out = threading.Event()
    finished = threading.Event()

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
                emit({"type": kind, "data_b64": base64.b64encode(chunk).decode()}, chunk)
        except (ValueError, OSError) as error:
            output_errors.append(str(error))
            kill()

    def cancel():
        while not finished.is_set():
            try:
                ready, _, _ = select.select([sys.stdin], [], [], 0.2)
                if ready and not sys.stdin.buffer.read(CHUNK):
                    kill()
                    return
            except (ValueError, OSError):
                return

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
    finished.set()
    threads[3].join(1)
    if timer:
        timer.cancel()
    if spill_file:
        try:
            spill_file.close()
        except OSError as error:
            output_errors.append(str(error))
    result = {"type": "exit", "exit_code": TIMEOUT_EXIT if timed_out.is_set() else code}
    if timed_out.is_set():
        result["error"] = "timeout"
    elif output_errors:
        result["error"] = "unknown"
    if spill_path:
        result["spill_path"] = spill_path
    emit(result)


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
                sys.stdout.write(json.dumps({"type": "exit", "exit_code": 127, "error": "spawn_error"}) + "\n")
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