#!/usr/bin/env bash
# orchestrator-restart - the host's orchestrator, rebuilt from the current code.
#
#   cat ~/brayness/orchestrator/scripts/orchestrator-restart.sh | ssh host 'bash -s'
#
# Stops any orchestrator and leftover Firecracker, re-asserts the tap, serves on
# loopback in the background, and waits for health. Run it by path or over
# `bash -s`; never as an inline ssh --command that holds a pkill pattern, because
# the pattern matches the shell running the ssh command and kills it halfway
# through.
set -uo pipefail

cd "$HOME/brayness"
sudo pkill -f "[p]ython3 -m orchestrator" || true
sudo pkill -x firecracker || true
sleep 2
sudo bash "$HOME/brayness/orchestrator/scripts/net-up.sh" | head -1
# Running as root used to leave root-owned __pycache__ in the source tree, which
# then made the next `scp` of the code fail as an unprivileged user.
sudo env PYTHONDONTWRITEBYTECODE=1 nohup python3 -m orchestrator serve \
  --volume /opt/fc/sessions/mnt --listen 127.0.0.1 --port 8080 > /tmp/orch.log 2>&1 &
# Three minutes, not one: on a host that has no seed yet, the first serve builds
# it, and that means booting the template and pausing it (about 36s) before the
# listener ever answers. A 60s wait read as a dead orchestrator on a fresh host.
for _ in $(seq 1 90); do
  sleep 2
  curl -sf --max-time 3 http://127.0.0.1:8080/v1/health > /dev/null && break
done
curl -sS http://127.0.0.1:8080/v1/health || echo "no health"
tail -2 /tmp/orch.log