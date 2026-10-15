#!/usr/bin/env bash
set -euo pipefail

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
owner="${1:?usage: boot-serve.sh <owner>}"
home="$(getent passwd "$owner" | cut -d: -f6)"
[ -n "$home" ] || { echo "no home for $owner" >&2; exit 1; }

cat > /etc/systemd/system/realness-host.service <<UNIT
[Unit]
Description=Serve realness actors after a boot or wake
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=$owner
ExecStart=/bin/bash $home/realness/server/host/scripts/host-restart.sh

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable realness-host.service > /dev/null
