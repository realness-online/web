#!/usr/bin/env bash
set -uo pipefail

src="${1:?usage: gatekeeper-check.sh <binary>}"
src="$(cd "$(dirname "$src")" && pwd)/$(basename "$src")"
name="$(basename "$src")"
root="$(cd "$(dirname "$0")/../../.." && pwd)"
work="$root/artifacts/brayness-signing/downloads/$name"

rm -rf "$work"
mkdir -p "$work/sent" "$work/landed"

cp "$src" "$work/sent/$name"
(cd "$work/sent" && zip -q -r "../$name.zip" "$name")
(cd "$work/landed" && unzip -q "../$name.zip")

xattr -w com.apple.quarantine "0083;$(printf '%x' "$(date +%s)");Safari;$(uuidgen)" \
  "$work/landed/$name"

echo "== $name"
echo "quarantine: $(xattr -p com.apple.quarantine "$work/landed/$name" 2>/dev/null || echo none)"
echo "signature:  $(codesign -dv "$work/landed/$name" 2>&1 | grep -E '^(Signature|Authority=)' | tr '\n' ' ')"
echo "spctl:      $(spctl -a -t exec -vv "$work/landed/$name" 2>&1 | head -1)"

out="$(cd "$work/landed" && perl -e 'alarm 25; exec @ARGV' -- "./$name" --version 2>&1)"
code=$?
echo "run:        exit $code"
echo "$out" | head -3

if [ "$code" -eq 0 ]; then
  echo "PASS: opened with no dialog"
else
  echo "FAIL: macOS refused it"
fi
