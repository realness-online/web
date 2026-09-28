#!/usr/bin/env bash
# Runs inside the fc-local Lima guest. u2c's check: a node app, a python app,
# and a static binary each boot in their own VM and answer HTTP on 8080 from
# their own address; a plain site gets no VM.
#
#   sudo bash /mnt/fc/control/scripts/app-boot-check.sh
#
# Needs net-up.sh (for the fc-app rules), app-image-build.sh, runtime-build.sh.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN="${RUNS_DIR:-$REPO/dist}/app-boot-check-$(date -u +%Y%m%dT%H%M%SZ)"
APPS="$RUN/apps"
mkdir -p "$APPS"

PASS=0
FAIL=0
ok()  { printf '  ok   %s\n' "$*"; PASS=$((PASS + 1)); }
bad() { printf '  FAIL %s\n' "$*" >&2; FAIL=$((FAIL + 1)); }

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
iptables -S INPUT | grep -q -- "-i fc-app+ -j BRAYNESS-APP-IN" \
  || { echo "no app rules: run 'sudo bash host/scripts/net-up.sh' first" >&2; exit 1; }

# ------------------------------------------------------------------ fixtures
# Each answers with its own name, so a reply cannot come from the wrong VM.
mkdir -p "$APPS/node" "$APPS/python" "$APPS/binary/www" "$APPS/site"
cat > "$APPS/node/server.js" <<'JS'
require("node:http").createServer((_, res) => res.end(`node ${process.getuid()}\n`)).listen(process.env.PORT)
JS
echo '{"name": "check"}' > "$APPS/node/package.json"
cat > "$APPS/python/main.py" <<'PY'
import http.server, os
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.end_headers(); self.wfile.write(f"python {os.getuid()}\n".encode())
http.server.HTTPServer(("", int(os.environ["PORT"])), H).serve_forever()
PY
cp /bin/busybox "$APPS/binary/busybox"
echo "binary" > "$APPS/binary/www/index.html"
echo "web: ./busybox httpd -f -p 8080 -h www" > "$APPS/binary/Procfile"
echo "<p>site</p>" > "$APPS/site/index.html"

# -------------------------------------------------------------------- checks
started=()
cleanup() {
  for id in "${started[@]}"; do node "$REPO/host/app.js" stop "$id" > /dev/null 2>&1 || true; done
}
trap cleanup EXIT

for name in node python binary; do
  if ! record="$(node "$REPO/host/app.js" start "$APPS/$name" 2> "$RUN/$name.err" | tail -n 1)" || ! jq -e .id <<< "$record" > /dev/null 2>&1; then
    bad "$name: did not start ($(tail -3 "$RUN/$name.err" | tr '\n' ' '))"
    continue
  fi
  echo "$record" > "$RUN/$name.json"
  id="$(jq -r .id <<< "$record")"
  address="$(jq -r .address <<< "$record")"
  started+=("$id")
  reply="$(curl -fsS --max-time 5 "http://$address:8080/" || true)"
  case "$name" in
    binary) [ "$reply" = binary ] && ok "binary answers from $address" || bad "binary replied '$reply'" ;;
    *) if [[ "$reply" == "$name "* ]] && [ "${reply#* }" != 0 ]; then
         ok "$name answers from $address as uid ${reply#* }"
       else
         bad "$name replied '$reply' (want '$name <non-root uid>')"
       fi ;;
  esac
done

site="$(node "$REPO/host/app.js" start "$APPS/site" | tail -n 1)"
if [ "$(jq -r .kind <<< "$site")" = site ] && [ "$(jq -r '.tap // empty' <<< "$site")" = "" ]; then
  ok "site gets no VM"
else
  bad "site: $site"
fi

# Distinct addresses, each on its own TAP.
if [ "${#started[@]}" = 3 ] && [ "$(cat "$RUN"/*.json | jq -r .address | sort -u | wc -l)" = 3 ]; then
  ok "three apps, three addresses"
else
  bad "apps did not get distinct addresses"
fi

echo
echo "$PASS passed, $FAIL failed  (run: $RUN)"
[ "$FAIL" = 0 ]
