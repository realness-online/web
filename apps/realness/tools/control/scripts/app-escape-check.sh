#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
. "$REPO/lib/output.sh"
RUN="${RUNS_DIR:-$OUT}/app-escape-check-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUN"

PASS=0
FAIL=0
ok()  { printf '  ok   %s\n' "$*"; PASS=$((PASS + 1)); }
bad() { printf '  FAIL %s\n' "$*" >&2; FAIL=$((FAIL + 1)); }

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
iptables -S INPUT | grep -q -- "-i fc-app+ -j BRAYNESS-APP-IN" \
  || { echo "no app rules: run 'sudo bash server/host/scripts/net-up.sh' first" >&2; exit 1; }

cleanup() {
  [ -f "$RUN/started" ] || return 0
  while read -r id; do node "$REPO/server/host/app.js" stop "$id" > /dev/null 2>&1 || true; done < "$RUN/started"
}
trap cleanup EXIT

start() {
  local record
  record="$(node "$REPO/server/host/app.js" start "$1" 2> "$RUN/$(basename "$1").err" | tail -n 1)"
  jq -e .id <<< "$record" > /dev/null || { echo "could not start $1: $(tail -3 "$RUN/$(basename "$1").err")" >&2; exit 1; }
  jq -r .id <<< "$record" >> "$RUN/started"
  echo "$record"
}

mkdir -p "$RUN/sibling"
echo 'export default { fetch: () => new Response("sibling") }' > "$RUN/sibling/server.js"
sibling="$(start "$RUN/sibling")"

mkdir -p "$RUN/probe"
cp "$REPO/tools/control/escape-probe/server.js" "$RUN/probe/"
ports="$(ss -ltnH | awk '{print $4}' | sed 's/.*://' | sort -un | jq -R 'tonumber' | jq -s .)"
addresses="$(ip -4 -o addr show | awk '$2 !~ /^(fc-app|lo$)/ {split($4, a, "/"); print a[1]}' | jq -R . | jq -s .)"
internet="$(getent ahostsv4 example.com | awk '{print $1}' | sort -u | jq -R . | jq -s .)"
jq -n --argjson p "$ports" --argjson a "$addresses" --argjson i "$internet" '{host_ports: $p, host_addresses: $a, internet: $i}' > "$RUN/probe/targets.json"
probe="$(start "$RUN/probe")"
address="$(jq -r .address <<< "$probe")"
tap="$(jq -r .tap <<< "$probe")"

if [ "${CONTROL:-0}" = 1 ]; then
  iptables -I BRAYNESS-APP-IN 1 -i "$tap" -j ACCEPT
  iptables -I BRAYNESS-APP-OUT 1 -i "$tap" -j ACCEPT
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

[ "$(curl -fsS --max-time 5 "http://$(jq -r .address <<< "$sibling"):8080/")" = sibling ] \
  && ok "control: host reaches the sibling on 8080" || bad "control: sibling not reachable from host"

if curl -fsS --max-time 180 "http://$address:8080/probe" > "$RUN/probe.json"; then
  while IFS=$'\t' read -r name refused detail; do
    if [ "$refused" = true ]; then ok "$name ($detail)"; else bad "$name: $detail"; fi
  done < <(jq -r 'to_entries[] | [.key, (.value.refused | tostring), .value.detail[:100]] | @tsv' "$RUN/probe.json")
else
  bad "probe app did not report"
fi

if curl -sS --max-time 3 "http://$address:8081/" > /dev/null 2>&1; then
  bad "host reached the app's side port 8081"
else
  ok "only 8080: the app's side port 8081 is unreachable"
fi
sock="/opt/fc/actors/mnt/apps/$(jq -r .id <<< "$probe")/api.sock"
config="$(curl -sS --unix-socket "$sock" http://fc/vm/config)"
echo "$config" > "$RUN/vm-config.json"
[ "$(jq -r '.vsock // "none"' <<< "$config")" = none ] && ok "no vsock device (Firecracker vm/config)" || bad "vsock device attached"
drives="$(jq -r '[.drives[] | "\(.drive_id):\(.is_read_only)"] | sort | join(" ")' <<< "$config")"
[ "$drives" = "code:true rootfs:false runtime:true" ] && ok "three drives; code and runtime read-only ($drives)" || bad "drives: $drives"
[ "$(jq -r '.["machine-config"].mem_size_mib' <<< "$config")" = "$(jq -r .mib <<< "$probe")" ] \
  && ok "memory cap applied: $(jq -r .mib <<< "$probe") MiB" || bad "memory cap not applied"
if iptables -C BRAYNESS-OUT -d 172.16.0.0/12 -j DROP 2> /dev/null; then
  ok "actor to app dropped (BRAYNESS-OUT -d 172.16.0.0/12)"
else
  bad "no actor rule covering 172.17"
fi
dropped="$(iptables -nvxL BRAYNESS-APP-OUT | awk '$3 == "DROP" {print $1}')"
[ "${dropped:-0}" -gt 0 ] && ok "BRAYNESS-APP-OUT dropped $dropped packets" || bad "BRAYNESS-APP-OUT dropped nothing"

echo
echo "$PASS passed, $FAIL failed  (run: $RUN)"
[ "$FAIL" = 0 ]
