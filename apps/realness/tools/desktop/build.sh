#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
out="$root/artifacts/realness-product"
stage="$out/build"

node "$root/apps/realness/tools/control/scripts/ship-stage.js" --env "${1:?usage: build.sh development|production}"
rm -rf "$stage"
mkdir -p "$stage"
. "$root/apps/realness/lib/output.sh"
cp -R "$OUT/ship/." "$stage/"
cp "$root/apps/realness/tools/desktop/entry.ts" "$root/apps/realness/tools/desktop/deno.json" "$stage/"

pi_version="$(<"$stage/.pi-version")"
[[ "$pi_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]] || {
  echo "invalid staged pi version: $pi_version" >&2
  exit 1
}
sed -i '' "s|__PI_VERSION__|$pi_version|" "$stage/entry.ts"
grep -Fq "npm:@earendil-works/pi-coding-agent@$pi_version" "$stage/entry.ts"

includes=()
for part in skills extensions prompts themes work AGENTS.md; do
  [[ -e "$stage/$part" ]] && includes+=(--include "$part")
done

cd "$stage"
build() {
  echo "building $2"
  deno compile -A --target "$1" --output "$out/$2" "${includes[@]}" entry.ts
}

build aarch64-apple-darwin "realness-mac-arm64"
build x86_64-apple-darwin "realness-mac-intel"
build x86_64-pc-windows-msvc "realness-win.exe"

lipo -create "$out/realness-mac-arm64" "$out/realness-mac-intel" -output "$out/realness-mac"
rm -f "$out/realness-mac-arm64" "$out/realness-mac-intel"

lipo -archs "$out/realness-mac"
ls -lh "$out"/realness-mac "$out"/realness-win.exe
