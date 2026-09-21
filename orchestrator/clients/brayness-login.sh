#!/usr/bin/env bash
# Host-side login: one SSH login -> one brayness session.
#
#   ssh -t brayness-1 ~/brayness/orchestrator/clients/brayness-login.sh
#
# Creates a session over the API, starts COMMAND in it (brayness by default), and
# attaches this terminal to that session's pty. When it exits, the session is
# destroyed, so a dropped login leaves nothing behind. KEEP=1 idles the session
# to memory instead and prints its id.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API="${API:-http://127.0.0.1:8080}"
PTY_PORT="${PTY_PORT:-8081}"
COMMAND="${COMMAND:-brayness}"

[ -t 0 ] || { echo "brayness-login needs a terminal: ssh -t" >&2; exit 1; }

if ! curl -sS --max-time 5 -o /dev/null "$API/v1/health"; then
  echo "no orchestrator answering on $API" >&2
  exit 1
fi

if ! session="$(curl -sS -X POST "$API/v1/sessions" \
    | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')"; then
  echo "could not create a session" >&2
  exit 1
fi

cleanup() {
  if [ "${KEEP:-0}" = 1 ]; then
    curl -sS -X POST -H 'Content-Type: application/json' \
      --data '{"tier": "memory"}' "$API/v1/sessions/$session/idle" > /dev/null 2>&1 || true
    printf '\nsession %s left idle (KEEP=1)\n' "$session" >&2
  else
    curl -sS -X DELETE "$API/v1/sessions/$session" -o /dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

printf 'brayness session %s\n' "$session" >&2
python3 "$HERE/pty-attach.py" --session "$session" --port "$PTY_PORT" --send "exec $COMMAND"
