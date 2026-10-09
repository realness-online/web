#!/usr/bin/env bash
# Runs inside the fc-local Lima guest (the firecracker host). Gives microVMs a
# way out: a tap on 172.16.0.0/30, NAT'd to the host's uplink.
#
#   sudo bash /mnt/fc/server/host/scripts/net-up.sh
#
# Idempotent. Dedicated chains are rebuilt on each run.
# Firecracker runs as root here, so the tap does not need a `user` owner.
set -euo pipefail

TAP="${TAP:-fc-tap0}"
TAP_IP="172.16.0.1/30"
TAP_PREFIX="${TAP_PREFIX:-fc-tap}"
# Every actor TAP owns a /30 in this range (host.py's tap_gateway); the seed
# keeps 172.16.0.0/30. One rule set covers the seed and every actor, and the
# `+` matches every TAP by name, so a new actor needs no rule of its own.
SUBNET="${SUBNET:-172.16.0.0/16}"
TAP_MATCH="${TAP_MATCH:-${TAP_PREFIX}+}"
UPLINK="${UPLINK:-$(ip -j route list default | jq -r '.[0].dev')}"
# Private, loopback, link-local (cloud metadata), shared, multicast, reserved.
BLOCKED="0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.168.0.0/16 198.18.0.0/15 224.0.0.0/4 240.0.0.0/4"
ACTOR_HOST_PORTS="${ACTOR_HOST_PORTS:-}"
# App TAPs (server/host/src/apps.js) own /30s in their own range, under their own
# prefix, so no actor rule ever matches an app and no app rule an actor.
APP_MATCH="${APP_MATCH:-fc-app+}"
APP_PORT="${APP_PORT:-8080}"
# Chrome VMs (c1) own /30s in 172.18: the open internet like an actor, and the
# host may open DevTools on $CHROME_PORT. Nothing else reaches one.
CHROME_MATCH="${CHROME_MATCH:-fc-chrome+}"
CHROME_SUBNET="${CHROME_SUBNET:-172.18.0.0/16}"
CHROME_PORT="${CHROME_PORT:-9222}"
POOL_MATCH="${POOL_MATCH:-brc+}"
POOL_SUBNET="${POOL_SUBNET:-172.19.0.0/16}"

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
add_rule filter FORWARD -i "$UPLINK" -o "$TAP_MATCH" -d "$SUBNET" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
add_rule nat POSTROUTING -s "$SUBNET" -o "$UPLINK" -j MASQUERADE
# The old blanket accept let actors reach anything; BRAYNESS-OUT replaces it.
while iptables -D FORWARD -i "$TAP_MATCH" -o "$UPLINK" -s "$SUBNET" -j ACCEPT 2> /dev/null; do :; done

# Egress: the open internet, nothing local. Guest root cannot touch these.
# Chains are flushed and rebuilt each run, so edits here apply on re-run.
chain() {  # chain <cmd> <table> <name> <parent> [match]: fresh chain, jumped to first
  local cmd="$1" table="$2" name="$3" parent="$4" match="${5:-$TAP_MATCH}"
  $cmd -t "$table" -N "$name" 2> /dev/null || $cmd -t "$table" -F "$name"
  $cmd -t "$table" -C "$parent" -i "$match" -j "$name" 2> /dev/null \
    || $cmd -t "$table" -I "$parent" 1 -i "$match" -j "$name"
}
chain iptables filter BRAYNESS-OUT FORWARD
iptables -A BRAYNESS-OUT -o "$TAP_MATCH" -j DROP  # actor to actor
for range in $BLOCKED; do iptables -A BRAYNESS-OUT -d "$range" -j DROP; done
iptables -A BRAYNESS-OUT -s "$SUBNET" -o "$UPLINK" -m conntrack --ctstate NEW,ESTABLISHED,RELATED -j ACCEPT
iptables -A BRAYNESS-OUT -j DROP

# The host itself: only named service ports (dev sync).
chain iptables filter BRAYNESS-IN INPUT
for port in $ACTOR_HOST_PORTS; do iptables -A BRAYNESS-IN -p tcp --dport "$port" -j ACCEPT; done
iptables -A BRAYNESS-IN -j DROP

# Guests have link-local IPv6 only; nothing of theirs leaves or lands over it.
chain ip6tables filter BRAYNESS-OUT FORWARD
ip6tables -A BRAYNESS-OUT -j DROP
chain ip6tables filter BRAYNESS-IN INPUT
ip6tables -A BRAYNESS-IN -j DROP

# Apps: the host may open $APP_PORT; nothing an app starts goes anywhere.
# Conntrack keys on both addresses, so a reply rule never covers another app.
chain iptables filter BRAYNESS-APP-OUT FORWARD "$APP_MATCH"
iptables -A BRAYNESS-APP-OUT -j DROP
chain iptables filter BRAYNESS-APP-IN INPUT "$APP_MATCH"
iptables -A BRAYNESS-APP-IN -p tcp --sport "$APP_PORT" -m conntrack --ctstate ESTABLISHED -j ACCEPT
iptables -A BRAYNESS-APP-IN -j DROP
chain ip6tables filter BRAYNESS-APP-OUT FORWARD "$APP_MATCH"
ip6tables -A BRAYNESS-APP-OUT -j DROP
chain ip6tables filter BRAYNESS-APP-IN INPUT "$APP_MATCH"
ip6tables -A BRAYNESS-APP-IN -j DROP
# Nothing is routed to an app; only the host itself talks to one.
for cmd in iptables ip6tables; do
  $cmd -C FORWARD -o "$APP_MATCH" -j DROP 2> /dev/null || $cmd -I FORWARD 1 -o "$APP_MATCH" -j DROP
