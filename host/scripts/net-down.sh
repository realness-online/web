#!/usr/bin/env bash
# Runs inside the fc-local Lima guest. Undoes net-up.sh.
#
#   sudo bash /mnt/fc/host/scripts/net-down.sh
set -euo pipefail

TAP="${TAP:-fc-tap0}"
TAP_PREFIX="${TAP_PREFIX:-fc-tap}"
SUBNET="${SUBNET:-172.16.0.0/16}"
TAP_MATCH="${TAP_MATCH:-${TAP_PREFIX}+}"
UPLINK="${UPLINK:-$(ip -j route list default | jq -r '.[0].dev')}"

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

del_rule() {  # del_rule <table> <chain> <rule...>
  local table="$1"
  shift
  iptables -t "$table" -C "$@" 2> /dev/null && iptables -t "$table" -D "$@" || true
}
del_rule filter FORWARD -i "$TAP_MATCH" -o "$UPLINK" -s "$SUBNET" -j ACCEPT
del_rule filter FORWARD -i "$UPLINK" -o "$TAP_MATCH" -d "$SUBNET" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
del_rule nat POSTROUTING -s "$SUBNET" -o "$UPLINK" -j MASQUERADE
for cmd in iptables ip6tables; do
  for pair in FORWARD:BRAYNESS-OUT INPUT:BRAYNESS-IN; do
    $cmd -D "${pair%%:*}" -i "$TAP_MATCH" -j "${pair#*:}" 2> /dev/null || true
    $cmd -F "${pair#*:}" 2> /dev/null && $cmd -X "${pair#*:}" || true
  done
done

ip link delete "$TAP" 2> /dev/null || true
echo "OK: $TAP removed, rules dropped (ip_forward left at $(sysctl -n net.ipv4.ip_forward))"
