#!/usr/bin/env bash
set -euo pipefail

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> ownership"
if [ -n "${SUDO_USER:-}" ]; then
  chown -R "$SUDO_USER:$SUDO_USER" "/home/$SUDO_USER/brayness" 2> /dev/null || true
fi

echo "==> root partition"
root_dev="$(findmnt -no SOURCE /)"
root_disk="/dev/$(lsblk -no PKNAME "$root_dev")"
root_part="$(cat "/sys/class/block/$(basename "$root_dev")/partition")"
growpart "$root_disk" "$root_part" || true
resize2fs "$root_dev" || true
df -h / | tail -1

echo "==> node"
bash "$HERE/node-install.sh"

echo "==> net"
bash "$HERE/net-up.sh"

echo "==> actors volume"
if [ -e /dev/disk/by-id/google-brayness-actors ]; then
  bash "$HERE/actors-volume.sh" | tail -4
else
  echo "no actors volume attached - skipped"
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
printf '      volume: %s\n' "$(findmnt -no SOURCE,FSTYPE,AVAIL /opt/fc/actors/mnt 2>/dev/null || echo 'not mounted')"
printf '      seed: %s\n' "$(ls -d /opt/fc/actors/mnt/seed 2>/dev/null || echo 'none yet (built on first serve)')"
printf '      hold: %s\n' "$(ls /run/brayness-hold 2>/dev/null || echo 'not held')"