done

# Chrome VMs: internet egress, nothing local, no Chrome to Chrome.
add_rule filter FORWARD -i "$UPLINK" -o "$CHROME_MATCH" -d "$CHROME_SUBNET" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
add_rule nat POSTROUTING -s "$CHROME_SUBNET" -o "$UPLINK" -j MASQUERADE
chain iptables filter BRAYNESS-CHROME-OUT FORWARD "$CHROME_MATCH"
iptables -A BRAYNESS-CHROME-OUT -o "$CHROME_MATCH" -j DROP
for range in $BLOCKED; do iptables -A BRAYNESS-CHROME-OUT -d "$range" -j DROP; done
iptables -A BRAYNESS-CHROME-OUT -s "$CHROME_SUBNET" -o "$UPLINK" -m conntrack --ctstate NEW,ESTABLISHED,RELATED -j ACCEPT
iptables -A BRAYNESS-CHROME-OUT -j DROP
chain iptables filter BRAYNESS-CHROME-IN INPUT "$CHROME_MATCH"
iptables -A BRAYNESS-CHROME-IN -p tcp --sport "$CHROME_PORT" -m conntrack --ctstate ESTABLISHED -j ACCEPT
iptables -A BRAYNESS-CHROME-IN -j DROP
chain ip6tables filter BRAYNESS-CHROME-OUT FORWARD "$CHROME_MATCH"
ip6tables -A BRAYNESS-CHROME-OUT -j DROP
chain ip6tables filter BRAYNESS-CHROME-IN INPUT "$CHROME_MATCH"
ip6tables -A BRAYNESS-CHROME-IN -j DROP

# Chrome pool copies (c2, chrome-pool.js): each in its own namespace behind a
# veth named brc-<n>-o at 172.19.<n>.1. Internet egress, nothing local, no
# copy to copy. BRAYNESS-LEASE, filled per lease, comes first in both the
# actor and pool chains: it opens one actor to its one copy and back.
add_rule filter FORWARD -i "$UPLINK" -o "$POOL_MATCH" -d "$POOL_SUBNET" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
add_rule nat POSTROUTING -s "$POOL_SUBNET" -o "$UPLINK" -j MASQUERADE
iptables -N BRAYNESS-LEASE 2> /dev/null || true  # never flushed here: leases outlive a re-run
iptables -C BRAYNESS-OUT -j BRAYNESS-LEASE 2> /dev/null || iptables -I BRAYNESS-OUT 1 -j BRAYNESS-LEASE
chain iptables filter BRAYNESS-POOL-OUT FORWARD "$POOL_MATCH"
iptables -A BRAYNESS-POOL-OUT -j BRAYNESS-LEASE
iptables -A BRAYNESS-POOL-OUT -o "$POOL_MATCH" -j DROP
for range in $BLOCKED; do iptables -A BRAYNESS-POOL-OUT -d "$range" -j DROP; done
iptables -A BRAYNESS-POOL-OUT -s "$POOL_SUBNET" -o "$UPLINK" -m conntrack --ctstate NEW,ESTABLISHED,RELATED -j ACCEPT
iptables -A BRAYNESS-POOL-OUT -j DROP
chain iptables filter BRAYNESS-POOL-IN INPUT "$POOL_MATCH"
iptables -A BRAYNESS-POOL-IN -p tcp --sport "$CHROME_PORT" -m conntrack --ctstate ESTABLISHED -j ACCEPT
iptables -A BRAYNESS-POOL-IN -j DROP
chain ip6tables filter BRAYNESS-POOL-OUT FORWARD "$POOL_MATCH"
ip6tables -A BRAYNESS-POOL-OUT -j DROP
chain ip6tables filter BRAYNESS-POOL-IN INPUT "$POOL_MATCH"
ip6tables -A BRAYNESS-POOL-IN -j DROP

echo "OK: $TAP ${TAP_IP} -> $UPLINK"
echo "    ip_forward=$(sysctl -n net.ipv4.ip_forward)"
echo "    egress: internet only; host ports: ${ACTOR_HOST_PORTS:-none}"
echo "    apps ($APP_MATCH): host reaches :$APP_PORT; no egress"
echo "    chrome ($CHROME_MATCH): host reaches :$CHROME_PORT; internet only"
echo "    pool ($POOL_MATCH): host reaches :$CHROME_PORT; internet only; leases in BRAYNESS-LEASE"
echo "    FORWARD policy=$(iptables -nL FORWARD | sed -n '1s/.*policy \([A-Z]*\).*/\1/p')"
