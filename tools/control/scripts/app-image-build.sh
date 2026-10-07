#!/usr/bin/env bash
# Runs where the microVM runs: the fc-local Lima guest (arm64) or a cloud host
# (x86_64). Builds the app image: Ubuntu 24.04 that boots under the Firecracker
# CI kernel and runs an untrusted server, and nothing else.
#
#   sudo bash /mnt/fc/tools/control/scripts/app-image-build.sh            # full
#   sudo STAGE=base bash /mnt/fc/tools/control/scripts/app-image-build.sh # boot-test only
#
# The app image is a sibling of template.ext4, not a fork of it. An actor image
# carries pi, git, the harness, and the vsock agent, because an actor is a
# harness; an app is a server we did not write. Anything on the image is a tool
# for whoever breaks in, so it carries what every app needs and nothing more.
# A runtime is a separate read-only disk (runtime-build.sh), attached only to
# an app whose files ask for it (server/host/src/infer.js).
#
# What an app image carries, and why:
#   - systemd, udev, kmod    the boot path; udev is only a Recommends of systemd,
#                            and without it the boot stalls on dev-ttyS0.device
#   - iproute2, fcnet-setup  the MAC-to-address step; an app VM gets its own TAP
#   - ca-certificates        an app that speaks TLS needs the bundle
#   - a locked root, no sshd  the same rule the actor template follows
#
# What it deliberately does not have: a vsock agent, a PTY service, the harness,
# node, python, pi, git, a package manager's cache. u2d probes these absences.
#
# Builds into a temp name and renames only after a clean e2fsck: a failed mkfs
# otherwise leaves a file that looks like a finished image.
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

# Node says x64 where Ubuntu says amd64.
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

# ------------------------------------------------------------- fetched inputs
# Cached under /opt/fc because they are the slow part of a rebuild. The sum is
# checked every run, not only on download. The same file template-build.sh
# fetches, so the two images are built from one base.
UBUNTU_BASE_URL="https://cdimage.ubuntu.com/ubuntu-base/releases/24.04/release"

fetch() {  # fetch <url-dir> <file>
  local url="$1" file="$2"
  [ -f "$ROOT/$file" ] && return 0
  log "$file"
  curl -fsSL -o "$ROOT/$file" "$url/$file"
}

fetch "$UBUNTU_BASE_URL" "$UBUNTU_BASE"
(cd "$ROOT" && curl -fsSL "$UBUNTU_BASE_URL/SHA256SUMS" | grep "$UBUNTU_BASE\$" | sha256sum -c -)

# ---------------------------------------------------------------- unpack base
rm -rf "$TREE"
mkdir -p "$TREE"
tar xzf "$ROOT/$UBUNTU_BASE" -C "$TREE"
printf '  %s unpacked: %s\n' "$UBUNTU_BASE" "$(du -sh "$TREE" | cut -f1)"

# ------------------------------------------------------------ boot-time config
log "boot config"
echo brayness-app > "$TREE/etc/hostname"
printf '# no fstab: Firecracker passes root=/dev/vda rw on the cmdline\n' > "$TREE/etc/fstab"
: > "$TREE/etc/resolv.conf"

# A container-style guard: while building in a chroot there is no running
# systemd, and apt's postinst scripts should not try to start services.
printf '#!/bin/sh\nexit 101\n' > "$TREE/usr/sbin/policy-rc.d"
chmod 0755 "$TREE/usr/sbin/policy-rc.d"

# fcnet-setup.sh is the MAC-to-address step; the route and resolver are ours.
install -m 0755 "$GUEST_SRC/fcnet-setup.sh" "$TREE/usr/local/bin/fcnet-setup.sh"
install -m 0755 "$GUEST_SRC/brayness-net-up" "$TREE/usr/local/bin/brayness-net-up"
install -m 0644 "$GUEST_SRC/brayness-net.service" "$TREE/etc/systemd/system/brayness-net.service"

# Host resolver, so apt in the chroot can reach the archive.
cp /etc/resolv.conf "$TREE/etc/resolv.conf"

