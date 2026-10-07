#!/bin/sh
# Rebuild public/ghostty-vt.wasm from pinned sources. The wasm is committed, so
# this runs only when a pin moves. Ghostty's libghostty-vt API is unstable: a
# bump means re-reading src/ghostty-vt.js against the new wasm.h.
#
# Pins: Ghostty 4ae9f1a2de, Zig 0.16.0 (aarch64-macos tarball, by checksum).
set -eu

GHOSTTY_COMMIT=4ae9f1a2de
ZIG_URL=https://ziglang.org/download/0.16.0/zig-aarch64-macos-0.16.0.tar.xz
ZIG_SHA256=b23d70deaa879b5c2d486ed3316f7eaa53e84acf6fc9cc747de152450d401489

here=$(cd "$(dirname "$0")" && pwd)
cache="$here/.cache"
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
cp zig-out/bin/ghostty-vt.wasm "$here/public/ghostty-vt.wasm"
echo "wrote public/ghostty-vt.wasm"
