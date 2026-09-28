#!/usr/bin/env bash
# Runs where the microVM runs: the fc-local Lima guest (arm64) or the prod host
# (x86_64). Fetches ubuntu-base and node (checksummed), then builds the actor
# template: a real Ubuntu 24.04 userspace that boots under the Firecracker CI
# kernel, with pi, git, node, and the stock harness in it and nothing personal.
#
#   sudo bash /mnt/fc/control/scripts/template-build.sh            # full
#   sudo STAGE=base bash /mnt/fc/control/scripts/template-build.sh # boot-test only
#
# Both inputs are cached under /opt/fc; a re-run only fetches what is missing.
#
# STAGE=base stops after systemd and the base packages, so the boot path can be
# proven before half a gigabyte of toolchain is layered on it.
#
# ubuntu-base is the right base but it is only a filesystem: 91 packages and no
# init at all, so systemd has to be installed into it. The Firecracker CI rootfs
# is the wrong base - it has an empty /var/lib/dpkg, so apt in it is not
# trustworthy.
#
# Builds into a temp name and renames only after a clean e2fsck: a failed mkfs
# otherwise leaves a file that looks like a finished image.
set -euo pipefail

ROOT="${ROOT:-/opt/fc}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TREE="${TREE:-$ROOT/template-tree}"
IMG="${IMG:-$ROOT/template.ext4}"
SIZE="${SIZE:-4G}"
STAGE="${STAGE:-full}"
HARNESS_TAR="${HARNESS_TAR:-$REPO/dist/brayness-harness.tar.gz}"
GUEST_SRC="${GUEST_SRC:-$REPO/host/guest}"
RUNS="${RUNS_DIR:-$REPO/dist}"
RUN="$RUNS/template-$(date -u +%Y%m%dT%H%M%SZ)"

# Node says x64 where Ubuntu says amd64.
case "$(uname -m)" in
  x86_64) UBUNTU_ARCH=amd64; NODE_ARCH=x64 ;;
  aarch64 | arm64) UBUNTU_ARCH=arm64; NODE_ARCH=arm64 ;;
  *) echo "unsupported arch $(uname -m)" >&2; exit 1 ;;
esac
UBUNTU_BASE="ubuntu-base-24.04.3-base-$UBUNTU_ARCH.tar.gz"
NODE_VERSION="v24.21.0"
NODE="node-$NODE_VERSION-linux-$NODE_ARCH.tar.xz"
# The Mac captured its installed pi version in the staged harness archive.
# Read it before installing pi, so a missing or stale stage cannot use a fallback.

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
mkdir -p "$RUN"
exec > >(tee "$RUN/build.log") 2>&1

log() { printf '\n==> %s\n' "$*"; }

log "stage=$STAGE, tree=$TREE, image=$IMG ($SIZE)"

# ------------------------------------------------------------- fetched inputs
# Cached under /opt/fc because they are the slow part of a rebuild. The sums
# are checked every run, not only on download.
UBUNTU_BASE_URL="https://cdimage.ubuntu.com/ubuntu-base/releases/24.04/release"
NODE_URL="https://nodejs.org/dist/$NODE_VERSION"

fetch() {  # fetch <url-dir> <file>
  local url="$1" file="$2"
  [ -f "$ROOT/$file" ] && return 0
  log "$file"
  curl -fsSL -o "$ROOT/$file" "$url/$file"
}

fetch "$UBUNTU_BASE_URL" "$UBUNTU_BASE"
(cd "$ROOT" && curl -fsSL "$UBUNTU_BASE_URL/SHA256SUMS" | grep "$UBUNTU_BASE\$" | sha256sum -c -)
fetch "$NODE_URL" "$NODE"
(cd "$ROOT" && curl -fsSL "$NODE_URL/SHASUMS256.txt" | grep "$NODE\$" | sha256sum -c -)

# ---------------------------------------------------------------- unpack base
rm -rf "$TREE"
mkdir -p "$TREE"
tar xzf "$ROOT/$UBUNTU_BASE" -C "$TREE"
printf '  %s unpacked: %s\n' "$UBUNTU_BASE" "$(du -sh "$TREE" | cut -f1)"

