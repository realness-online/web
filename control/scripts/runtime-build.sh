#!/usr/bin/env bash
# Runs where the microVM runs. Builds one read-only disk per language runtime:
#
#   /opt/fc/runtimes/node.ext4     node, npm's CLI removed
#   /opt/fc/runtimes/python.ext4   cpython, relocatable (python-build-standalone)
#
#   sudo bash /mnt/fc/control/scripts/runtime-build.sh
#
# An app VM gets a runtime only when its files ask for one (host/src/infer.js),
# as a second drive mounted read-only at /opt/runtime. The base app image has
# neither, so an app that needs no language has no interpreter to hand over.
#
# Each disk's root is the runtime's own prefix (bin/, lib/), so inside the VM
# the interpreter is /opt/runtime/bin/node or /opt/runtime/bin/python3. Both are
# self-contained: nothing links against the base image beyond glibc.
set -euo pipefail

ROOT="${ROOT:-/opt/fc}"
OUT="${OUT:-$ROOT/runtimes}"

case "$(uname -m)" in
  x86_64) NODE_ARCH=x64; PY_ARCH=x86_64 ;;
  aarch64 | arm64) NODE_ARCH=arm64; PY_ARCH=aarch64 ;;
  *) echo "unsupported arch $(uname -m)" >&2; exit 1 ;;
esac

NODE_VERSION="v24.21.0"
NODE="node-$NODE_VERSION-linux-$NODE_ARCH.tar.xz"
NODE_URL="https://nodejs.org/dist/$NODE_VERSION"

PY_RELEASE="20260924"
PY="cpython-3.12.14+$PY_RELEASE-$PY_ARCH-unknown-linux-gnu-install_only_stripped.tar.gz"
PY_URL="https://github.com/astral-sh/python-build-standalone/releases/download/$PY_RELEASE"

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
log() { printf '\n==> %s\n' "$*"; }
mkdir -p "$OUT"

fetch() {  # fetch <url-dir> <file>; the file name may carry a '+', which URLs spell %2B
  [ -f "$ROOT/$2" ] && return 0
  log "$2"
  curl -fsSL -o "$ROOT/$2" "$1/${2//+/%2B}"
}

fetch "$NODE_URL" "$NODE"
(cd "$ROOT" && curl -fsSL "$NODE_URL/SHASUMS256.txt" | grep " $NODE\$" | sha256sum -c -)
fetch "$PY_URL" "$PY"
(cd "$ROOT" && curl -fsSL "$PY_URL/SHA256SUMS" | grep " $PY\$" | sha256sum -c -)

# disk <name> <tree>: an ext4 sized to the tree plus a quarter, then e2fsck'd.
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
# A server needs node, not a package manager: installs happen in the actor,
# where the network is. npm and corepack would be one more tool for an intruder.
rm -rf "$work/node/lib/node_modules/npm" "$work/node/lib/node_modules/corepack" \
  "$work/node/bin/npm" "$work/node/bin/npx" "$work/node/bin/corepack" \
  "$work/node/include" "$work/node/share"
"$work/node/bin/node" --version
disk node "$work/node"

log "python 3.12.14 ($PY_RELEASE)"
mkdir -p "$work/python"
tar xzf "$ROOT/$PY" -C "$work/python" --strip-components=1
# pip for the same reason as npm; tests and idle for size.
rm -rf "$work/python/bin/pip"* "$work/python/lib/python3.12/site-packages/pip" \
  "$work/python/lib/python3.12/ensurepip" "$work/python/lib/python3.12/test" \
  "$work/python/lib/python3.12/idlelib" "$work/python/include" "$work/python/share"
"$work/python/bin/python3" -c 'import json, ssl, http.server; print("python", __import__("sys").version.split()[0])'
disk python "$work/python"

log "done"
ls -lh "$OUT"
