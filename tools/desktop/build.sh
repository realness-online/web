#!/usr/bin/env bash
# Builds the handed-out brayness binaries. Everything is staged into a scratch
# dir first: deno walks up from the entry looking for a package.json, and from
# inside the repo it finds brayness's own and swallows every node_modules under
# work/. The staged deno.json stops that walk.
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
out="$root/artifacts/brayness-product"
stage="$out/build"

node "$root/work/brayness/tools/control/scripts/ship-stage.js"
rm -rf "$stage"
mkdir -p "$stage"
. "$root/work/brayness/lib/output.sh"
cp -R "$OUT/ship/." "$stage/"
cp "$root/work/brayness/tools/desktop/entry.ts" "$root/work/brayness/tools/desktop/deno.json" "$stage/"

# One captured version for every target, with a static import Deno can bundle.
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
build() {  # target, output name
  echo "building $2"
  deno compile -A --target "$1" --output "$out/$2" "${includes[@]}" entry.ts
}

# deno has no universal target, so the two Mac slices are built apart and
# lipo'd into one file. One binary is the app, on both kinds of Mac.
build aarch64-apple-darwin "brayness-mac-arm64"
build x86_64-apple-darwin "brayness-mac-intel"
build x86_64-pc-windows-msvc "brayness-win.exe"

lipo -create "$out/brayness-mac-arm64" "$out/brayness-mac-intel" -output "$out/brayness-mac"
rm -f "$out/brayness-mac-arm64" "$out/brayness-mac-intel"

lipo -archs "$out/brayness-mac"
ls -lh "$out"/brayness-mac "$out"/brayness-win.exe
