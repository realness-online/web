#!/usr/bin/env bash
# Host-side login: one SSH login -> one brayness actor.
#
#   ssh -t brayness-1 ~/brayness/host/clients/brayness-login.sh
#
# Creates an actor over the API, starts COMMAND in it (brayness by default), and
# attaches this terminal to that actor's pty. When it exits, the actor is
# destroyed, so a dropped login leaves nothing behind. KEEP=1 idles the actor
# to memory instead and prints its id.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API="${API:-http://127.0.0.1:8080}"
PTY_PORT="${PTY_PORT:-8081}"
COMMAND="${COMMAND:-brayness}"

[ -t 0 ] || { echo "brayness-login needs a terminal: ssh -t" >&2; exit 1; }

if ! curl -sS --max-time 5 -o /dev/null "$API/v1/health"; then
  echo "no host answering on $API" >&2
  exit 1
fi

if ! actor="$(curl -sS -X POST "$API/v1/actors" \
    | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')"; then
  echo "could not create an actor" >&2
  exit 1
fi

cleanup() {
  if [ "${KEEP:-0}" = 1 ]; then
    curl -sS -X POST -H 'Content-Type: application/json' \
      --data '{"tier": "memory"}' "$API/v1/actors/$actor/idle" > /dev/null 2>&1 || true
    printf '\nactor %s left idle (KEEP=1)\n' "$actor" >&2
  else
    curl -sS -X DELETE "$API/v1/actors/$actor" -o /dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

printf 'brayness actor %s\n' "$actor" >&2
python3 "$HERE/pty-attach.py" --actor "$actor" --port "$PTY_PORT" --send "exec $COMMAND"
