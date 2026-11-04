. "$(dirname "${BASH_SOURCE[0]}")/output.sh"

check_start() {
  RUN="${RUNS_DIR:-$OUT}/$1-$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$RUN"
  PASS=0
  FAIL=0
}

ok() { printf '  ok   %s\n' "$*"; PASS=$((PASS + 1)); }
bad() { printf '  FAIL %s\n' "$*" >&2; FAIL=$((FAIL + 1)); }

check_end() {
  echo "$PASS passed, $FAIL failed  (${1:-run: $RUN})"
  [ "$FAIL" = 0 ]
}
