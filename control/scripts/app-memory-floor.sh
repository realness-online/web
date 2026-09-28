#!/usr/bin/env bash
# Runs inside the fc-local Lima guest. u2e: the smallest memory each kind of
# app boots and serves in. For node, python, and a static binary, boot at each
# size from MIBS, send REQUESTS requests, and record whether it answered, what
# the guest had left (MemAvailable), and whether the serial log shows an OOM.
#
#   sudo bash /mnt/fc/control/scripts/app-memory-floor.sh
#   sudo MIBS="64 48" bash /mnt/fc/control/scripts/app-memory-floor.sh
#
# Writes $RUN/floor.tsv. The cap in host/src/apps.js should sit above the
# largest floor, with the headroom the table shows.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN="${RUNS_DIR:-$REPO/dist}/app-memory-floor-$(date -u +%Y%m%dT%H%M%SZ)"
MIBS="${MIBS:-128 96 64 48 40 32 24}"
REQUESTS="${REQUESTS:-50}"
APPS="$RUN/apps"
mkdir -p "$APPS/node" "$APPS/python" "$APPS/binary/www"

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

# Each app answers with the guest's MemAvailable in KiB.
cat > "$APPS/node/server.js" <<'JS'
const fs = require("node:fs")
require("node:http").createServer((_, res) => res.end(`${/MemAvailable:\s+(\d+)/.exec(fs.readFileSync("/proc/meminfo", "utf8"))[1]}\n`)).listen(process.env.PORT)
JS
echo '{"name": "floor"}' > "$APPS/node/package.json"
cat > "$APPS/python/main.py" <<'PY'
import http.server, os, re
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        kib = re.search(r"MemAvailable:\s+(\d+)", open("/proc/meminfo").read()).group(1)
        self.send_response(200); self.end_headers(); self.wfile.write(f"{kib}\n".encode())
    def log_message(self, *a): pass
http.server.HTTPServer(("", int(os.environ["PORT"])), H).serve_forever()
PY
# busybox httpd serves a file, so MemAvailable is not in its reply; the answer
# alone is the measure.
cp /bin/busybox "$APPS/binary/busybox"
echo ok > "$APPS/binary/www/index.html"
echo "web: ./busybox httpd -f -p 8080 -h www" > "$APPS/binary/Procfile"

# One boot at one size: prints "ok <MemAvailable or ->" or "fail <reason>".
measure() {  # measure <dir> <mib>
  node --input-type=module -e '
    import { AppStore } from "'"$REPO"'/host/src/apps.js"
    const [dir, mib, requests] = process.argv.slice(1)
    const store = new AppStore({ volume: "/opt/fc/actors/mnt", kernel: "/opt/fc/vmlinux-6.1.155", firecracker: "/opt/fc/firecracker", mib: Number(mib), bootTimeout: 45 })
    let record
    try {
      record = await store.start(dir)
    } catch (error) {
      console.error(error.message)
      console.log(`fail ${/out of memory|oom/i.test(error.message) ? "oom" : "boot"}`)
      process.exit(0)
    }
    let last = "-"
    try {
      for (let i = 0; i < Number(requests); i++) {
        const reply = await fetch(`http://${record.address}:8080/`, { signal: AbortSignal.timeout(5000) })
        const text = (await reply.text()).trim()
        if (/^\d+$/.test(text)) last = text
      }
      console.log(`ok ${last}`)
    } catch (error) {
      console.log(`fail serve`)
    } finally {
      await store.stop(record.id)
    }
    process.exit(0)
  ' "$1" "$2" "$REQUESTS" 2> "$RUN/$(basename "$1")-$2.err" | tail -n 1
}

printf 'kind\tmib\tresult\tmem_available_kib\n' > "$RUN/floor.tsv"
for kind in node python binary; do
  for mib in $MIBS; do
    read -r result avail <<< "$(measure "$APPS/$kind" "$mib")"
    printf '%s\t%s\t%s\t%s\n' "$kind" "$mib" "$result" "${avail:--}" | tee -a "$RUN/floor.tsv"
    [ "$result" = ok ] || break  # below the floor; smaller will not do better
  done
done

echo
echo "floor per kind (smallest ok):"
awk -F'\t' 'NR > 1 && $3 == "ok" {floor[$1] = $2} END {for (k in floor) print "  " k ": " floor[k] " MiB"}' "$RUN/floor.tsv"
echo "run: $RUN"
