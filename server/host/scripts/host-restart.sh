#!/usr/bin/env bash
# host-restart - the host, restarted on the current code.
#
#   cat ~/brayness/server/host/scripts/host-restart.sh | ssh host 'bash -s'
#
# Stops any host process and leftover Firecracker, re-asserts the tap, serves on
# loopback in the background, and waits for health. Run it by path or over
# `bash -s`; never as an inline ssh --command that holds a pkill pattern, because
# the pattern matches the shell running the ssh command and kills it halfway
# through.
set -uo pipefail

cd "$HOME/brayness"
record_secret=/etc/brayness/record-secret
if ! sudo test -s "$record_secret" || [ "$(sudo stat -c %a "$record_secret")" != 600 ] || [ "$(sudo stat -c %u "$record_secret")" != 0 ]; then
  echo "missing root-only $record_secret (0600); refusing to restart" >&2
  exit 1
fi
export RECORD_SECRET_FILE="$record_secret"
sudo pkill -f "[n]ode (server/)?host/main\.js" || true
sudo pkill -x firecracker || true
sleep 2
sudo bash "$HOME/brayness/server/host/scripts/net-up.sh" | head -1
sudo bash "$HOME/brayness/server/host/scripts/node-install.sh" | tail -1
# An image baked before h4p carries a guard that looks for the Python host.
sudo bash "$HOME/brayness/server/host/scripts/idle-guard.sh" > /dev/null
# The host has no service account. An operator provisions this root-only file
# from Secret Manager; the guest and exports never receive it.
model_secret=/etc/brayness/model-pass-secret
if ! sudo test -s "$model_secret" || [ "$(sudo stat -c %a "$model_secret")" != 600 ] || [ "$(sudo stat -c %u "$model_secret")" != 0 ]; then
  echo "missing root-only $model_secret (0600); refusing to start" >&2
  exit 1
fi
export MODEL_PASS_SECRET="$(sudo cat "$model_secret")"
if [ "${#MODEL_PASS_SECRET}" -lt 32 ]; then echo "model pass secret is too short" >&2; exit 1; fi
# One value for every host: the sync service mints a host pass with it, and a
# host accepts that pass at its terminal. Same provisioning, same file shape:
#   gcloud secrets versions access latest --secret=HOST_PASS_SECRET \
#     --project=realness-development | sudo tee /etc/brayness/host-pass-secret
host_secret=/etc/brayness/host-pass-secret
if ! sudo test -s "$host_secret" || [ "$(sudo stat -c %a "$host_secret")" != 600 ] || [ "$(sudo stat -c %u "$host_secret")" != 0 ]; then
  echo "missing root-only $host_secret (0600); refusing to start" >&2
  exit 1
fi
export HOST_PASS_SECRET="$(sudo cat "$host_secret")"
if [ "${#HOST_PASS_SECRET}" -lt 32 ]; then echo "host pass secret is too short" >&2; exit 1; fi
export SYNC_URL="${SYNC_URL:-https://brayness-sync-639469569733.us-central1.run.app}"
# s1: published sites live in sync and are read at their own address, never the app's.
export SYNC_SITE_URL="${SYNC_SITE_URL:-$SYNC_URL}"
export SYNC_SITE_PUBLIC_URL="${SYNC_SITE_PUBLIC_URL:-https://realness-development-sites.web.app}"
# The gate reaches the terminal and the API on the private address; pages stay
# on loopback. The firewall admits only the VPC to them.
private_ip="$(curl -sf -H Metadata-Flavor:Google http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ip)"
if [ -z "$private_ip" ]; then echo "no private address from metadata" >&2; exit 1; fi
sudo -E nohup node server/host/main.js serve \
  --volume /opt/fc/actors/mnt --listen 127.0.0.1 --pty-listen "127.0.0.1,$private_ip" --api-listen "127.0.0.1,$private_ip" --port 8080 > /tmp/orch.log 2>&1 &
# Three minutes, not one: on a host that has no seed yet, the first serve builds
# it, and that means booting the template and pausing it (about 36s) before the
# listener ever answers. A 60s wait read as a dead host on a fresh host.
for _ in $(seq 1 90); do
  sleep 2
  curl -sf --max-time 3 http://127.0.0.1:8080/v1/health > /dev/null && break
done
curl -sS http://127.0.0.1:8080/v1/health || echo "no health"
tail -2 /tmp/orch.log