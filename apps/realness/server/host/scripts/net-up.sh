#!/usr/bin/env bash
set -euo pipefail

TAP="${TAP:-fc-tap0}"
TAP_IP="172.16.0.1/30"
TAP_PREFIX="${TAP_PREFIX:-fc-tap}"
SUBNET="${SUBNET:-172.16.0.0/16}"
TAP_MATCH="${TAP_MATCH:-${TAP_PREFIX}+}"
UPLINK="${UPLINK:-$(ip -j route list default | jq -r '.[0].dev')}"
BLOCKED="0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.168.0.0/16 198.18.0.0/15 224.0.0.0/4 240.0.0.0/4"
ACTOR_HOST_PORTS="${ACTOR_HOST_PORTS:-}"
APP_MATCH="${APP_MATCH:-fc-app+}"
APP_PORT="${APP_PORT:-8080}"
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

add_rule() {
  local table="$1"
  shift
  iptables -t "$table" -C "$@" 2> /dev/null || iptables -t "$table" -A "$@"
}
add_rule filter FORWARD -i "$UPLINK" -o "$TAP_MATCH" -d "$SUBNET" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
add_rule nat POSTROUTING -s "$SUBNET" -o "$UPLINK" -j MASQUERADE
while iptables -D FORWARD -i "$TAP_MATCH" -o "$UPLINK" -s "$SUBNET" -j ACCEPT 2> /dev/null; do :; done

chain() {
  local cmd="$1" table="$2" name="$3" parent="$4" match="${5:-$TAP_MATCH}"
  $cmd -t "$table" -N "$name" 2> /dev/null || $cmd -t "$table" -F "$name"
  $cmd -t "$table" -C "$parent" -i "$match" -j "$name" 2> /dev/null \
    || $cmd -t "$table" -I "$parent" 1 -i "$match" -j "$name"
}
chain iptables filter BRAYNESS-OUT FORWARD
iptables -A BRAYNESS-OUT -o "$TAP_MATCH" -j DROP
for range in $BLOCKED; do iptables -A BRAYNESS-OUT -d "$range" -j DROP; done
iptables -A BRAYNESS-OUT -s "$SUBNET" -o "$UPLINK" -m conntrack --ctstate NEW,ESTABLISHED,RELATED -j ACCEPT
iptables -A BRAYNESS-OUT -j DROP

chain iptables filter BRAYNESS-IN INPUT
for port in $ACTOR_HOST_PORTS; do iptables -A BRAYNESS-IN -p tcp --dport "$port" -j ACCEPT; done
iptables -A BRAYNESS-IN -j DROP

chain ip6tables filter BRAYNESS-OUT FORWARD
ip6tables -A BRAYNESS-OUT -j DROP
chain ip6tables filter BRAYNESS-IN INPUT
ip6tables -A BRAYNESS-IN -j DROP

chain iptables filter BRAYNESS-APP-OUT FORWARD "$APP_MATCH"
iptables -A BRAYNESS-APP-OUT -j DROP
chain iptables filter BRAYNESS-APP-IN INPUT "$APP_MATCH"
iptables -A BRAYNESS-APP-IN -p tcp --sport "$APP_PORT" -m conntrack --ctstate ESTABLISHED -j ACCEPT
iptables -A BRAYNESS-APP-IN -j DROP
chain ip6tables filter BRAYNESS-APP-OUT FORWARD "$APP_MATCH"
ip6tables -A BRAYNESS-APP-OUT -j DROP
chain ip6tables filter BRAYNESS-APP-IN INPUT "$APP_MATCH"
ip6tables -A BRAYNESS-APP-IN -j DROP
for cmd in iptables ip6tables; do
  $cmd -C FORWARD -o "$APP_MATCH" -j DROP 2> /dev/null || $cmd -I FORWARD 1 -o "$APP_MATCH" -j DROP
done

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

add_rule filter FORWARD -i "$UPLINK" -o "$POOL_MATCH" -d "$POOL_SUBNET" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
add_rule nat POSTROUTING -s "$POOL_SUBNET" -o "$UPLINK" -j MASQUERADE
iptables -N BRAYNESS-LEASE 2> /dev/null || true
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
