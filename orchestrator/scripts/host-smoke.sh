#!/usr/bin/env bash
# host-smoke - prove a host serves a session, over its own API.
#
#   bash ~/brayness/orchestrator/scripts/host-smoke.sh
#
# Builds the seed from the template, serves on loopback, creates a session, runs
# a command in it, destroys it, and checks nothing was left behind. The point of
# the machine-id check is that a session is a restore of the seed, not the seed:
# two sessions must never share one.
set -uo pipefail

cd "$HOME/brayness/src"
PASS=0
FAIL=0
pass() { printf 'PASS  %s\n' "$1"; PASS=$((PASS + 1)); }
fail() { printf 'FAIL  %s\n' "$1"; FAIL=$((FAIL + 1)); }

sudo pkill -f "[p]ython3 -m orchestrator" 2> /dev/null || true
sudo pkill -x firecracker 2> /dev/null || true
sleep 1

echo "==> seed"
sudo timeout 300 python3 -m orchestrator seed --volume /opt/fc/sessions/mnt --rebuild 2>&1 | tail -2

echo "==> serve"
sudo nohup python3 -m orchestrator serve --volume /opt/fc/sessions/mnt --listen 127.0.0.1 --port 8080 > /tmp/orch.log 2>&1 &
for _ in $(seq 1 20); do
  sleep 2
  curl -sf --max-time 3 http://127.0.0.1:8080/v1/health > /tmp/health.json && break
done
seed_id="$(python3 -c "import json;print(json.load(open('/tmp/health.json'))['seed']['machine_id'])" 2> /dev/null || true)"
if [ -n "$seed_id" ]; then pass "health reports a seed (machine-id $seed_id)"; else fail "no healthy seed"; fi

echo "==> create"
curl -sS -X POST --max-time 90 http://127.0.0.1:8080/v1/sessions > /tmp/session.json
sid="$(python3 -c "import json;print(json.load(open('/tmp/session.json'))['id'])" 2> /dev/null || true)"
if [ -n "$sid" ]; then pass "session $sid created"; else fail "no session: $(cat /tmp/session.json)"; fi

if [ -n "$sid" ]; then
  echo "==> exec"
  curl -sS -X POST --max-time 90 -H 'content-type: application/json' \
    -d '{"argv":["/bin/sh","-c","hostname; uname -m; cat /etc/machine-id"]}' \
    "http://127.0.0.1:8080/v1/sessions/$sid/exec" > /tmp/exec.json
  out="$(python3 -c "
import base64, json
d = json.load(open('/tmp/exec.json'))
print('exit', d['exit_code'])
print(base64.b64decode(d['stdout_b64']).decode().strip())
" 2> /dev/null || true)"
  if [ -n "$out" ]; then printf '%s\n' "$out"; else fail "exec returned nothing: $(cat /tmp/exec.json)"; fi
  session_id="$(printf '%s\n' "$out" | tail -1)"
  if [ -n "$session_id" ] && [ "$session_id" != "$seed_id" ]; then
    pass "session has its own machine-id"
  else
    fail "machine-id is '$session_id' (seed '$seed_id')"
  fi

  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 90 -X DELETE "http://127.0.0.1:8080/v1/sessions/$sid")"
  if [ "$code" = "204" ]; then pass "destroy returned 204"; else fail "destroy returned $code"; fi
fi

echo "==> leftovers"
sudo pkill -f "[p]ython3 -m orchestrator" 2> /dev/null || true
sleep 1
if pgrep -x firecracker > /dev/null; then fail "firecracker still running"; else pass "no firecracker left"; fi
printf '      volume: %s\n' "$(ls /opt/fc/sessions/mnt)"

echo
echo "host-smoke: $PASS passed, $FAIL failed"
[ "$FAIL" = 0 ]