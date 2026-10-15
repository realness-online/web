#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
binary="$root/artifacts/realness-product/realness-mac"
out="$root/artifacts/realness-product"
zip="$out/realness-mac.zip"
profile=realness-notary
report="$out/notary-submit.json"

[[ -f "$binary" ]] || { echo "no binary at $binary - run tools/desktop/build.sh first" >&2; exit 1; }

rm -f "$zip" "$report"
(cd "$out" && zip -q -X "$(basename "$zip")" "$(basename "$binary")")
echo "zip: $zip ($(du -h "$zip" | cut -f1))"

xcrun notarytool submit "$zip" --keychain-profile "$profile" --wait \
  --output-format json | tee "$report"

read_field() { python3 -c "import json,sys;print(json.load(open('$report'))['$1'])"; }
status="$(read_field status)"
echo "status: $status"

if [[ "$status" != "Accepted" ]]; then
  echo "--- notary log ---"
  xcrun notarytool log "$(read_field id)" --keychain-profile "$profile" || true
  exit 1
fi
