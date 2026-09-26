#!/usr/bin/env bash
# Runs inside the fc-local Lima guest. Fetches firecracker and the kernel and
# rootfs that f1 boots. Idempotent: re-running only fills gaps.
set -euo pipefail

FC_VERSION="v1.17.0"
FC_SHA256="e351ebe4f7a16b5873bbd51005d2e6767103cff4d5ebc829df2d3f95a93e2256"
CI_PREFIX="firecracker-ci/v1.15/aarch64"
KERNEL_VERSION="6.1.155"
S3="https://s3.amazonaws.com/spec.ccfc.min"
# The host runs on Node (h4b). x64 for the fleet image:
# df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de
NODE_VERSION="v22.23.3"
NODE_SHA256="a44aeb94849a299b22df10b9e622ec2f605c2183501bc40590705131de7c740f"
ROOT="/opt/fc"

log() { printf '==> %s\n' "$*"; }

[ -e /dev/kvm ] || { echo "no /dev/kvm: nested virtualization is off" >&2; exit 1; }
log "/dev/kvm present"

sudo mkdir -p "$ROOT"
sudo chown "$(id -u):$(id -g)" "$ROOT"
cd "$ROOT"

if [ ! -x node/bin/node ] || [ "$(node/bin/node --version)" != "$NODE_VERSION" ]; then
  log "node $NODE_VERSION"
  curl -fsSL -o node.tar.xz "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-arm64.tar.xz"
  echo "$NODE_SHA256  node.tar.xz" | sha256sum -c -
  rm -rf node && mkdir node
  tar xJf node.tar.xz -C node --strip-components=1
  rm node.tar.xz
  sudo ln -sf "$ROOT/node/bin/node" /usr/local/bin/node
fi

if [ ! -x firecracker ]; then
  log "firecracker $FC_VERSION"
  curl -fsSL -o fc.tgz \
    "https://github.com/firecracker-microvm/firecracker/releases/download/$FC_VERSION/firecracker-$FC_VERSION-aarch64.tgz"
  echo "$FC_SHA256  fc.tgz" | sha256sum -c -
  tar xzf fc.tgz "release-$FC_VERSION-aarch64"
  mv "release-$FC_VERSION-aarch64/firecracker-$FC_VERSION-aarch64" firecracker
  mv "release-$FC_VERSION-aarch64/jailer-$FC_VERSION-aarch64" jailer
  rm -rf fc.tgz "release-$FC_VERSION-aarch64"
fi
./firecracker --version

if [ ! -f "vmlinux-$KERNEL_VERSION" ]; then
  log "kernel vmlinux-$KERNEL_VERSION"
  curl -fsSL -o "vmlinux-$KERNEL_VERSION" "$S3/$CI_PREFIX/vmlinux-$KERNEL_VERSION"
fi

if ! e2fsck -fn rootfs.ext4 > /dev/null 2>&1; then
  log "rootfs: ubuntu-24.04 squashfs -> ext4"
  curl -fsSL -o ubuntu-24.04.squashfs "$S3/$CI_PREFIX/ubuntu-24.04.squashfs"
  sudo rm -rf squashfs-root
  unsquashfs -q -d squashfs-root ubuntu-24.04.squashfs
  sudo chown -R root:root squashfs-root
  # 2 GiB: the unpacked tree is ~372 MB but a 512 MiB filesystem was the
  # original failure. No size argument, so mkfs uses the file's own size.
  # A bare number here would be in 1024-byte units: `524288` is 512 MiB, not
  # 2 GiB, and that is what produced "Could not allocate block".
  rm -f rootfs.ext4.new
  truncate -s 2G rootfs.ext4.new
  sudo mkfs.ext4 -q -F -d squashfs-root rootfs.ext4.new
  mv rootfs.ext4.new rootfs.ext4
  # squashfs is cached: it is the slow part of a retry
fi

e2fsck -fn rootfs.ext4 > /dev/null && log "rootfs.ext4 is a clean ext4 ($(du -h rootfs.ext4 | cut -f1))"
ls -lh "$ROOT"/firecracker "$ROOT/vmlinux-$KERNEL_VERSION" "$ROOT/rootfs.ext4"
