#!/usr/bin/env bash
# Runs inside the fc-local Lima guest. Boots one microVM from a config file and
# asserts the guest reached userspace.
set -euo pipefail

ROOT="/opt/fc"
RUNS="${RUNS_DIR:-/mnt/fc/dist}"
RUN="$RUNS/boot-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUN"

cat > "$RUN/vmconfig.json" <<JSON
{
  "boot-source": {
    "kernel_image_path": "$ROOT/vmlinux-6.1.155",
    "boot_args": "keep_bootcon console=ttyS0 reboot=k panic=1"
  },
  "drives": [
    {
      "drive_id": "rootfs",
      "path_on_host": "$ROOT/rootfs.ext4",
      "is_root_device": true,
      "is_read_only": false
    }
  ],
  "machine-config": { "vcpu_count": 2, "mem_size_mib": 512 }
}
JSON

sudo rm -f /tmp/fc.sock
sudo timeout 75 "$ROOT/firecracker" --api-sock /tmp/fc.sock \
  --config-file "$RUN/vmconfig.json" > "$RUN/serial.log" 2>&1 || true

if grep -qE "Reached target .*(Multi-User|Graphical)|login:" "$RUN/serial.log"; then
  echo "PASS: guest reached userspace"
  echo "      $(grep -cE '.' "$RUN/serial.log") serial lines in $RUN/serial.log"
  grep -m1 -E "Linux version" "$RUN/serial.log"
  grep -m1 -E "Reached target .*(Multi-User|Graphical)|login:" "$RUN/serial.log"
else
  echo "FAIL: no userspace marker in $RUN/serial.log" >&2
  tail -30 "$RUN/serial.log" >&2
  exit 1
fi
