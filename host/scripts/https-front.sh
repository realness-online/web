#!/usr/bin/env bash
# https-front - public HTTPS for the browser terminal and chat.
#
#   sudo bash ~/brayness/host/scripts/https-front.sh
#
# Caddy answers on 80 and 443 for <ip>.sslip.io, gets its own certificate, and
# proxies to the host's web port on loopback. The host itself stays on
# 127.0.0.1. Until there is a real domain, sslip.io turns the address into a
# name a certificate can cover; a reserved address keeps the name stable.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

web_port="${WEB_PORT:-8090}"
ip="$(curl -sf -H 'Metadata-Flavor: Google' \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip)"
[ -n "$ip" ] || { echo "no external address" >&2; exit 1; }
name="${ip//./-}.sslip.io"

if ! command -v caddy > /dev/null; then
  apt-get install -y -q apt-transport-https curl gnupg > /dev/null
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key |
    gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q > /dev/null
  apt-get install -y -q caddy > /dev/null
fi

cat > /etc/caddy/Caddyfile << EOF
$name {
	reverse_proxy 127.0.0.1:$web_port
}
EOF
systemctl enable --now caddy > /dev/null
systemctl reload caddy
echo "https://$name"
