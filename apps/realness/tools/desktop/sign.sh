#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
app="$root/apps/realness/tools/desktop"
binary="$root/artifacts/realness-product/realness-mac"

identity="$(security find-identity -v -p codesigning \
  | awk -F'"' '/Developer ID Application/{print $2; exit}')"
[[ -n "$identity" ]] || { echo "no Developer ID Application identity in the keychain" >&2; exit 1; }
[[ -f "$binary" ]] || { echo "no binary at $binary - run tools/desktop/build.sh first" >&2; exit 1; }

echo "identity: $identity"
codesign --force --options runtime --timestamp \
  --entitlements "$app/entitlements.plist" \
  --sign "$identity" "$binary"

codesign --verify --strict --verbose=2 "$binary" 2>&1 | tail -2
codesign -dvv "$binary" 2>&1 \
  | grep -E '^(Identifier|Authority|TeamIdentifier|Timestamp|Runtime Version|CandidateCDHash)' || true
codesign -d --entitlements - "$binary" 2>/dev/null | grep -A1 "allow-jit" | tail -1
