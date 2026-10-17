#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
. "$REPO/lib/output.sh"
RUN="${RUNS_DIR:-$OUT}/app-boot-check-$(date -u +%Y%m%dT%H%M%SZ)"
APPS="$RUN/apps"
mkdir -p "$APPS"

PASS=0
FAIL=0
ok()  { printf '  ok   %s\n' "$*"; PASS=$((PASS + 1)); }
bad() { printf '  FAIL %s\n' "$*" >&2; FAIL=$((FAIL + 1)); }

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
iptables -S INPUT | grep -q -- "-i fc-app+ -j REALNESS-APP-IN" \
  || { echo "no app rules: run 'sudo bash server/halo/scripts/net-up.sh' first" >&2; exit 1; }

for name in one two; do
  mkdir -p "$APPS/$name"
  echo "export default { fetch: () => new Response(\`$name \${process.getuid()}\`) }" > "$APPS/$name/server.js"
done
mkdir -p "$APPS/site" "$APPS/python" "$APPS/binary" "$APPS/deps"
echo "<p>site</p>" > "$APPS/site/index.html"
echo "print(1)" > "$APPS/python/main.py"
cp /bin/busybox "$APPS/binary/busybox"
echo 'import { Hono } from "hono"
export default new Hono()' > "$APPS/deps/server.js"

: > "$RUN/started"
cleanup() {
  while read -r id; do node "$REPO/server/halo/app.js" stop "$id" > /dev/null 2>&1 || true; done < "$RUN/started"
}
trap cleanup EXIT

for name in one two; do
  record="$(node "$REPO/server/halo/app.js" start "$APPS/$name" 2> "$RUN/$name.err" | tail -n 1)" || true
  if ! jq -e .id <<< "$record" > /dev/null 2>&1; then
    bad "$name: did not start ($(tail -3 "$RUN/$name.err" | tr '\n' ' '))"
    continue
  fi
  echo "$record" > "$RUN/$name.json"
  jq -r .id <<< "$record" >> "$RUN/started"
  address="$(jq -r .address <<< "$record")"
  reply="$(curl -fsS --max-time 5 "http://$address:8080/" || true)"
  if [[ "$reply" == "$name "* ]] && [ "${reply#* }" != 0 ]; then
    ok "$name answers from $address as uid ${reply#* }"
  else
    bad "$name replied '$reply' (want '$name <non-root uid>')"
  fi
done

site="$(node "$REPO/server/halo/app.js" start "$APPS/site" | tail -n 1)"
if [ "$(jq -r .kind <<< "$site")" = site ] && [ "$(jq -r '.tap // empty' <<< "$site")" = "" ]; then
  ok "site gets no VM"
else
  bad "site: $site"
fi

for name in python binary deps; do
  if node "$REPO/server/halo/app.js" start "$APPS/$name" > "$RUN/$name.out" 2>&1; then
    bad "$name started"
  elif grep -qE "fetch handler|standard library only" "$RUN/$name.out"; then
    ok "$name refused: $(grep -oE "python \(main.py\)|an executable \(busybox\)|imports 'hono'" "$RUN/$name.out" | head -1)"
  else
    bad "$name failed without a reason: $(tail -2 "$RUN/$name.out" | tr '\n' ' ')"
  fi
done

if [ "$(cat "$RUN"/one.json "$RUN"/two.json 2> /dev/null | jq -r .address | sort -u | wc -l)" = 2 ]; then
  ok "two apps, two addresses"
else
  bad "apps did not get distinct addresses"
fi

echo
echo "$PASS passed, $FAIL failed  (run: $RUN)"
[ "$FAIL" = 0 ]
