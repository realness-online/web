#!/usr/bin/env python3
"""Realness actor agent - the guest end of the vsock control channel.

One JSON object per line in, one per line out, over stdio. socat owns the vsock
listener and hands each connection to one copy of this process (see
realness-vsock.service).

  request   {"argv": ["curl","-sS","https://example.com"], "cwd": "/realness",
             "stdin_b64": ""}
  response  {"exit_code": 0, "stdout_b64": "...", "stderr_b64": "..."}

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
import subprocess
import sys


def run(request):
    proc = subprocess.run(
        request["argv"],
        cwd=request.get("cwd") or "/realness",
        env={**os.environ, "HOME": "/realness"},
        input=base64.b64decode(request.get("stdin_b64") or ""),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return {
        "exit_code": proc.returncode,
        "stdout_b64": base64.b64encode(proc.stdout).decode(),
        "stderr_b64": base64.b64encode(proc.stderr).decode(),
    }


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            response = run(json.loads(line))
        except Exception as error:
            response = {
                "exit_code": 127,
                "stdout_b64": "",
                "stderr_b64": base64.b64encode(str(error).encode()).decode(),
            }
        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()


main()