# ------------------------------------------------------------ boot-time config
log "boot config"
echo brayness > "$TREE/etc/hostname"
printf '# no fstab: Firecracker passes root=/dev/vda rw on the cmdline\n' > "$TREE/etc/fstab"
: > "$TREE/etc/resolv.conf"

# A container-style guard: while building in a chroot there is no running
# systemd, and apt's postinst scripts should not try to start services.
printf '#!/bin/sh\nexit 101\n' > "$TREE/usr/sbin/policy-rc.d"
chmod 0755 "$TREE/usr/sbin/policy-rc.d"

# fcnet-setup.sh is the MAC-to-address step brayness-net-up calls first. It is
# vendored in host/guest (see the header there) because the CI squashfs it
# comes from is a leftover of the rootfs fetch, not a build input.
install -m 0755 "$GUEST_SRC/fcnet-setup.sh" "$TREE/usr/local/bin/fcnet-setup.sh"
install -m 0755 "$GUEST_SRC/brayness-net-up" "$TREE/usr/local/bin/brayness-net-up"
install -m 0755 "$GUEST_SRC/brayness-agent.py" "$TREE/usr/local/bin/brayness-agent"
install -m 0755 "$GUEST_SRC/brayness-pty" "$TREE/usr/local/bin/brayness-pty"
install -m 0755 "$GUEST_SRC/brayness-actor-init" "$TREE/usr/local/bin/brayness-actor-init"
install -m 0755 "$GUEST_SRC/brayness-publish" "$TREE/usr/local/bin/brayness-publish"
install -m 0755 "$GUEST_SRC/brayness-loop-run" "$TREE/usr/local/bin/brayness-loop-run"
install -m 0755 "$GUEST_SRC/brayness-loop" "$TREE/usr/local/bin/brayness-loop"
install -m 0755 "$GUEST_SRC/brayness-recover" "$TREE/usr/local/bin/brayness-recover"
install -m 0755 "$GUEST_SRC/brayness-model-pass" "$TREE/usr/local/bin/brayness-model-pass"
install -m 0644 "$GUEST_SRC/brayness-net.service" "$TREE/etc/systemd/system/brayness-net.service"
install -m 0644 "$GUEST_SRC/brayness-vsock.service" "$TREE/etc/systemd/system/brayness-vsock.service"
install -m 0644 "$GUEST_SRC/brayness-pty.service" "$TREE/etc/systemd/system/brayness-pty.service"

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

BASE_PACKAGES=(
  systemd systemd-sysv            # ubuntu-base ships no init
  udev kmod                       # dev nodes and module loading: both are
                                  # only Recommends of systemd, and without udev
                                  # the boot stalls on dev-ttyS0.device
  iproute2 socat python3           # python3, not -minimal: the agent imports
                                  # json, which the minimal stdlib does not ship
  ca-certificates curl git ripgrep fd-find jq unzip
  less
)

log "apt: ${BASE_PACKAGES[*]}"
chroot "$TREE" env DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 \
  apt-get update -qq
chroot "$TREE" env DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 \
  apt-get install -y -qq --no-install-recommends "${BASE_PACKAGES[@]}"

log "installed packages: $(chroot "$TREE" dpkg-query -f '.\n' -W | wc -l)"

# dpkg's status is the thing the CI image lacked; it has to be real here.
chroot "$TREE" dpkg-query -W systemd git socat python3 fd-find > /dev/null \
  || { echo "dpkg does not agree the base packages installed" >&2; exit 1; }

# ------------------------------------------------------------------- enable it
log "enabling units"
# --root writes symlinks into the tree; no running systemd required.
systemctl --root="$TREE" enable \
  serial-getty@ttyS0.service brayness-net.service brayness-vsock.service brayness-pty.service

# Never a password prompt, and no sshd in a hosted template: the control
# channel is vsock.
chroot "$TREE" passwd -l root > /dev/null 2>&1 || true
rm -f "$TREE/etc/systemd/system/sockets.target.wants/ssh.socket"
if chroot "$TREE" dpkg-query -W openssh-server > /dev/null 2>&1; then
  echo "openssh-server is installed - a hosted template should not carry it" >&2
  exit 1
fi

if [ "$STAGE" = base ]; then
  log "STAGE=base: stopping before node/pi/harness"
