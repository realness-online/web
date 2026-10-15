#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-/opt/fc}"
IMG="${IMG:-$ROOT/app.ext4}"
KERNEL="${KERNEL:-$ROOT/vmlinux-6.1.155}"
TAP="${TAP:-fc-tap0}"
. "$(dirname "${BASH_SOURCE[0]}")/../../../lib/output.sh"
RUNS="${RUNS_DIR:-$OUT}"
RUN="$RUNS/app-image-check-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUN"

PASS=0
FAIL=0
ok()   { printf '  ok   %s\n' "$*"; PASS=$((PASS + 1)); }
bad()  { printf '  FAIL %s\n' "$*" >&2; FAIL=$((FAIL + 1)); }

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
[ -f "$IMG" ] || { echo "no image at $IMG - run app-image-build.sh first" >&2; exit 1; }

log_absences() {
  local out
  for path in /realness /usr/local/bin/pi /usr/bin/git /usr/bin/socat \
    /usr/local/bin/node /usr/bin/python3 /usr/bin/perl; do
    out="$(debugfs -R "stat $path" "$IMG" 2> /dev/null | head -1 || true)"
    if [ -z "$out" ]; then ok "absent: $path"; else bad "present: $path"; fi
  done
}

log_absences

if debugfs -R "stat /opt/runtime" "$IMG" 2> /dev/null | grep -q "Type: directory"; then
  ok "present: /opt/runtime (empty mount point)"
else
  bad "missing: /opt/runtime"
fi

if ! ip link show "$TAP" > /dev/null 2>&1; then
  echo "no $TAP: run 'sudo bash /mnt/fc/server/host/scripts/net-up.sh' first" >&2
  exit 1
fi

cat > "$RUN/vmconfig.json" <<JSON
{
  "boot-source": {
    "kernel_image_path": "$KERNEL",
    "boot_args": "keep_bootcon console=ttyS0 reboot=k panic=1"
  },
  "drives": [
    {
      "drive_id": "rootfs",
      "path_on_host": "$IMG",
      "is_root_device": true,
      "is_read_only": false
    }
  ],
  "machine-config": { "vcpu_count": 1, "mem_size_mib": 128 },
  "network-interfaces": [
    { "iface_id": "eth0", "host_dev_name": "$TAP", "guest_mac": "06:00:AC:10:00:02" }
  ]
}
JSON

ip neigh flush dev "$TAP" > /dev/null 2>&1 || true

sudo rm -f "$RUN/api.sock" "$RUN/fc.pid"
sudo sh -c "echo \$\$ > $RUN/fc.pid; exec $ROOT/firecracker --api-sock $RUN/api.sock --config-file $RUN/vmconfig.json" \
  > "$RUN/serial.log" 2>&1 &
cleanup() {
  if [ -s "$RUN/fc.pid" ]; then sudo kill "$(cat "$RUN/fc.pid")" 2> /dev/null || true; fi
}
trap cleanup EXIT

boot_waited=0
while [ "$boot_waited" -lt 60 ]; do
  if grep -qE "Reached target .*(Multi-User|Graphical)" "$RUN/serial.log" 2> /dev/null; then break; fi
  sleep 1
  boot_waited=$((boot_waited + 1))
done

if grep -qE "Reached target .*(Multi-User|Graphical)" "$RUN/serial.log"; then
  ok "guest reached userspace"
else
  bad "guest reached userspace"
fi

addressed=0
for _ in $(seq 1 20); do
  ping -q -c 1 -W 1 172.16.0.2 > /dev/null 2>&1 || true
  if ip neigh show dev "$TAP" | grep -q "^172.16.0.2 .*06:00:ac:10:00:02"; then addressed=1; break; fi
  sleep 1
done
if [ "$addressed" = 1 ]; then
  ok "guest answers ARP for 172.16.0.2 (address came from its MAC)"
else
  bad "guest answers ARP for 172.16.0.2"
  ip neigh show dev "$TAP" >&2 || true
fi

for unit in realness-vsock realness-pty getty@ serial-getty getty.target e2scrub; do
  if grep -q "$unit" "$RUN/serial.log"; then bad "unit present: $unit"; else ok "no $unit"; fi
done

if grep -qE "Failed to start|entered failed state" "$RUN/serial.log"; then
  bad "a unit failed during boot"
  grep -E "Failed to start|entered failed state" "$RUN/serial.log" | head -5 >&2
else
  ok "no unit failed"
fi

echo
lines="$(grep -cE '.' "$RUN/serial.log" || true)"
echo "$PASS passed, $FAIL failed  (serial: $RUN/serial.log, ${lines:-0} lines)"
[ "$FAIL" = 0 ]
