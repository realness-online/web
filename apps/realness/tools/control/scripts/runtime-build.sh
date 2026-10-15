#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-/opt/fc}"
OUT="${OUT:-$ROOT/runtimes}"

case "$(uname -m)" in
  x86_64) NODE_ARCH=x64 ;;
  aarch64 | arm64) NODE_ARCH=arm64 ;;
  *) echo "unsupported arch $(uname -m)" >&2; exit 1 ;;
esac

NODE_VERSION="v24.21.0"
NODE="node-$NODE_VERSION-linux-$NODE_ARCH.tar.xz"
NODE_URL="https://nodejs.org/dist/$NODE_VERSION"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
log() { printf '\n==> %s\n' "$*"; }
mkdir -p "$OUT"

fetch() {
  [ -f "$ROOT/$2" ] && return 0
  log "$2"
  curl -fsSL -o "$ROOT/$2" "$1/${2//+/%2B}"
}

fetch "$NODE_URL" "$NODE"
(cd "$ROOT" && curl -fsSL "$NODE_URL/SHASUMS256.txt" | grep " $NODE\$" | sha256sum -c -)

disk() {
  local name="$1" tree="$2" img="$OUT/$1.ext4" kib
  kib=$(du -sk "$tree" | cut -f1)
  rm -f "$img.new"
  truncate -s "$(( (kib * 5 / 4 + 16384) * 1024 ))" "$img.new"
  mkfs.ext4 -q -F -L "rt-$name" -d "$tree" "$img.new"
  e2fsck -fn "$img.new" > /dev/null && mv "$img.new" "$img"
  printf '  %s: tree %s, image %s\n' "$img" "$(du -sh "$tree" | cut -f1)" "$(du -h --apparent-size "$img" | cut -f1)"
}

work="$(mktemp -d "$ROOT/runtime-tree.XXXXXX")"
trap 'rm -rf "$work"' EXIT

log "node $NODE_VERSION"
mkdir -p "$work/node"
tar xJf "$ROOT/$NODE" -C "$work/node" --strip-components=1
rm -rf "$work/node/lib/node_modules/npm" "$work/node/lib/node_modules/corepack" \
  "$work/node/bin/npm" "$work/node/bin/npx" "$work/node/bin/corepack" \
  "$work/node/include" "$work/node/share"
"$work/node/bin/node" --version
install -D -m 0644 "$REPO/server/host/guest/realness-serve.js" "$work/node/realness/serve.js"
"$work/node/bin/node" --check "$work/node/realness/serve.js"
disk node "$work/node"

rm -f "$OUT/python.ext4"

log "done"
ls -lh "$OUT"
