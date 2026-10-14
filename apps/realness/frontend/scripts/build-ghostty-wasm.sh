#!/bin/sh
set -eu

GHOSTTY_COMMIT=4ae9f1a2de
ZIG_URL=https://ziglang.org/download/0.16.0/zig-aarch64-macos-0.16.0.tar.xz
ZIG_SHA256=b23d70deaa879b5c2d486ed3316f7eaa53e84acf6fc9cc747de152450d401489

project=$(cd "$(dirname "$0")/../.." && pwd)
output="$project/src/app/terminal/ghostty-vt.wasm"
cache="$(node "$project/src/settings/cli.js" output --root "$project")/ghostty"
mkdir -p "$cache"

if [ ! -x "$cache/zig/zig" ]; then
  curl -fL "$ZIG_URL" -o "$cache/zig.tar.xz"
  echo "$ZIG_SHA256  $cache/zig.tar.xz" | shasum -a 256 -c -
  mkdir -p "$cache/zig"
  tar -xJf "$cache/zig.tar.xz" -C "$cache/zig" --strip-components 1
fi

if [ ! -d "$cache/ghostty" ]; then
  git clone https://github.com/ghostty-org/ghostty.git "$cache/ghostty"
fi
git -C "$cache/ghostty" fetch --quiet origin
git -C "$cache/ghostty" checkout --quiet "$GHOSTTY_COMMIT"

cd "$cache/ghostty"
"$cache/zig/zig" build -Demit-lib-vt -Dtarget=wasm32-freestanding -Doptimize=ReleaseFast
cp zig-out/bin/ghostty-vt.wasm "$output"
echo "wrote $output"
