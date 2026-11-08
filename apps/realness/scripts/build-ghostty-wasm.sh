#!/bin/sh
set -eu

GHOSTTY_COMMIT=vt-1.0.0
ZIG_URL=https://ziglang.org/download/0.17.0/zig-aarch64-macos-0.17.0.tar.xz
ZIG_SHA256=b607e9b9234790a008116ae5bdb71c6243b84b9fb42a53a9e70fde41c06c536a

project=$(cd "$(dirname "$0")/.." && pwd)
output="$project/src/app/terminal/ghostty-vt.wasm"
cache="$(node "$project/src/settings/cli.js" output --root "$project")/ghostty"
zig="$cache/$(basename "$ZIG_URL" .tar.xz)"
mkdir -p "$cache"

if [ ! -x "$zig/zig" ]; then
  curl -fL "$ZIG_URL" -o "$zig.tar.xz"
  echo "$ZIG_SHA256  $zig.tar.xz" | shasum -a 256 -c -
  mkdir -p "$zig"
  tar -xJf "$zig.tar.xz" -C "$zig" --strip-components 1
  rm -f "$zig.tar.xz"
fi

if [ ! -d "$cache/ghostty" ]; then
  git clone https://github.com/ghostty-org/ghostty.git "$cache/ghostty"
fi
git -C "$cache/ghostty" fetch --quiet origin
git -C "$cache/ghostty" checkout --quiet "$GHOSTTY_COMMIT"

cd "$cache/ghostty"
"$zig/zig" build -Demit-lib-vt -Dtarget=wasm32-freestanding -Doptimize=ReleaseFast -Dstrip=true
cp zig-out/bin/ghostty-vt.wasm "$output"
echo "wrote $output"
