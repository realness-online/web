#!/usr/bin/env bash
# Zips the signed binary, submits it to Apple's notary service, and waits.
#
#   bash work/brayness/tools/desktop/notarize.sh
#
# The credentials profile is made once, by hand:
#
#   xcrun notarytool store-credentials brayness-notary \
#     --apple-id "<apple id>" --team-id FHE652UPZG --password "<app-specific password>"
#
# The returned ticket cannot be stapled to a bare executable, so the zip is the
# thing that ships and the first launch needs internet.
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
binary="$root/artifacts/brayness-product/brayness-mac"
out="$root/artifacts/brayness-product"
zip="$out/brayness-mac.zip"
profile="${BRAYNESS_NOTARY_PROFILE:-brayness-notary}"
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
