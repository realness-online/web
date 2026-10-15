#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-/opt/fc}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
. "$REPO/lib/output.sh"
TREE="${TREE:-$ROOT/app-tree}"
IMG="${IMG:-$ROOT/app.ext4}"
SIZE="${SIZE:-1G}"
STAGE="${STAGE:-full}"
GUEST_SRC="${GUEST_SRC:-$REPO/server/host/guest}"
RUNS="${RUNS_DIR:-$OUT}"
RUN="$RUNS/app-image-$(date -u +%Y%m%dT%H%M%SZ)"

case "$(uname -m)" in
  x86_64) UBUNTU_ARCH=amd64 ;;
  aarch64 | arm64) UBUNTU_ARCH=arm64 ;;
  *) echo "unsupported arch $(uname -m)" >&2; exit 1 ;;
esac
UBUNTU_BASE="ubuntu-base-24.04.3-base-$UBUNTU_ARCH.tar.gz"

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
mkdir -p "$RUN"
exec > >(tee "$RUN/build.log") 2>&1

log() { printf '\n==> %s\n' "$*"; }

log "stage=$STAGE, tree=$TREE, image=$IMG ($SIZE)"

UBUNTU_BASE_URL="https://cdimage.ubuntu.com/ubuntu-base/releases/24.04/release"

fetch() {
  local url="$1" file="$2"
  [ -f "$ROOT/$file" ] && return 0
  log "$file"
  curl -fsSL -o "$ROOT/$file" "$url/$file"
}

fetch "$UBUNTU_BASE_URL" "$UBUNTU_BASE"
(cd "$ROOT" && curl -fsSL "$UBUNTU_BASE_URL/SHA256SUMS" | grep "$UBUNTU_BASE\$" | sha256sum -c -)

rm -rf "$TREE"
mkdir -p "$TREE"
tar xzf "$ROOT/$UBUNTU_BASE" -C "$TREE"
printf '  %s unpacked: %s\n' "$UBUNTU_BASE" "$(du -sh "$TREE" | cut -f1)"

log "boot config"
echo realness-app > "$TREE/etc/hostname"
printf '# no fstab: Firecracker passes root=/dev/vda rw on the cmdline\n' > "$TREE/etc/fstab"
: > "$TREE/etc/resolv.conf"

printf '#!/bin/sh\nexit 101\n' > "$TREE/usr/sbin/policy-rc.d"
chmod 0755 "$TREE/usr/sbin/policy-rc.d"

install -m 0755 "$GUEST_SRC/fcnet-setup.sh" "$TREE/usr/local/bin/fcnet-setup.sh"
install -m 0755 "$GUEST_SRC/realness-net-up" "$TREE/usr/local/bin/realness-net-up"
install -m 0644 "$GUEST_SRC/realness-net.service" "$TREE/etc/systemd/system/realness-net.service"

cp /etc/resolv.conf "$TREE/etc/resolv.conf"

for dir in proc sys dev dev/pts; do
  mkdir -p "$TREE/$dir"
  mountpoint -q "$TREE/$dir" || mount --bind "/$dir" "$TREE/$dir"
done
cleanup_mounts() {
  for dir in dev/pts dev sys proc; do
    mountpoint -q "$TREE/$dir" && umount "$TREE/$dir" || true
  done
}
trap cleanup_mounts EXIT

APP_PACKAGES=(
  systemd systemd-sysv
  udev kmod
  iproute2
  ca-certificates
  tini
)
read -r -a EXTRA <<< "${EXTRA_PACKAGES:-}"
APP_PACKAGES+=("${EXTRA[@]}")

log "apt: ${APP_PACKAGES[*]}"
chroot "$TREE" env DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 \
  apt-get update -qq
chroot "$TREE" env DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 \
  apt-get install -y -qq --no-install-recommends "${APP_PACKAGES[@]}"

log "installed packages: $(chroot "$TREE" dpkg-query -f '.\n' -W | wc -l)"

mkdir -p "$TREE/app" "$TREE/opt/runtime"
chroot "$TREE" useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin app
for script in realness-app-mount realness-app-start; do
  install -m 0755 "$GUEST_SRC/$script" "$TREE/usr/local/bin/$script"
done
install -m 0644 "$GUEST_SRC/realness-app.service" "$TREE/etc/systemd/system/realness-app.service"

chroot "$TREE" dpkg-query -W systemd iproute2 ca-certificates > /dev/null \
  || { echo "dpkg does not agree the base packages installed" >&2; exit 1; }

log "enabling units"
systemctl --root="$TREE" enable realness-net.service realness-app.service
systemctl --root="$TREE" mask getty.target getty@.service serial-getty@.service getty-static.service \
  e2scrub_reap.service e2scrub_all.timer e2scrub_all.service

chroot "$TREE" passwd -l root > /dev/null 2>&1 || true
rm -f "$TREE/etc/systemd/system/sockets.target.wants/ssh.socket"
if chroot "$TREE" dpkg-query -W openssh-server > /dev/null 2>&1; then
  echo "openssh-server is installed - an app image should not carry it" >&2
  exit 1
fi

rm -f "$TREE/usr/bin/perl" "$TREE"/usr/bin/perl5.*
for tool in node python3 python perl pi git socat; do
  if chroot "$TREE" /bin/sh -c "command -v $tool" > /dev/null 2>&1; then
    echo "$tool is in the app image - it should be stripped" >&2
    exit 1
  fi
done
if [ -e "$TREE/realness" ]; then
  echo "/realness is in the app image - it should be stripped" >&2
  exit 1
fi

log "hygiene"
: > "$TREE/etc/machine-id"
systemctl --root="$TREE" mask systemd-firstboot.service
systemctl --root="$TREE" disable systemd-networkd.service systemd-networkd-wait-online.service
rm -rf "$TREE/var/lib/systemd/random-seed"
rm -rf "$TREE/root/.npm" "$TREE/root/.cache"
find "$TREE" \( -name '._*' -o -name '.DS_Store' \) -delete 2> /dev/null || true
: > "$TREE/etc/resolv.conf"
find "$TREE/var/log" -type f -delete 2> /dev/null || true
find "$TREE/tmp" -mindepth 1 -delete 2> /dev/null || true
chroot "$TREE" apt-get clean

if [ "$STAGE" = base ]; then
  log "STAGE=base: stopping before image build"
else

log "building $IMG"
cleanup_mounts
rm -f "$IMG.new"
truncate -s "$SIZE" "$IMG.new"
mkfs.ext4 -q -F -d "$TREE" "$IMG.new"
e2fsck -fn "$IMG.new" > /dev/null && mv "$IMG.new" "$IMG"

fi

cleanup_mounts
log "done"
du -sh "$TREE" | sed 's/^/  tree: /'
ls -lh "$IMG" 2> /dev/null | awk '{print "  image: " $5 " " $9}'
echo "  log $RUN/build.log"
