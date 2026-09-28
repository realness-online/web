#!/usr/bin/env bash
# dev-stack - the dev host: actors volume, TAP0, and the actor API.
#
#   sudo bash /mnt/fc/control/scripts/dev-stack.sh
#
# Driven from the Mac by `webspace dev up`, which runs it in the background and
# waits for health. Run it directly to watch the serve in the foreground.
#
# The volume persists across runs: an actor's disk is its identity, and
# rebuilding the seed costs a boot. FRESH=1 wipes the image and starts over.
#
# This is host plumbing, so it stays shell. Everything below the API is the
# host's.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"     # /mnt/fc
VOL="${VOL:-/opt/fc/actors}"
IMAGE="$VOL/xfs.img"
MOUNT="$VOL/mnt"
SIZE="${SIZE:-6G}"
PORT="${PORT:-8080}"

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

if [ "${FRESH:-0}" = 1 ]; then
  echo "FRESH=1: wiping $IMAGE"
  if mountpoint -q "$MOUNT"; then umount "$MOUNT"; fi
  rm -rf "$VOL"
fi

mkdir -p "$VOL" "$MOUNT"

# A sparse image bigger than the host's free space does not fail as ENOSPC: the
# write past the last backed block comes back as EIO, and Firecracker reports it
# as "Cannot perform sync_all on the memory backing file" in the middle of a
# snapshot. Size the volume to what this host can actually back.
size_bytes="$(numfmt --from=iec "$SIZE")"
host_free="$(df --output=avail -B1 "$VOL" | tail -1)"
already=0
if [ -e "$IMAGE" ]; then already="$(du -B1 "$IMAGE" | cut -f1)"; fi
want=$((size_bytes - already))
if [ "$want" -gt "$host_free" ]; then
  printf 'actors volume wants %s but %s MiB is free on the host disk\n' \
    "$SIZE" "$((host_free / 1024 / 1024))" >&2
  printf 'lower SIZE, or free space - finished work dirs live in /opt/fc\n' >&2
  exit 1
fi

# xfs because an actor disk is a reflink of the seed's - the reason the
# volume exists at all rather than actor disks sitting next to the template.
if [ ! -e "$IMAGE" ]; then
  echo "new actors volume: $IMAGE ($SIZE, sparse)"
  truncate -s "$SIZE" "$IMAGE"
  mkfs.xfs -q -f "$IMAGE"
fi

if ! mountpoint -q "$MOUNT"; then
  echo "mounting $IMAGE at $MOUNT"
  mount -o loop "$IMAGE" "$MOUNT"
fi

# The image is a sparse file on the Lima disk. A destroyed actor frees blocks
# inside xfs but not in the file, so the file only grows until the Lima disk is
# full and a template build dies at mkfs with ENOSPC. fstrim punches the holes.
# Mounting with `discard` did not: a deleted 500 MiB stayed allocated.
fstrim "$MOUNT" || true
# $$ becomes the host at the exec below, so the loop ends with it.
( while sleep 300 && kill -0 $$ 2> /dev/null; do fstrim "$MOUNT" 2> /dev/null || true; done ) &

echo "volume: $(stat -f -c %T "$MOUNT"), $(df -h --output=avail "$MOUNT" | tail -1) free"

# TAP0 plus its NAT rules. The seed boot needs a TAP; an actor's own egress is
# h2's, so actors get TAPs this script knows nothing about.
# 18095: the fresh-actor check's sync service, on the Lima host.
ACTOR_HOST_PORTS="18095" bash "$DIR/host/scripts/net-up.sh"

# Dev only: one shared signing key for sync, host, and the contract check.
secret_file="$DIR/dist/host-pass-secret"
if [ ! -f "$secret_file" ]; then
  echo "missing $secret_file: generate a 32-byte secret before starting the dev host" >&2
  exit 1
fi
export HOST_PASS_SECRET="$(< "$secret_file")"
# Development host and local proxy use a separate model-signing key.
model_secret_file="$DIR/dist/model-pass-secret"
[ -s "$model_secret_file" ] || { echo "missing $model_secret_file: generate a 32-byte secret" >&2; exit 1; }
export MODEL_PASS_SECRET="$(< "$model_secret_file")"
[ "${#MODEL_PASS_SECRET}" -ge 32 ] || { echo "model pass secret is too short" >&2; exit 1; }
origin_file="$DIR/dist/sign-on-origin"
if [ -f "$origin_file" ]; then
  export SIGN_ON_ORIGIN="${SIGN_ON_ORIGIN:-$(< "$origin_file")}"
else
  export SIGN_ON_ORIGIN="${SIGN_ON_ORIGIN:-http://localhost:5173}"
fi

# The package is imported by name, so the import path is the project root.
cd "$DIR"
# The link `brayness publish` prints: each site at its own root, through
# Lima's forward of the API port. Browsers resolve *.localhost locally.
site_url_default='http://{id}.localhost:18080/'
export BRAYNESS_SITE_URL="${BRAYNESS_SITE_URL:-$site_url_default}"
exec node host/main.js serve --volume "$MOUNT" --listen 0.0.0.0 --port "$PORT"