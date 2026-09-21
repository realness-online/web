#!/usr/bin/env bash
# Builds the handed-out brayness binaries. Everything is staged into a scratch
# dir first: deno walks up from the entry looking for a package.json, and from
# inside the repo it finds brayness's own and swallows every node_modules under
# work/. The staged deno.json stops that walk.
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
out="$root/artifacts/brayness-product"
stage="$out/build"

rm -rf "$stage"
mkdir -p "$stage"

cp "$root/work/brayness/app/entry.ts" "$root/work/brayness/app/deno.json" "$stage/"
cp "$root/AGENTS.md" "$stage/"
for part in skills extensions prompts themes; do
  [[ -d "$root/$part" ]] && cp -R "$root/$part" "$stage/"
done

includes=()
for part in skills extensions prompts themes AGENTS.md; do
  [[ -e "$stage/$part" ]] && includes+=(--include "$part")
done

cd "$stage"
for target in aarch64-apple-darwin:brayness-mac x86_64-pc-windows-msvc:brayness-win; do
  echo "building ${target#*:}"
  deno compile -A --target "${target%%:*}" --output "$out/${target#*:}" \
    "${includes[@]}" entry.ts
done

ls -lh "$out"/brayness-mac "$out"/brayness-win.exe