else

# ------------------------------------------------------------------------ node
log "node $NODE_VERSION"
tar xJf "$ROOT/$NODE" -C "$TREE/usr/local" --strip-components=1
chroot "$TREE" /usr/local/bin/node --version

# -------------------------------------------------------------------------- pi
# The documented install: https://.../docs/containerization.md
[ -f "$HARNESS_TAR" ] || { echo "run control/scripts/harness-stage.sh on the Mac first" >&2; exit 1; }
PI_VERSION="$(tar xOzf "$HARNESS_TAR" ./.pi-version)"
[[ "$PI_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]] || {
  echo "invalid pi version in $HARNESS_TAR: $PI_VERSION" >&2
  exit 1
}
log "pi $PI_VERSION (global, from local build)"
chroot "$TREE" env PATH=/usr/local/bin:/usr/bin:/bin npm install -g \
  --ignore-scripts "@earendil-works/pi-coding-agent@$PI_VERSION" --no-fund --no-audit

# ---------------------------------------------------------------------- harness
# Actor files live at /brayness; exports carry the harness and its work/.
log "stock harness -> /brayness"
[ -f "$HARNESS_TAR" ] || { echo "run control/scripts/harness-stage.sh on the Mac first" >&2; exit 1; }
mkdir -p "$TREE/brayness"
tar xzf "$HARNESS_TAR" -C "$TREE/brayness"

# pi packages (the harness's own extensions) live in .pi/agent/npm
log "harness pi-packages"
chroot "$TREE" env PATH=/usr/local/bin:/usr/bin:/bin \
  npm install --ignore-scripts --no-fund --no-audit --prefix /brayness/.pi/agent/npm

# pi-mono-auto-fix looks for node_modules/.bin/prettier above each edited file,
# else runs `npx prettier`: a registry fetch per actor, which failed under
# load. One pinned copy at the harness root covers everything under it.
log "prettier for auto-fix"
chroot "$TREE" env PATH=/usr/local/bin:/usr/bin:/bin \
  npm install --no-save --ignore-scripts --no-fund --no-audit --prefix /brayness prettier@3.9.9

# brayness is the harness entrypoint. A wrapper rather than a symlink: bin/pi
# derives the repo root from its own path, so a symlink named brayness would
# make it look for /usr/local/skills.
cat > "$TREE/usr/local/bin/brayness" <<'WRAPPER'
#!/bin/sh
# `brayness publish [dir]` asks the host to serve a built site (the door).
if [ "${1:-}" = publish ]; then shift; exec /usr/local/bin/brayness-publish "$@"; fi
# `brayness loop "<goal>"` hands long work to a loop in its own actor.
if [ "${1:-}" = loop ]; then shift; exec /usr/local/bin/brayness-loop "$@"; fi
case "${1:-}" in -h|--help)
  echo "brayness publish [dir]  serve a built site from this actor; prints its link"
  echo "brayness loop \"<goal>\"  start a loop in its own actor; prints its id"
  echo "brayness loop report <id>  a loop's status, runs, and log tail"
  echo ;;
esac
# exec, not a symlink: bin/pi resolves the harness root from its own path.
# PI_OFFLINE skips startup network work only (model calls still go out). The
# image is pinned, so update checks have nothing to find, and on two vCPUs
# their ten `npm view` processes kept pi deaf to keys for minutes.
export PI_OFFLINE=1
# jiti caches transpiled extensions in $TMPDIR/jiti, and Node its compile cache
# beside it. /tmp is emptied per actor and per boot, which cost ~130s of
# transpiling on two vCPUs at every first start. /var/tmp survives both.
export TMPDIR=/var/tmp
exec /brayness/bin/pi "$@"
WRAPPER
chmod 0755 "$TREE/usr/local/bin/brayness"

# Keep the caches out of /var/tmp's 30-day age cleaning.
cat > "$TREE/etc/tmpfiles.d/brayness-pi-cache.conf" <<'TMPFILES'
x /var/tmp/jiti
x /var/tmp/node-compile-cache
TMPFILES

fi

