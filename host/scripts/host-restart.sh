#!/usr/bin/env bash
# host-restart - the host, restarted on the current code.
#
#   cat ~/brayness/host/scripts/host-restart.sh | ssh host 'bash -s'
#
# Stops any host process and leftover Firecracker, re-asserts the tap, serves on
# loopback in the background, and waits for health. Run it by path or over
# `bash -s`; never as an inline ssh --command that holds a pkill pattern, because
# the pattern matches the shell running the ssh command and kills it halfway
# through.
set -uo pipefail

cd "$HOME/brayness"
sudo pkill -f "[n]ode host/main.js" || true
sudo pkill -x firecracker || true
sleep 2
sudo bash "$HOME/brayness/host/scripts/net-up.sh" | head -1
sudo bash "$HOME/brayness/host/scripts/node-install.sh" | tail -1
sudo nohup node host/main.js serve \
  --volume /opt/fc/sessions/mnt --listen 127.0.0.1 --port 8080 > /tmp/orch.log 2>&1 &
# Three minutes, not one: on a host that has no seed yet, the first serve builds
# it, and that means booting the template and pausing it (about 36s) before the
# listener ever answers. A 60s wait read as a dead host on a fresh host.
for _ in $(seq 1 90); do
  sleep 2
  curl -sf --max-time 3 http://127.0.0.1:8080/v1/health > /dev/null && break
done
curl -sS http://127.0.0.1:8080/v1/health || echo "no health"
tail -2 /tmp/orch.log