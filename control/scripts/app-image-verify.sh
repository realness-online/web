#!/usr/bin/env bash
# Runs inside the fc-local Lima guest. u2a's check: the stripped app image
# boots on the Firecracker CI kernel, reaches userspace, brings up its own
# address, and carries none of the actor's tools.
#
#   sudo bash /mnt/fc/control/scripts/app-image-verify.sh
#
# Needs fc-tap0: `sudo bash /mnt/fc/host/scripts/net-up.sh` first.
#
# Two halves, cheapest first. The absences are read off the image file, which
# is deterministic and needs no boot; the boot is then the expensive one, and
# it is the only thing that can prove userspace and the network path.
set -euo pipefail

ROOT="${ROOT:-/opt/fc}"
IMG="${IMG:-$ROOT/app.ext4}"
KERNEL="${KERNEL:-$ROOT/vmlinux-6.1.155}"
TAP="${TAP:-fc-tap0}"
RUNS="${RUNS_DIR:-/mnt/fc/dist}"
RUN="$RUNS/app-image-check-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUN"

PASS=0
FAIL=0
ok()   { printf '  ok   %s\n' "$*"; PASS=$((PASS + 1)); }
bad()  { printf '  FAIL %s\n' "$*" >&2; FAIL=$((FAIL + 1)); }

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
[ -f "$IMG" ] || { echo "no image at $IMG - run app-image-build.sh first" >&2; exit 1; }

# ------------------------------------------------------------ absences (offline)
# debugfs reads the filesystem without mounting it, so nothing here needs a
# loop device or a mount that a running VM could collide with.
log_absences() {
  local out
  # `ls -l` on a missing path makes debugfs exit non-zero; that is the positive
  # result here, so the test is on the listing, not on debugfs's status.
  # `/brayness` and pi are the harness; git and socat are the actor's tools;
  # interpreters come only on a runtime disk, when an app's files ask for one.
  for path in /brayness /usr/local/bin/pi /usr/bin/git /usr/bin/socat \
    /usr/local/bin/node /usr/bin/python3 /usr/bin/perl; do
    out="$(debugfs -R "stat $path" "$IMG" 2> /dev/null | head -1 || true)"
    if [ -z "$out" ]; then ok "absent: $path"; else bad "present: $path"; fi
  done
}

log_absences

# The mount point a runtime disk lands on must exist, empty.
if debugfs -R "stat /opt/runtime" "$IMG" 2> /dev/null | grep -q "Type: directory"; then
  ok "present: /opt/runtime (empty mount point)"
else
  bad "missing: /opt/runtime"
fi

# -------------------------------------------------------------------- the boot
if ! ip link show "$TAP" > /dev/null 2>&1; then
  echo "no $TAP: run 'sudo bash /mnt/fc/host/scripts/net-up.sh' first" >&2
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

# Boot in the background so the guest can be probed while it is up. The
# service's own echo lands in the journal, not the console - the unit has no
# StandardOutput=tty - so the address is proven from outside, by pinging it.
#
# The shell writes its own pid and then execs, so the pidfile holds the
# firecracker pid: `$!` would be sudo's, and killing sudo can leave the VM up.
# A neighbour entry survives the VM that made it, so flush the tap's table
# first: otherwise a stale REACHABLE from an earlier boot satisfies the check
# with no guest running at all.
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
  if grep -qE "Reached target .*(Multi-User|Graphical)|login:" "$RUN/serial.log" 2> /dev/null; then break; fi
  sleep 1
  boot_waited=$((boot_waited + 1))
done

# grep's own exit status cannot be read directly: under set -e a 1 ends the
# script before the counter sees it, so each is wrapped in an if.
if grep -qE "Reached target .*(Multi-User|Graphical)|login:" "$RUN/serial.log"; then
  ok "guest reached userspace"
else
  bad "guest reached userspace"
fi

# The guest's address is proven by its ARP reply, not by ICMP: net-up.sh ends
# with `BRAYNESS-IN -j DROP`, so the host refuses traffic from the tap on
# purpose and a ping cannot succeed. The ping is the ARP probe; the answer is
# what lands in the neighbour table, next to the MAC the address was derived
# from (06:00:AC:10:00:02 -> 172.16.0.2).
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

# The image must not have started anything the actor template has. A failed
# unit is still a unit, so absence is proven by no mention at all.
for unit in brayness-vsock brayness-pty; do
  if grep -q "$unit" "$RUN/serial.log"; then bad "unit present: $unit"; else ok "no $unit"; fi
done

# A boot that reaches multi-user with a failed unit still passes the userspace
# grep above, so name the failing unit explicitly.
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
