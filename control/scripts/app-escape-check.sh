#!/usr/bin/env bash
# Runs inside the fc-local Lima guest. u2d's check: an app VM tries every way
# out, and each is refused. One line per probe; SECURITY.md cites them.
#
#   sudo bash /mnt/fc/control/scripts/app-escape-check.sh
#
# A live sibling app runs first, so "sibling apps" aims at a real server. The
# probe app (control/escape-probe) reports from inside; the host checks what
# only the host can see.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN="${RUNS_DIR:-$REPO/dist}/app-escape-check-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUN"

PASS=0
FAIL=0
ok()  { printf '  ok   %s\n' "$*"; PASS=$((PASS + 1)); }
bad() { printf '  FAIL %s\n' "$*" >&2; FAIL=$((FAIL + 1)); }

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
iptables -S INPUT | grep -q -- "-i fc-app+ -j BRAYNESS-APP-IN" \
  || { echo "no app rules: run 'sudo bash host/scripts/net-up.sh' first" >&2; exit 1; }

# start() runs in $(...), a subshell, so ids go to a file, not an array.
cleanup() {
  [ -f "$RUN/started" ] || return 0
  while read -r id; do node "$REPO/host/app.js" stop "$id" > /dev/null 2>&1 || true; done < "$RUN/started"
}
trap cleanup EXIT

start() {  # start <dir>: prints the record; the id is remembered for cleanup
  local record
  record="$(node "$REPO/host/app.js" start "$1" 2> "$RUN/$(basename "$1").err" | tail -n 1)"
  jq -e .id <<< "$record" > /dev/null || { echo "could not start $1: $(tail -3 "$RUN/$(basename "$1").err")" >&2; exit 1; }
  jq -r .id <<< "$record" >> "$RUN/started"
  echo "$record"
}

# ------------------------------------------------------------------ the apps
mkdir -p "$RUN/sibling/www"
cp /bin/busybox "$RUN/sibling/busybox"
echo sibling > "$RUN/sibling/www/index.html"
echo "web: ./busybox httpd -f -p 8080 -h www" > "$RUN/sibling/Procfile"
sibling="$(start "$RUN/sibling")"

# The host's live listeners and addresses, for the probe to aim at. Not the app
# TAPs, and not loopback: inside the VM 127.0.0.1 is the app's own.
mkdir -p "$RUN/probe"
cp "$REPO/control/escape-probe/main.py" "$RUN/probe/"
ports="$(ss -ltnH | awk '{print $4}' | sed 's/.*://' | sort -un | jq -R 'tonumber' | jq -s .)"
addresses="$(ip -4 -o addr show | awk '$2 !~ /^(fc-app|lo$)/ {split($4, a, "/"); print a[1]}' | jq -R . | jq -s .)"
# Internet targets the host itself reaches, so a refusal is the app's rules.
internet="$(getent ahostsv4 example.com | awk '{print $1}' | sort -u | jq -R . | jq -s .)"
jq -n --argjson p "$ports" --argjson a "$addresses" --argjson i "$internet" '{host_ports: $p, host_addresses: $a, internet: $i}' > "$RUN/probe/targets.json"
probe="$(start "$RUN/probe")"
address="$(jq -r .address <<< "$probe")"
tap="$(jq -r .tap <<< "$probe")"

# CONTROL=1 opens the probe's own TAP, and only it, to show each probe can see
# a hole: the network probes must then fail. Each layer is lifted. Other apps keep the strict rules.
if [ "${CONTROL:-0}" = 1 ]; then
  iptables -I BRAYNESS-APP-IN 1 -i "$tap" -j ACCEPT
  iptables -I BRAYNESS-APP-OUT 1 -i "$tap" -j ACCEPT
  # Egress has a second layer: no NAT for 172.17, and nothing routed back in.
  iptables -I FORWARD 1 -o "$tap" -j ACCEPT
  iptables -t nat -I POSTROUTING 1 -s "$address" -j MASQUERADE
  unopen() {
    iptables -D FORWARD -o "$tap" -j ACCEPT 2> /dev/null || true
    iptables -t nat -D POSTROUTING -s "$address" -j MASQUERADE 2> /dev/null || true
    iptables -D BRAYNESS-APP-IN -i "$tap" -j ACCEPT 2> /dev/null || true
    iptables -D BRAYNESS-APP-OUT -i "$tap" -j ACCEPT 2> /dev/null || true
    cleanup
  }
  trap unopen EXIT
fi

# Sanity first: a refusal only means something if the sibling is really up.
[ "$(curl -fsS --max-time 5 "http://$(jq -r .address <<< "$sibling"):8080/")" = sibling ] \
  && ok "control: host reaches the sibling on 8080" || bad "control: sibling not reachable from host"

# -------------------------------------------------------------- from inside
if curl -fsS --max-time 180 "http://$address:8080/probe" > "$RUN/probe.json"; then
  while IFS=$'\t' read -r name refused detail; do
    if [ "$refused" = true ]; then ok "$name ($detail)"; else bad "$name: $detail"; fi
  done < <(jq -r 'to_entries[] | [.key, (.value.refused | tostring), .value.detail[:100]] | @tsv' "$RUN/probe.json")
else
  bad "probe app did not report"
fi

# -------------------------------------------------------------- from outside
# The probe listens on 8081 too; the host must not get its reply.
if curl -sS --max-time 3 "http://$address:8081/" > /dev/null 2>&1; then
  bad "host reached the app's side port 8081"
else
  ok "only 8080: the app's side port 8081 is unreachable"
fi
# An actor cannot reach an app: actor egress drops all of 172.16.0.0/12.
if iptables -C BRAYNESS-OUT -d 172.16.0.0/12 -j DROP 2> /dev/null; then
  ok "actor to app dropped (BRAYNESS-OUT -d 172.16.0.0/12)"
else
  bad "no actor rule covering 172.17"
fi
# The app's refusals must be ours: each drop rule counted packets.
dropped="$(iptables -nvxL BRAYNESS-APP-OUT | awk '$3 == "DROP" {print $1}')"
[ "${dropped:-0}" -gt 0 ] && ok "BRAYNESS-APP-OUT dropped $dropped packets" || bad "BRAYNESS-APP-OUT dropped nothing"

echo
echo "$PASS passed, $FAIL failed  (run: $RUN)"
[ "$FAIL" = 0 ]
