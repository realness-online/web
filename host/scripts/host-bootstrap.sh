#!/usr/bin/env bash
# host-bootstrap - take a fresh fleet-image host to a host that can serve.
#
#   sudo bash ~/brayness/host/scripts/host-bootstrap.sh
#
# The image already carries /opt/fc and the idle guard, so this is only what is
# per-instance: the root partition (an instance created from an image keeps the
# image's partition), the tap microVMs leave through, the sessions volume, and
# the guard timer. Idempotent - it is safe on a host that is already serving.
#
# A seed is deliberately not built here. build_seed boots the template and
# takes ~36s, and the host builds it on first serve anyway.
set -euo pipefail

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> ownership"
# The host runs as root, so anything it wrote into the source tree is
# root-owned, and the next `scp` of the code over it fails for the login user.
if [ -n "${SUDO_USER:-}" ]; then
  chown -R "$SUDO_USER:$SUDO_USER" "/home/$SUDO_USER/brayness" 2> /dev/null || true
fi

echo "==> root partition"
root_dev="$(findmnt -no SOURCE /)"
root_disk="/dev/$(lsblk -no PKNAME "$root_dev")"
root_part="$(cat "/sys/class/block/$(basename "$root_dev")/partition")"
# growpart says NOCHANGE instead of failing when there is nothing to grow, and
# resize2fs is a no-op on a filesystem that already fills its partition, so
# both are safe to re-run.
growpart "$root_disk" "$root_part" || true
resize2fs "$root_dev" || true
df -h / | tail -1

echo "==> node"
bash "$HERE/node-install.sh"

echo "==> net"
bash "$HERE/net-up.sh"

echo "==> sessions volume"
if [ -e /dev/disk/by-id/google-brayness-sessions ]; then
  bash "$HERE/sessions-volume.sh" | tail -4
else
  echo "no sessions volume attached - skipped"
fi

echo "==> idle guard"
bash "$HERE/idle-guard.sh" | tail -2
systemctl is-active brayness-idle-check.timer

echo "==> state"
printf '      vmx flags: %s\n' "$(grep -cw vmx /proc/cpuinfo)"
printf '      /dev/kvm: %s\n' "$(ls -l /dev/kvm 2>/dev/null | awk '{print $1, $3, $4, $5, $6}')"
printf '      firecracker: %s\n' "$(/opt/fc/firecracker --version 2>&1 | head -1)"
printf '      kernel: %s\n' "$(ls -l /opt/fc/vmlinux-* 2>/dev/null | awk '{print $9}')"
printf '      template: %s\n' "$(ls -lh /opt/fc/template.ext4 2>/dev/null | awk '{print $5}')"
printf '      volume: %s\n' "$(findmnt -no SOURCE,FSTYPE,AVAIL /opt/fc/sessions/mnt 2>/dev/null || echo 'not mounted')"
printf '      seed: %s\n' "$(ls -d /opt/fc/sessions/mnt/seed 2>/dev/null || echo 'none yet (built on first serve)')"
printf '      hold: %s\n' "$(ls /run/brayness-hold 2>/dev/null || echo 'not held')"