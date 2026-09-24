#!/usr/bin/env bash
# Runs inside the fc-local Lima guest. Undoes net-up.sh.
#
#   sudo bash /mnt/fc/orchestrator/scripts/net-down.sh
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

ip link delete "$TAP" 2> /dev/null || true
echo "OK: $TAP removed, rules dropped (ip_forward left at $(sysctl -n net.ipv4.ip_forward))"
