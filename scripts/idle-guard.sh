#!/usr/bin/env bash
# idle-guard - shut the prod host down when nothing is happening.
#
#   sudo bash ~/brayness/scripts/idle-guard.sh
#
# GCP turns a guest poweroff into STOPPED, so an idle host bills disks only
# (~$0.041/h) and `gcloud compute instances start` brings it back. The check
# runs locally every 5 minutes, never over ssh, and only stops the host after
# IDLE_SECONDS of nothing: no firecracker, no orchestrator, no ssh session.
# This is the proof-phase guard; host lifecycle moves into the orchestrator
# later, which is the only thing that really knows a session is live.
set -euo pipefail

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

IDLE_SECONDS="${IDLE_SECONDS:-1800}"
CHECK="/usr/local/bin/brayness-idle-check"
UNIT="/etc/systemd/system/brayness-idle-check"

cat > "$CHECK" <<'SH'
#!/usr/bin/env bash
# Stop the host if nothing has happened for IDLE_SECONDS. The state file lives
# on tmpfs, so a boot starts the clock over.
set -euo pipefail

IDLE_SECONDS="${IDLE_SECONDS:-1800}"
STATE="/run/brayness-idle-since"

active() {
  # An explicit hold, for work that is not a running VM: x1 snapshots, a long
  # build. tmpfs, so a boot clears it. `sudo touch /run/brayness-hold`.
  [ -e /run/brayness-hold ] && return 0
  # A zombie is not activity: it holds nothing and would keep this host awake
  # forever. Reaping is the orchestrator's job - this only refuses to be fooled
  # by one that got away.
  for pid in $(pgrep -x firecracker 2> /dev/null || true); do
    [ "$(awk '{print $3}' "/proc/$pid/stat" 2> /dev/null)" = "Z" ] || return 0
  done
  # Bracket the first letter: pgrep -f matches any process whose argv contains
  # the pattern, including the shell that is running this check.
  pgrep -f "[p]ython3 -m orchestrator" > /dev/null && return 0
  # A human at a shell. `sshd: scott@pts/0` is an interactive login;
  # `sshd: scott@notty` is `gcloud compute ssh --command`, which a poller can
  # hold all day. Matching "sshd: " would also match the always-present
  # listener, whose argv is "sshd: /usr/sbin/sshd -D [listener] ...".
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
  # --no-block: the shutdown job stops this unit, so waiting on it deadlocks.
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
printf '\n==> one dry run now (an ssh session is open, so it must do nothing)\n'
"$CHECK"
printf 'idle state file: %s\n' "$(test -f /run/brayness-idle-since && echo present || echo absent - activity seen)"
