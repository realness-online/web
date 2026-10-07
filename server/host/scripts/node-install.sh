#!/usr/bin/env bash
# node-install - the pinned Node the host runs on, at /opt/fc/node.
#
#   sudo bash ~/brayness/server/host/scripts/node-install.sh
#
# Hash-checked like Firecracker; idempotent, so a host that has it skips.
set -euo pipefail

NODE_VERSION="v22.23.3"
case "$(uname -m)" in
  aarch64) NODE_ARCH=arm64 NODE_SHA256=a44aeb94849a299b22df10b9e622ec2f605c2183501bc40590705131de7c740f ;;
  x86_64) NODE_ARCH=x64 NODE_SHA256=df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de ;;
  *) echo "no pinned Node for $(uname -m)" >&2; exit 1 ;;
esac
ROOT="${ROOT:-/opt/fc}"
SUDO=""
[ "$(id -u)" = 0 ] || SUDO=sudo

if [ -x "$ROOT/node/bin/node" ] && [ "$("$ROOT/node/bin/node" --version)" = "$NODE_VERSION" ]; then
  echo "node $NODE_VERSION present"
else
  echo "==> node $NODE_VERSION ($NODE_ARCH)"
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/node.tar.xz" "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-$NODE_ARCH.tar.xz"
  echo "$NODE_SHA256  $tmp/node.tar.xz" | sha256sum -c - > /dev/null
  $SUDO rm -rf "$ROOT/node"
  $SUDO mkdir -p "$ROOT/node"
  $SUDO tar xJf "$tmp/node.tar.xz" -C "$ROOT/node" --strip-components=1
  rm -rf "$tmp"
fi
$SUDO ln -sf "$ROOT/node/bin/node" /usr/local/bin/node
