#!/usr/bin/env bash
# Signs the handed-out binary with the Developer ID certificate and the hardened
# runtime, which is what notarization requires.
#
#   bash work/brayness/app/sign.sh
#
# The signature covers the file, so any change to the binary needs a new sign.
# Rebuild first (app/build.sh), then sign, then notarize (app/notarize.sh).
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
app="$root/work/brayness/app"
binary="$root/artifacts/brayness-product/brayness-mac"

identity="${BRAYNESS_SIGN_IDENTITY:-}"
if [[ -z "$identity" ]]; then
  identity="$(security find-identity -v -p codesigning \
    | awk -F'"' '/Developer ID Application/{print $2; exit}')"
fi
[[ -n "$identity" ]] || { echo "no Developer ID Application identity in the keychain" >&2; exit 1; }
[[ -f "$binary" ]] || { echo "no binary at $binary - run app/build.sh first" >&2; exit 1; }

echo "identity: $identity"
codesign --force --options runtime --timestamp \
  --entitlements "$app/entitlements.plist" \
  --sign "$identity" "$binary"

codesign --verify --strict --verbose=2 "$binary" 2>&1 | tail -2
codesign -dvv "$binary" 2>&1 \
  | grep -E '^(Identifier|Authority|TeamIdentifier|Timestamp|Runtime Version|CandidateCDHash)' || true
codesign -d --entitlements - "$binary" 2>/dev/null | grep -A1 "allow-jit" | tail -1
