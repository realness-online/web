#!/usr/bin/env bash
# Runs inside the fc-local Lima guest (the firecracker host). Gives microVMs a
# way out: a tap on 172.16.0.0/30, NAT'd to the host's uplink.
#
#   sudo bash /mnt/fc/host/scripts/net-up.sh
#
# Idempotent. Rules are appended only if absent, so re-running is a no-op.
# Firecracker runs as root here, so the tap does not need a `user` owner.
set -euo pipefail

TAP="${TAP:-fc-tap0}"
TAP_IP="172.16.0.1/30"
TAP_PREFIX="${TAP_PREFIX:-fc-tap}"
# Every session TAP owns a /30 in this range (host.py's tap_gateway); the seed
# keeps 172.16.0.0/30. One rule set covers the seed and every session, and the
# `+` matches every TAP by name, so a new session needs no rule of its own.
SUBNET="${SUBNET:-172.16.0.0/16}"
TAP_MATCH="${TAP_MATCH:-${TAP_PREFIX}+}"
UPLINK="${UPLINK:-$(ip -j route list default | jq -r '.[0].dev')}"

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
[ -n "$UPLINK" ] && [ "$UPLINK" != null ] || { echo "no default route on the host" >&2; exit 1; }

ip link show "$TAP" > /dev/null 2>&1 || ip tuntap add dev "$TAP" mode tap
ip -4 -o addr show dev "$TAP" | grep -q "${TAP_IP%/*}/" || ip addr add "$TAP_IP" dev "$TAP"
ip link set "$TAP" up
sysctl -q -w net.ipv4.ip_forward=1

# iptables-nft (Ubuntu 24.04) insists the table flag precedes the command, so
# the table is the first argument here rather than bundled into the rule.
add_rule() {  # add_rule <table> <chain> <rule...>
  local table="$1"
  shift
  iptables -t "$table" -C "$@" 2> /dev/null || iptables -t "$table" -A "$@"
}
add_rule filter FORWARD -i "$TAP_MATCH" -o "$UPLINK" -s "$SUBNET" -j ACCEPT
add_rule filter FORWARD -i "$UPLINK" -o "$TAP_MATCH" -d "$SUBNET" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
add_rule nat POSTROUTING -s "$SUBNET" -o "$UPLINK" -j MASQUERADE

echo "OK: $TAP ${TAP_IP} -> $UPLINK"
echo "    ip_forward=$(sysctl -n net.ipv4.ip_forward)"
echo "    FORWARD policy=$(iptables -nL FORWARD | sed -n '1s/.*policy \([A-Z]*\).*/\1/p')"
