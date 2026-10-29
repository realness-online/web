#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
. "$DIR/lib/output.sh"
local_values="$(node "$DIR/src/settings/cli.js" shell local)"
eval "$local_values"
unset local_values
VOL="${VOL:-/opt/fc/actors}"
IMAGE="$VOL/xfs.img"
MOUNT="$VOL/mnt"
SIZE="${SIZE:-10G}"
PORT="${PORT:-$halo_port}"
RUNTIME="${RUNTIME:-box}"
BOX_VOL="${BOX_VOL:-/opt/fc/boxes}"

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

if [ "${FRESH:-0}" = 1 ]; then
  echo "FRESH=1: wiping $IMAGE"
  if mountpoint -q "$MOUNT"; then umount "$MOUNT"; fi
  rm -rf "$VOL"
fi

mkdir -p "$VOL" "$MOUNT"

size_bytes="$(numfmt --from=iec "$SIZE")"
host_free="$(df --output=avail -B1 "$VOL" | tail -1)"
already=0
if [ -e "$IMAGE" ]; then already="$(du -B1 "$IMAGE" | cut -f1)"; fi
want=$((size_bytes - already))
if [ "$want" -gt "$host_free" ]; then
  printf 'actors volume wants %s but %s MiB is free on the halo disk\n' \
    "$SIZE" "$((host_free / 1024 / 1024))" >&2
  printf 'lower SIZE, or free space - finished work dirs live in /opt/fc\n' >&2
  exit 1
fi

if [ ! -e "$IMAGE" ]; then
  echo "new actors volume: $IMAGE ($SIZE, sparse)"
  truncate -s "$SIZE" "$IMAGE"
  mkfs.xfs -q -f "$IMAGE"
elif [ "$(stat -c %s "$IMAGE")" -lt "$size_bytes" ]; then
  echo "growing actors volume to $SIZE"
  truncate -s "$SIZE" "$IMAGE"
  grow=1
fi

if ! mountpoint -q "$MOUNT"; then
  echo "mounting $IMAGE at $MOUNT"
  mount -o loop "$IMAGE" "$MOUNT"
fi

if [ "${grow:-0}" = 1 ]; then
  losetup -c "$(findmnt -no SOURCE "$MOUNT")"
  xfs_growfs -d "$MOUNT" > /dev/null
fi

fstrim "$MOUNT" || true
( while sleep 300 && kill -0 $$ 2> /dev/null; do fstrim "$MOUNT" 2> /dev/null || true; done ) &

echo "volume: $(stat -f -c %T "$MOUNT"), $(df -h --output=avail "$MOUNT" | tail -1) free"

ACTOR_HOST_PORTS="18095 $site_port $actor_proxy_port $actor_sync_port" bash "$DIR/server/halo/scripts/net-up.sh"

secret_file=/etc/realness/halo-pass-secret
if [ ! -f "$secret_file" ]; then
  echo "missing $secret_file: halo up installs it from .pi/agent/secrets" >&2
  exit 1
fi
export HALO_PASS_SECRET="$(< "$secret_file")"
export RECORD_SECRET_FILE=/etc/realness/record-secret
SYNC_DIR=/sync-data node "$DIR/server/halo/scripts/record-key-dev.js"
site_sync_pid="$OUT/site-sync.pid"
if [ -s "$site_sync_pid" ] && kill -0 "$(< "$site_sync_pid")" 2> /dev/null; then
  kill "$(< "$site_sync_pid")"
  for attempt in {1..30}; do
    kill -0 "$(< "$site_sync_pid")" 2> /dev/null || break
    sleep 1
  done
  if kill -0 "$(< "$site_sync_pid")" 2> /dev/null; then echo 'site sync did not stop' >&2; exit 1; fi
fi
if ! [ -s "$site_sync_pid" ] || ! kill -0 "$(< "$site_sync_pid")" 2> /dev/null; then
  mkdir -p "$OUT/site-sync"
  nohup env HALO_PASS_SECRET="$HALO_PASS_SECRET" PROJECT="$dev_project" LISTEN=0.0.0.0 PORT="$site_port" SYNC_DIR="$OUT/site-sync" \
    node "$DIR/server/sync/bin/sync-service.js" > "$OUT/site-sync.log" 2>&1 &
  echo $! > "$site_sync_pid"
fi
for attempt in {1..30}; do
  if curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$site_port/sites/a-000000000000/"; then break; fi
  sleep 1
done
kill -0 "$(< "$site_sync_pid")" || { echo 'site sync failed to start' >&2; exit 1; }
model_secret_file=/etc/realness/model-pass-secret
[ -s "$model_secret_file" ] || { echo "missing $model_secret_file: halo up installs it from .pi/agent/secrets" >&2; exit 1; }
export MODEL_PASS_SECRET="$(< "$model_secret_file")"
[ "${#MODEL_PASS_SECRET}" -ge 32 ] || { echo "model pass secret is too short" >&2; exit 1; }

proxy_forward_pid="$OUT/proxy-forward.pid"
if [ -s "$proxy_forward_pid" ] && kill -0 "$(< "$proxy_forward_pid")" 2> /dev/null; then kill "$(< "$proxy_forward_pid")"; fi
nohup node "$DIR/server/halo/scripts/port-forward.js" "$actor_proxy_port" host.lima.internal "$proxy_port" > "$OUT/proxy-forward.log" 2>&1 &
echo $! > "$proxy_forward_pid"
sync_forward_pid="$OUT/sync-forward.pid"
if [ -s "$sync_forward_pid" ] && kill -0 "$(< "$sync_forward_pid")" 2> /dev/null; then kill "$(< "$sync_forward_pid")"; fi
nohup node "$DIR/server/halo/scripts/port-forward.js" "$actor_sync_port" host.lima.internal "$sync_port" > "$OUT/sync-forward.log" 2>&1 &
echo $! > "$sync_forward_pid"

cd "$DIR"
if [ "$RUNTIME" = box ]; then
  mkdir -p "$BOX_VOL"
  vault_args=()
  if [ -n "${HOST_OWNER:-}" ] && [ -d /host/vault ]; then
    vault_args=(--host-vault /host/vault --host-owner "$HOST_OWNER")
  fi
  exec node server/halo/main.js serve --environment local --runtime box --volume "$BOX_VOL" --listen 0.0.0.0 --port "$PORT" --boot-timeout "${ACTOR_BOOT_TIMEOUT:-120}" "${vault_args[@]}"
fi
exec node server/halo/main.js serve --environment local --volume "$MOUNT" --listen 0.0.0.0 --port "$PORT" --mem-mib "${ACTOR_MIB:-1536}" --boot-timeout "${ACTOR_BOOT_TIMEOUT:-240}"