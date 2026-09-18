#!/usr/bin/env bash
# dev-stack - the dev host: sessions volume, TAP0, and the session API.
#
#   sudo bash /mnt/fc/scripts/dev-stack.sh
#
# Driven from the Mac by `webspace dev up`, which runs it in the background and
# waits for health. Run it directly to watch the serve in the foreground.
#
# The volume persists across runs: a session's disk is its identity, and
# rebuilding the seed costs a boot. FRESH=1 wipes the image and starts over.
#
# This is host plumbing, so it stays shell. Everything below the API is the
# orchestrator's.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"     # /mnt/fc
VOL="${VOL:-/opt/fc/sessions}"
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
  printf 'sessions volume wants %s but %s MiB is free on the host disk\n' \
    "$SIZE" "$((host_free / 1024 / 1024))" >&2
  printf 'lower SIZE, or free space - finished work dirs live in /opt/fc\n' >&2
  exit 1
fi

# xfs because a session disk is a reflink of the seed's - the reason the
# volume exists at all rather than session disks sitting next to the template.
if [ ! -e "$IMAGE" ]; then
  echo "new sessions volume: $IMAGE ($SIZE, sparse)"
  truncate -s "$SIZE" "$IMAGE"
  mkfs.xfs -q -f "$IMAGE"
fi

if ! mountpoint -q "$MOUNT"; then
  echo "mounting $IMAGE at $MOUNT"
  mount -o loop "$IMAGE" "$MOUNT"
fi

echo "volume: $(stat -f -c %T "$MOUNT"), $(df -h --output=avail "$MOUNT" | tail -1) free"

# TAP0 plus its NAT rules. The seed boot needs a TAP; a session's own egress is
# h2's, so sessions get TAPs this script knows nothing about.
bash "$DIR/scripts/net-up.sh"

# The package lives in src/ and is imported by name, so the import path is the
# project root plus src. Same for the host scripts that run `-m orchestrator`.
cd "$DIR/src"
exec python3 -m orchestrator serve --volume "$MOUNT" --listen 0.0.0.0 --port "$PORT"