# ----------------------------------------------------------------- apt install
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
  systemd systemd-sysv            # ubuntu-base ships no init
  udev kmod                       # dev nodes and module loading: both are
                                  # only Recommends of systemd, and without udev
                                  # the boot stalls on dev-ttyS0.device
  iproute2                        # brayness-net-up calls ip
  ca-certificates                 # an app that speaks TLS needs the bundle
  tini                            # pid 1 inside a container-shaped app, if it wants one
)

log "apt: ${APP_PACKAGES[*]}"
chroot "$TREE" env DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 \
  apt-get update -qq
chroot "$TREE" env DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 \
  apt-get install -y -qq --no-install-recommends "${APP_PACKAGES[@]}"

log "installed packages: $(chroot "$TREE" dpkg-query -f '.\n' -W | wc -l)"

# The code disk mounts at /app and the runtime disk, when an app has one, at
# /opt/runtime; both read-only. The app runs as `app`, never root.
mkdir -p "$TREE/app" "$TREE/opt/runtime"
chroot "$TREE" useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin app
for script in brayness-app-mount brayness-app-start; do
  install -m 0755 "$GUEST_SRC/$script" "$TREE/usr/local/bin/$script"
done
install -m 0644 "$GUEST_SRC/brayness-app.service" "$TREE/etc/systemd/system/brayness-app.service"

# dpkg's status is the thing the CI image lacked; it has to be real here.
chroot "$TREE" dpkg-query -W systemd iproute2 ca-certificates > /dev/null \
  || { echo "dpkg does not agree the base packages installed" >&2; exit 1; }

# ------------------------------------------------------------------- enable it
log "enabling units"
# --root writes symlinks into the tree; no running systemd required.
systemctl --root="$TREE" enable brayness-net.service brayness-app.service
# No login anywhere: no getty on the serial console or a virtual terminal, and
# no ext4 scrub; each is memory and a surface an app never needs. The serial
# log still carries the boot and the app's own output.
systemctl --root="$TREE" mask getty.target getty@.service serial-getty@.service getty-static.service \
  e2scrub_reap.service e2scrub_all.timer e2scrub_all.service

# Never a password prompt, and no sshd: the app has no login.
chroot "$TREE" passwd -l root > /dev/null 2>&1 || true
rm -f "$TREE/etc/systemd/system/sockets.target.wants/ssh.socket"
if chroot "$TREE" dpkg-query -W openssh-server > /dev/null 2>&1; then
  echo "openssh-server is installed - an app image should not carry it" >&2
  exit 1
fi

# The app image must not carry the actor's own tools. These are the absences
# u2d probes, so fail the build rather than ship an image that has one.
#
# perl-base is Essential in ubuntu-base because dpkg's scripts use it. Every
# apt step is done, so the interpreter goes: an app VM never runs dpkg.
rm -f "$TREE/usr/bin/perl" "$TREE"/usr/bin/perl5.*
for tool in node python3 python perl pi git socat; do
  # command is a shell builtin, so the chroot needs a shell to ask it.
  if chroot "$TREE" /bin/sh -c "command -v $tool" > /dev/null 2>&1; then
    echo "$tool is in the app image - it should be stripped" >&2
    exit 1
  fi
done
if [ -e "$TREE/brayness" ]; then
  echo "/brayness is in the app image - it should be stripped" >&2
  exit 1
fi

# ---------------------------------------------------------- app image hygiene
log "hygiene"
# An *empty* machine-id means uninitialized: systemd writes a fresh one at boot,
# so two app VMs do not share an identity. Deleting the file instead makes
# systemd run its first-boot wizard, which prompts on the serial console and
# blocks the boot - so the mask stays.
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

# ------------------------------------------------------------------ build image
log "building $IMG"
cleanup_mounts
rm -f "$IMG.new"
truncate -s "$SIZE" "$IMG.new"
# No size argument: mkfs uses the file's size. A bare number would be in
# 1024-byte units and silently shrink the image.
mkfs.ext4 -q -F -d "$TREE" "$IMG.new"
e2fsck -fn "$IMG.new" > /dev/null && mv "$IMG.new" "$IMG"

fi

log "done"
du -sh "$TREE" | sed 's/^/  tree: /'
ls -lh "$IMG" 2> /dev/null | awk '{print "  image: " $5 " " $9}'
echo "  log $RUN/build.log"
