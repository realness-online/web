#!/usr/bin/env bash
# Does a downloaded copy of the binary open on this Mac?
#
#   bash apps/brayness/tools/desktop/gatekeeper-check.sh artifacts/brayness-product/brayness-mac
#
# Copies the binary into a fresh directory, zips it, unzips it elsewhere, marks
# the copy as downloaded, and runs it. This is what a stranger's double-click
# does. Gatekeeper refuses unsigned or un-notarized code at this point, so the
# check fails before d3 and must pass after it.
#
# Before d3 the run is SIGKILLed. After d3 the binary runs, and that is the
# verdict: spctl cannot judge a bare executable and reports "the code is valid
# but does not seem to be an app" even when the signature and ticket are good.
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

# flags;timestamp;agent;uuid - the shape Safari writes
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