# ------------------------------------------------------------- template hygiene
log "template hygiene"
# An *empty* machine-id means uninitialized: systemd writes a fresh one at boot,
# so forked actors do not share an identity. Deleting the file instead makes
# systemd run its first-boot wizard, which prompts on the serial console and
# blocks the boot - a template must never do that, hence the mask.
: > "$TREE/etc/machine-id"
systemctl --root="$TREE" mask systemd-firstboot.service
# We address eth0 ourselves from its MAC (brayness-net.service). networkd has no
# configuration and nothing to do, and its wait-online unit would only add a
# stall before our unit runs.
systemctl --root="$TREE" disable systemd-networkd.service systemd-networkd-wait-online.service
rm -rf "$TREE/var/lib/systemd/random-seed"
# Build residue: the npm cache is ~274 MB and nothing reads it at runtime.
rm -rf "$TREE/root/.npm" "$TREE/root/.cache"
# AppleDouble junk survives the tar exclude: the shipped template.ext4 had
# ._models.json next to models.json even though neither the repo nor the staged
# tarball contained one. Purge from the tree so it cannot reach the image.
find "$TREE" \( -name '._*' -o -name '.DS_Store' \) -delete 2> /dev/null || true
: > "$TREE/etc/resolv.conf"
find "$TREE/var/log" -type f -delete 2> /dev/null || true
find "$TREE/tmp" -mindepth 1 -delete 2> /dev/null || true
chroot "$TREE" apt-get clean

# Pi accepts Ubuntu's fdfind name for its find tool, even in offline mode.
chroot "$TREE" /usr/bin/fdfind --version

# With no resolver, reaching for npx here would fail instead of printing a
# version - so this is the offline check, not just a smoke test.
log "brayness starts, and resolves pi without the network"
chroot "$TREE" env PATH=/usr/local/bin:/usr/bin:/bin HOME=/brayness \
  /usr/local/bin/brayness --version
chroot "$TREE" /brayness/node_modules/.bin/prettier --version

# --help loads every extension, so this fills the caches the wrapper points at.
# Paths match an actor's, so its first start reads them instead of transpiling.
log "warm the extension caches"
rm -rf "$TREE/var/tmp/jiti" "$TREE/var/tmp/node-compile-cache"
chroot "$TREE" env PATH=/usr/local/bin:/usr/bin:/bin HOME=/brayness \
  sh -c 'cd /brayness && /usr/local/bin/brayness --help > /dev/null'
jiti_files="$(find "$TREE/var/tmp/jiti" -type f 2> /dev/null | wc -l)"
[ "$jiti_files" -gt 0 ] || { echo "warm-up left /var/tmp/jiti empty" >&2; exit 1; }
log "jiti cache: $jiti_files files"

# Pi and the terminal run as `brayness`; boot setup and the agent stay root.
log "brayness user owns /brayness and the caches"
chroot "$TREE" id -u brayness > /dev/null 2>&1 \
  || chroot "$TREE" useradd -M -U -d /brayness -s /bin/bash brayness
chroot "$TREE" chown -R brayness:brayness /brayness /var/tmp/jiti /var/tmp/node-compile-cache
cat > "$TREE/etc/tmpfiles.d/brayness-run.conf" <<'TMPFILES'
d /run/brayness 0755 brayness brayness
TMPFILES

# ------------------------------------------------------------------ build image
log "building $IMG"
cleanup_mounts
rm -f "$IMG.new"
truncate -s "$SIZE" "$IMG.new"
# No size argument: mkfs uses the file's size. A bare number would be in
# 1024-byte units and silently shrink the image.
mkfs.ext4 -q -F -d "$TREE" "$IMG.new"
e2fsck -fn "$IMG.new" > /dev/null && mv "$IMG.new" "$IMG"

log "done"
du -sh "$TREE" | sed 's/^/  tree: /'
ls -lh "$IMG" | awk '{print "  image: " $5 " " $9}'
dumpe2fs -h "$IMG" 2> /dev/null \
  | awk '/^Block count:/{b=$3} /^Block size:/{s=$3} /^Free blocks:/{f=$3} END{
      printf "  filesystem: %.2f GiB, %.2f GiB free\n", b*s/1073741824, f*s/1073741824 }'
echo "  sha256 $(sha256sum "$IMG" | cut -d' ' -f1)"
echo "  log $RUN/build.log"