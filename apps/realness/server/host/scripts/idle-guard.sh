#!/usr/bin/env bash
set -euo pipefail

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

IDLE_SECONDS="${IDLE_SECONDS:-1800}"
CHECK="/usr/local/bin/brayness-idle-check"
UNIT="/etc/systemd/system/brayness-idle-check"

cat > "$CHECK" <<'SH'
set -euo pipefail

IDLE_SECONDS="${IDLE_SECONDS:-1800}"
STATE="/run/brayness-idle-since"

active() {
  [ -e /run/brayness-hold ] && return 0
  for pid in $(pgrep -x firecracker 2> /dev/null || true); do
    [ "$(awk '{print $3}' "/proc/$pid/stat" 2> /dev/null)" = "Z" ] || return 0
  done
  pgrep -f "[n]ode server/host/main.js" > /dev/null && return 0
  pgrep -f "sshd: [^ ]*@pts" > /dev/null && return 0
  return 1
}

if active; then
  rm -f "$STATE"
  exit 0
fi

now="$(date +%s)"
if [ ! -f "$STATE" ]; then
  printf '%s\n' "$now" > "$STATE"
  exit 0
fi

since="$(cat "$STATE")"
idle=$((now - since))
if [ "$idle" -ge "$IDLE_SECONDS" ]; then
  logger -t brayness-idle "idle ${idle}s (threshold ${IDLE_SECONDS}s): powering off"
  systemctl --no-block poweroff
fi
SH
chmod 755 "$CHECK"

cat > "$UNIT.service" <<SH
[Unit]
Description=Stop the brayness host when it is idle

[Service]
Type=oneshot
Environment=IDLE_SECONDS=$IDLE_SECONDS
ExecStart=$CHECK
SH

cat > "$UNIT.timer" <<SH
[Unit]
Description=Check every 5 minutes whether the brayness host is idle

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min
AccuracySec=30s

[Install]
WantedBy=timers.target
SH

systemctl daemon-reload
systemctl enable --now brayness-idle-check.timer

printf '==> threshold %ss, %s\n' "$IDLE_SECONDS" "$UNIT.timer"
printf '    hold: sudo touch /run/brayness-hold (cleared by a boot)\n'
systemctl list-timers brayness-idle-check.timer --no-pager
printf '\n==> one dry run now (an ssh actor is open, so it must do nothing)\n'
"$CHECK"
printf 'idle state file: %s\n' "$(test -f /run/brayness-idle-since && echo present || echo absent - activity seen)"
