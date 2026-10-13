#!/usr/bin/env bash
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
install -d -m 700 /etc/brayness
if [ ! -s /etc/brayness/record-secret ]; then
  umask 077
  openssl rand -hex 32 > /etc/brayness/record-secret
fi
chmod 600 /etc/brayness/record-secret
cat /etc/brayness/record-secret
