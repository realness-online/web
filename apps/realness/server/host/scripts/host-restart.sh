#!/usr/bin/env bash
set -uo pipefail

cd "$HOME/realness"
record_secret=/etc/realness/record-secret
if ! sudo test -s "$record_secret" || [ "$(sudo stat -c %a "$record_secret")" != 600 ] || [ "$(sudo stat -c %u "$record_secret")" != 0 ]; then
  echo "missing root-only $record_secret (0600); refusing to restart" >&2
  exit 1
fi
export RECORD_SECRET_FILE="$record_secret"
sudo pkill -f "[n]ode (server/)?host/main\.js" || true
sudo pkill -x firecracker || true
sleep 2
sudo bash "$HOME/realness/server/host/scripts/net-up.sh" | head -1
sudo bash "$HOME/realness/server/host/scripts/node-install.sh" | tail -1
sudo bash "$HOME/realness/server/host/scripts/idle-guard.sh" > /dev/null
sudo bash "$HOME/realness/server/host/scripts/boot-serve.sh" "$(whoami)"
model_secret=/etc/realness/model-pass-secret
if ! sudo test -s "$model_secret" || [ "$(sudo stat -c %a "$model_secret")" != 600 ] || [ "$(sudo stat -c %u "$model_secret")" != 0 ]; then
  echo "missing root-only $model_secret (0600); refusing to start" >&2
  exit 1
fi
export MODEL_PASS_SECRET="$(sudo cat "$model_secret")"
if [ "${#MODEL_PASS_SECRET}" -lt 32 ]; then echo "model pass secret is too short" >&2; exit 1; fi
host_secret=/etc/realness/host-pass-secret
if ! sudo test -s "$host_secret" || [ "$(sudo stat -c %a "$host_secret")" != 600 ] || [ "$(sudo stat -c %u "$host_secret")" != 0 ]; then
  echo "missing root-only $host_secret (0600); refusing to start" >&2
  exit 1
fi
export HOST_PASS_SECRET="$(sudo cat "$host_secret")"
if [ "${#HOST_PASS_SECRET}" -lt 32 ]; then echo "host pass secret is too short" >&2; exit 1; fi
environment_file=/etc/realness/environment
environment="$(sudo cat "$environment_file" 2> /dev/null)"
case "$environment" in
  development | production) ;;
  *) echo "missing $environment_file (development or production); refusing to start" >&2; exit 1 ;;
esac
host_values="$(node src/settings/cli.js shell host --env "$environment")" || exit $?
eval "$host_values"
unset host_values
export SYNC_URL="${SYNC_URL:-$sync_url_default}"
export SYNC_SITE_URL="${SYNC_SITE_URL:-$SYNC_URL}"
export SYNC_SITE_PUBLIC_URL="${SYNC_SITE_PUBLIC_URL:-$sites_url_default}"
private_ip="$(curl -sf -H Metadata-Flavor:Google http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ip)"
if [ -z "$private_ip" ]; then echo "no private address from metadata" >&2; exit 1; fi
sudo -E nohup node server/host/main.js serve --environment "$environment" \
  --volume /opt/fc/actors/mnt --listen 127.0.0.1 --pty-listen "127.0.0.1,$private_ip" --api-listen "127.0.0.1,$private_ip" --port 8080 --park > /tmp/orch.log 2>&1 &
for _ in $(seq 1 90); do
  sleep 2
  curl -sf --max-time 3 http://127.0.0.1:8080/v1/health > /dev/null && break
done
curl -sS http://127.0.0.1:8080/v1/health || echo "no health"
tail -2 /tmp/orch.log