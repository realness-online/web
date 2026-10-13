#!/usr/bin/env bash
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
. "$REPO/lib/output.sh"
RUN="${RUNS_DIR:-$OUT}/app-check-$(date -u +%Y%m%dT%H%M%SZ)"
export RUNS_DIR="$RUN"
mkdir -p "$RUN"
S="$REPO/tools/control/scripts"

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

PASS=0
FAIL=0
step() {
  local name="$1" want="$2"
  shift 2
  "$@" > "$RUN/$name.log" 2>&1
  local code=$?
  if { [ "$want" = 0 ] && [ "$code" = 0 ]; } || { [ "$want" = fail ] && [ "$code" != 0 ]; }; then
    printf '  ok   %-16s %s\n' "$name" "$(tail -n 1 "$RUN/$name.log")"
    PASS=$((PASS + 1))
  else
    printf '  FAIL %-16s exit %s, see %s\n' "$name" "$code" "$RUN/$name.log" >&2
    FAIL=$((FAIL + 1))
  fi
}

step image-build   0    bash "$S/app-image-build.sh"
step runtime-build 0    bash "$S/runtime-build.sh"
step net-up        0    bash "$REPO/server/host/scripts/net-up.sh"
step image-verify  0    bash "$S/app-image-verify.sh"
step boot          0    bash "$S/app-boot-check.sh"
step escape        0    bash "$S/app-escape-check.sh"
step escape-ctrl   fail env CONTROL=1 bash "$S/app-escape-check.sh"
if [ "$(uname -m)" = x86_64 ]; then mibs="96 80 72 64" must="96"; else mibs="96 64" must="96 64"; fi
step floor         0    env MIBS="$mibs" bash "$S/app-memory-floor.sh"
step floor-holds   0    sh -c "for m in $must; do awk -F'\t' -v m=\$m '\$2 == m && \$3 == \"ok\"' $RUN/app-memory-floor-*/floor.tsv | grep -q . || exit 1; done; echo '$must MiB serve; floor:' \$(awk -F'\t' '\$3 == \"ok\" {print \$2}' $RUN/app-memory-floor-*/floor.tsv | sort -n | head -1)"
for check in "$REPO"/host/checks/app-*.check.js; do
  step "$(basename "$check" .check.js)" 0 node "$check"
done

echo
echo "$PASS passed, $FAIL failed  (run: $RUN)"
[ "$FAIL" = 0 ]
