#!/usr/bin/env bash
# sessions-volume - the sessions volume on the prod host: a real PD, xfs, reflink.
#
#   sudo bash ~/brayness/host/scripts/sessions-volume.sh
#
# xfs + reflink was proven on a loopback image first. This is the shipped version:
# format the attached sessions PD, mount it where the host looks
# (/opt/fc/sessions/mnt is --volume's default), and run the same checks against
# real storage. Idempotent: a disk that is already xfs is mounted, not
# reformatted.
set -euo pipefail

DEV="${DEV:-/dev/disk/by-id/google-brayness-sessions}"   # the sessions PD
MNT="${MNT:-/opt/fc/sessions/mnt}"
IMAGE="${IMAGE:-/opt/fc/rootfs.ext4}"     # what gets seeded onto the volume
SEED="$MNT/seed.ext4"                     # the copy sessions reflink from

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
[ -e "$DEV" ] || { echo "no $DEV" >&2; exit 1; }
[ -f "$IMAGE" ] || { echo "no $IMAGE - run d3-fetch-x86_64.sh (archived: artifacts/firecracker/webspace-archive/scripts) first" >&2; exit 1; }

PASS=0
FAIL=0
pass() { printf 'PASS  %s\n' "$1"; PASS=$((PASS + 1)); }
fail() { printf 'FAIL  %s\n' "$1"; FAIL=$((FAIL + 1)); }
log() { printf '\n==> %s\n' "$*"; }

# Allocated bytes of a file, in KiB. Shared extents are counted once per file
# that points at them, which is exactly what reflink breaks, so this is a
# per-file measure and never free space.
alloc_kb() { du -s "$1" | cut -f1; }
chunk_md5() { dd if="$1" bs=1M count=1 skip="$2" status=none | md5sum | cut -d' ' -f1; }

kind="$(blkid -s TYPE -o value "$DEV" || true)"
log "sessions volume $DEV (${kind:-blank}) at $MNT"
if [ "$kind" != "xfs" ]; then
  [ -z "$kind" ] || { echo "$DEV holds $kind - refusing to format" >&2; exit 1; }
  mkfs.xfs -q -f "$DEV"
fi

mkdir -p "$MNT"
uuid="$(blkid -s UUID -o value "$DEV")"
mountpoint -q "$MNT" || mount -U "$uuid" "$MNT"
# Survive a reboot. The disk is the sessions, and stop/start is how this host
# idles, so the filesystem comes back by UUID and never by device node. nofail:
# a missing disk must not wedge boot. A replaced disk leaves a dead UUID line
# behind, so only ever keep one entry for this mount point.
if ! grep -q "$uuid" /etc/fstab; then
  sed -i "\| $MNT |d" /etc/fstab
  printf 'UUID=%s %s xfs defaults,nofail 0 2\n' "$uuid" "$MNT" >> /etc/fstab
fi

reflink="$({ xfs_info "$MNT" | grep -o 'reflink=[01]' || true; } | head -1)"
printf '      %s\n' "$(xfs_info "$MNT" | tail -1)"
if [ "$reflink" = "reflink=1" ]; then
  pass "reflink is enabled on the filesystem"
else
  fail "reflink is not enabled (saw '${reflink:-none}')"
fi

log "cloning the volume's seed twice, timed"
# Reflink is same-filesystem only: a clone from the ext4 boot disk fails with
# "Invalid cross-device link". The seed has to live on the sessions volume, and
# this copy is the one real copy - every session reflinks from it.
if [ ! -f "$SEED" ]; then
  log "seeding the volume: $IMAGE -> $SEED"
  cp --sparse=always "$IMAGE" "$SEED"
fi
used_before="$(df --output=used -k "$MNT" | tail -1)"
t0=$(date +%s%N)
cp --reflink=always "$SEED" "$MNT/sess-a.ext4"
cp --reflink=always "$SEED" "$MNT/sess-b.ext4"
t1=$(date +%s%N)
ms=$(((t1 - t0) / 1000000))
printf '      two clones took %sms\n' "$ms"
if [ "$ms" -lt 1000 ]; then
  pass "two reflink clones finished in ${ms}ms"
else
  fail "reflink clones took ${ms}ms - not the instant copy expected"
fi

# Free space, not `du`: this is the measure that sees extents being shared.
used_after="$(df --output=used -k "$MNT" | tail -1)"
delta=$((used_after - used_before))
printf '      filesystem used grew by %sK for two clones\n' "$delta"
if [ "$delta" -lt 1024 ]; then
  pass "the clones share the seed's extents (free space barely moved)"
else
  fail "clones allocated real space each (grew ${delta}K)"
fi

log "writing 128 MiB into sess-a at 256 MiB, and a byte into sess-b"
base_kb="$(alloc_kb "$MNT/sess-b.ext4")"
seed_at_256="$(chunk_md5 "$SEED" 256)"
dd if=/dev/urandom of="$MNT/sess-a.ext4" bs=1M count=128 seek=256 conv=notrunc status=none
dd if=/dev/urandom of="$MNT/sess-b.ext4" bs=1M count=1 conv=notrunc status=none
printf '      allocated now: sess-a %sK, sess-b %sK (base %sK)\n' \
  "$(alloc_kb "$MNT/sess-a.ext4")" "$(alloc_kb "$MNT/sess-b.ext4")" "$base_kb"
if [ "$(alloc_kb "$MNT/sess-a.ext4")" -gt "$(alloc_kb "$MNT/sess-b.ext4")" ]; then
  pass "sess-a's 128 MiB allocated inside sess-a only"
else
  fail "sess-a's write did not allocate fresh space (COW is off)"
fi
if [ "$(chunk_md5 "$SEED" 256)" = "$seed_at_256" ]; then
  pass "sess-a's write did not change the seed's bytes"
else
  fail "sess-a's write appeared in the seed - not copy-on-write"
fi
if [ "$(alloc_kb "$MNT/sess-b.ext4")" -lt "$((base_kb + 65536))" ]; then
  pass "sess-b's 1 MiB write did not allocate a whole copy"
else
  fail "sess-b allocated $(alloc_kb "$MNT/sess-b.ext4")K for 1 MiB"
fi

rm -f "$MNT/sess-a.ext4" "$MNT/sess-b.ext4"
printf '\n      '; df -h "$MNT" | tail -1
printf '\n%s: %s passed, %s failed\n' "d3e" "$PASS" "$FAIL"
[ "$FAIL" = 0 ]
