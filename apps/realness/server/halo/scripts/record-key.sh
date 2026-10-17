#!/usr/bin/env bash
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
install -d -m 700 /etc/realness
if [ ! -s /etc/realness/record-secret ]; then
  umask 077
  openssl rand -hex 32 > /etc/realness/record-secret
fi
chmod 600 /etc/realness/record-secret
cat /etc/realness/record-secret
