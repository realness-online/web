#!/usr/bin/env bash
set -euo pipefail

FC_VERSION="v1.17.0"
ARCH="$(uname -m)"
case "$ARCH" in
  aarch64) FC_SHA256="e351ebe4f7a16b5873bbd51005d2e6767103cff4d5ebc829df2d3f95a93e2256" ;;
  x86_64) FC_SHA256="06094a1108ae9e82aa4c23a775aa92758f53f1175d422270d9d6162cb9ade558" ;;
  *) echo "unsupported architecture $ARCH" >&2; exit 1 ;;
esac
CI_PREFIX="firecracker-ci/v1.15/$ARCH"
KERNEL_VERSION="6.1.155"
S3="https://s3.amazonaws.com/spec.ccfc.min"
ROOT="/opt/fc"

log() { printf '==> %s\n' "$*"; }

[ -e /dev/kvm ] || { echo "no /dev/kvm: nested virtualization is off" >&2; exit 1; }
log "/dev/kvm present"

sudo mkdir -p "$ROOT"
sudo chown "$(id -u):$(id -g)" "$ROOT"
cd "$ROOT"

bash "$(dirname "$0")/../../../server/halo/scripts/node-install.sh"

if [ ! -x firecracker ]; then
  log "firecracker $FC_VERSION"
  curl -fsSL -o fc.tgz \
    "https://github.com/firecracker-microvm/firecracker/releases/download/$FC_VERSION/firecracker-$FC_VERSION-$ARCH.tgz"
  echo "$FC_SHA256  fc.tgz" | sha256sum -c -
  tar xzf fc.tgz "release-$FC_VERSION-$ARCH"
  mv "release-$FC_VERSION-$ARCH/firecracker-$FC_VERSION-$ARCH" firecracker
  mv "release-$FC_VERSION-$ARCH/jailer-$FC_VERSION-$ARCH" jailer
  rm -rf fc.tgz "release-$FC_VERSION-$ARCH"
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
  rm -f rootfs.ext4.new
  truncate -s 2G rootfs.ext4.new
  sudo mkfs.ext4 -q -F -d squashfs-root rootfs.ext4.new
  mv rootfs.ext4.new rootfs.ext4
fi

e2fsck -fn rootfs.ext4 > /dev/null && log "rootfs.ext4 is a clean ext4 ($(du -h rootfs.ext4 | cut -f1))"
ls -lh "$ROOT"/firecracker "$ROOT/vmlinux-$KERNEL_VERSION" "$ROOT/rootfs.ext4"
