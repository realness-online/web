#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-/opt/fc}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
. "$REPO/lib/output.sh"
TREE="${TREE:-$ROOT/template-tree}"
IMG="${IMG:-$ROOT/template.ext4}"
SIZE="${SIZE:-4G}"
STAGE="${STAGE:-full}"
HARNESS_TAR="${HARNESS_TAR:-$OUT/realness-harness.tar.gz}"
GUEST_SRC="${GUEST_SRC:-$REPO/server/halo/guest}"
RUNS="${RUNS_DIR:-$OUT}"
RUN="$RUNS/template-$(date -u +%Y%m%dT%H%M%SZ)"

case "$(uname -m)" in
  x86_64) UBUNTU_ARCH=amd64; NODE_ARCH=x64 ;;
  aarch64 | arm64) UBUNTU_ARCH=arm64; NODE_ARCH=arm64 ;;
  *) echo "unsupported arch $(uname -m)" >&2; exit 1 ;;
esac
UBUNTU_BASE="ubuntu-base-24.04.3-base-$UBUNTU_ARCH.tar.gz"
NODE_VERSION="v24.21.0"
NODE="node-$NODE_VERSION-linux-$NODE_ARCH.tar.xz"

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
mkdir -p "$RUN"
exec > >(tee "$RUN/build.log") 2>&1

log() { printf '\n==> %s\n' "$*"; }

log "stage=$STAGE, tree=$TREE, image=$IMG ($SIZE)"

UBUNTU_BASE_URL="https://cdimage.ubuntu.com/ubuntu-base/releases/24.04/release"
NODE_URL="https://nodejs.org/dist/$NODE_VERSION"

fetch() {
  local url="$1" file="$2"
  [ -f "$ROOT/$file" ] && return 0
  log "$file"
  curl -fsSL -o "$ROOT/$file" "$url/$file"
}

fetch "$UBUNTU_BASE_URL" "$UBUNTU_BASE"
(cd "$ROOT" && curl -fsSL "$UBUNTU_BASE_URL/SHA256SUMS" | grep "$UBUNTU_BASE\$" | sha256sum -c -)
fetch "$NODE_URL" "$NODE"
(cd "$ROOT" && curl -fsSL "$NODE_URL/SHASUMS256.txt" | grep "$NODE\$" | sha256sum -c -)

rm -rf "$TREE"
mkdir -p "$TREE"
tar xzf "$ROOT/$UBUNTU_BASE" -C "$TREE"
printf '  %s unpacked: %s\n' "$UBUNTU_BASE" "$(du -sh "$TREE" | cut -f1)"

log "boot config"
echo realness > "$TREE/etc/hostname"
printf '# no fstab: Firecracker passes root=/dev/vda rw on the cmdline\n' > "$TREE/etc/fstab"
: > "$TREE/etc/resolv.conf"

printf '#!/bin/sh\nexit 101\n' > "$TREE/usr/sbin/policy-rc.d"
chmod 0755 "$TREE/usr/sbin/policy-rc.d"

install -m 0755 "$GUEST_SRC/fcnet-setup.sh" "$TREE/usr/local/bin/fcnet-setup.sh"
install -m 0755 "$GUEST_SRC/realness-net-up" "$TREE/usr/local/bin/realness-net-up"
install -m 0755 "$GUEST_SRC/realness-agent.py" "$TREE/usr/local/bin/realness-agent"
install -m 0755 "$GUEST_SRC/realness-pty" "$TREE/usr/local/bin/realness-pty"
install -m 0755 "$GUEST_SRC/realness-chat" "$TREE/usr/local/bin/realness-chat"
install -m 0644 "$GUEST_SRC/realness-chat.md" "$TREE/usr/local/share/realness-chat.md"
install -m 0755 "$GUEST_SRC/realness-actor-init" "$TREE/usr/local/bin/realness-actor-init"
install -m 0755 "$GUEST_SRC/realness-publish" "$TREE/usr/local/bin/realness-publish"
install -m 0755 "$GUEST_SRC/realness-chrome" "$TREE/usr/local/bin/realness-chrome"
install -m 0755 "$GUEST_SRC/realness-read" "$TREE/usr/local/bin/realness-read"
install -m 0755 "$GUEST_SRC/realness-site" "$TREE/usr/local/bin/realness-site"
install -m 0755 "$GUEST_SRC/realness-loop-run" "$TREE/usr/local/bin/realness-loop-run"
install -m 0755 "$GUEST_SRC/realness-loop" "$TREE/usr/local/bin/realness-loop"
install -m 0755 "$GUEST_SRC/realness-recover" "$TREE/usr/local/bin/realness-recover"
install -m 0755 "$GUEST_SRC/realness-model-pass" "$TREE/usr/local/bin/realness-model-pass"
install -m 0644 "$GUEST_SRC/realness-net.service" "$TREE/etc/systemd/system/realness-net.service"
install -m 0644 "$GUEST_SRC/realness-vsock.service" "$TREE/etc/systemd/system/realness-vsock.service"
install -m 0644 "$GUEST_SRC/realness-pty.service" "$TREE/etc/systemd/system/realness-pty.service"
install -m 0644 "$GUEST_SRC/realness-chat.service" "$TREE/etc/systemd/system/realness-chat.service"

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

BASE_PACKAGES=(
  systemd systemd-sysv
  udev kmod
  iproute2 socat python3
  python3-yaml
  ca-certificates curl git ripgrep fd-find jq unzip
  less
)

log "apt: ${BASE_PACKAGES[*]}"
chroot "$TREE" env DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 \
  apt-get update -qq
chroot "$TREE" env DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 \
  apt-get install -y -qq --no-install-recommends "${BASE_PACKAGES[@]}"

log "installed packages: $(chroot "$TREE" dpkg-query -f '.\n' -W | wc -l)"

chroot "$TREE" dpkg-query -W systemd git socat python3 fd-find > /dev/null \
  || { echo "dpkg does not agree the base packages installed" >&2; exit 1; }

log "enabling units"
systemctl --root="$TREE" enable \
  serial-getty@ttyS0.service realness-net.service realness-vsock.service realness-pty.service realness-chat.service

chroot "$TREE" passwd -l root > /dev/null 2>&1 || true
rm -f "$TREE/etc/systemd/system/sockets.target.wants/ssh.socket"
if chroot "$TREE" dpkg-query -W openssh-server > /dev/null 2>&1; then
  echo "openssh-server is installed - a hosted template should not carry it" >&2
  exit 1
fi

if [ "$STAGE" = base ]; then
  log "STAGE=base: stopping before node/pi/harness"
else

log "node $NODE_VERSION"
tar xJf "$ROOT/$NODE" -C "$TREE/usr/local" --strip-components=1
chroot "$TREE" /usr/local/bin/node --version

runtime="$TREE/usr/local/lib/realness"
mkdir -p "$runtime"
bash "$REPO/tools/control/scripts/stage-runtime.sh" "$runtime"

[ -f "$HARNESS_TAR" ] || { echo "run tools/control/scripts/harness-stage.sh <env> on the Mac first" >&2; exit 1; }
PI_VERSION="$(tar xOzf "$HARNESS_TAR" ./.pi-version)"
[[ "$PI_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]] || {
  echo "invalid pi version in $HARNESS_TAR: $PI_VERSION" >&2
  exit 1
}
log "pi $PI_VERSION (our fork, from .pi/runtime)"
mkdir -p "$TREE/usr/local/lib/realness-pi"
tar xzf "$HARNESS_TAR" -C "$TREE/usr/local/lib/realness-pi" --strip-components=3 ./.pi/runtime
chroot "$TREE" env PATH=/usr/local/bin:/usr/bin:/bin \
  npm ci --ignore-scripts --no-fund --no-audit --prefix /usr/local/lib/realness-pi
for command in pi pi-session-read; do
  ln -sf "/usr/local/lib/realness-pi/node_modules/.bin/$command" "$TREE/usr/local/bin/$command"
done

AGENT_BROWSER_VERSION="${AGENT_BROWSER_VERSION:-0.31.1}"
log "agent-browser $AGENT_BROWSER_VERSION (leases Chrome)"
chroot "$TREE" env PATH=/usr/local/bin:/usr/bin:/bin npm install -g \
  --ignore-scripts "agent-browser@$AGENT_BROWSER_VERSION" --no-fund --no-audit
chmod 0755 "$TREE"/usr/local/lib/node_modules/agent-browser/bin/agent-browser-linux-*
rm -f "$TREE/usr/local/bin/agent-browser"
cat > "$TREE/usr/local/bin/agent-browser" <<'WRAPPER'
#!/bin/sh
REAL=/usr/local/lib/node_modules/agent-browser/bin/agent-browser.js
case "${1:-}" in ""|--version|-V|--help|-h|help|install|skills) exec /usr/local/bin/node "$REAL" "$@" ;; esac
LEASE="/tmp/realness-chrome-$(id -u)"
url="$(cat "$LEASE" 2> /dev/null)"
if [ -z "$url" ] || ! curl -fs -m 3 -o /dev/null "$url/json/version"; then
  url="$(/usr/local/bin/realness-chrome)" || exit 1
  printf '%s\n' "$url" > "$LEASE"
fi
exec /usr/local/bin/node "$REAL" --cdp "$url" "$@"
WRAPPER
chmod 0755 "$TREE/usr/local/bin/agent-browser"

log "stock harness -> /realness"
[ -f "$HARNESS_TAR" ] || { echo "run tools/control/scripts/harness-stage.sh <env> on the Mac first" >&2; exit 1; }
mkdir -p "$TREE/realness"
tar xzf "$HARNESS_TAR" -C "$TREE/realness"
mkdir -p "$TREE/usr/local/share/realness-starter"
tar xzf "$HARNESS_TAR" -C "$TREE/usr/local/share/realness-starter"
chmod -R a+rX "$TREE/usr/local/share/realness-starter"

log "harness pi-packages"
chroot "$TREE" env PATH=/usr/local/bin:/usr/bin:/bin \
  npm install --ignore-scripts --no-fund --no-audit --prefix /realness/.pi/agent/npm

log "harness dependencies"
chroot "$TREE" env PATH=/usr/local/bin:/usr/bin:/bin \
  npm ci --ignore-scripts --no-fund --no-audit --prefix /realness/.pi

cat > "$TREE/usr/local/bin/realness" <<'WRAPPER'
#!/bin/sh
if [ "${1:-}" = publish ]; then shift; exec /usr/local/bin/realness-publish "$@"; fi
if [ "${1:-}" = chrome ]; then shift; exec /usr/local/bin/realness-chrome "$@"; fi
case "${1:-}" in sync|turn-start|turn-end|fetch|git-credential|files|store|login|logout|whoami|ls|cat|cp|rm|example)
  exec /usr/local/bin/node /usr/local/lib/realness/tools/cli/bin/actor.js "$@" ;;
esac
if [ "${1:-}" = loop ]; then shift; exec /usr/local/bin/realness-loop "$@"; fi
case "${1:-}" in -h|--help)
  echo "realness publish [dir]  serve a built site from this actor; prints its link"
  echo "realness chrome [return]  lease a fresh Chrome; prints its DevTools address"
  echo "realness loop \"<goal>\"  start a loop in its own actor; prints its id"
  echo "realness loop report <id>  a loop's status, runs, and log tail"
  echo "realness fetch <path>  pull a file this light actor left in storage"
  echo ;;
esac
export PI_OFFLINE=1
export TMPDIR=/var/tmp
export PI_SESSION_FORMAT=html.gz
export PI_SESSION_READER=/usr/local/bin/pi-session-read
export PI_HARDWARE_CURSOR=1
exec /realness/.pi/bin/pi "$@"
WRAPPER
chmod 0755 "$TREE/usr/local/bin/realness"

chroot "$TREE" git config --system credential.https://github.com.helper '!/usr/local/bin/realness git-credential'
chroot "$TREE" git config --system credential.https://github.com.useHttpPath true

fi

log "template hygiene"
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

chroot "$TREE" /usr/bin/fdfind --version

log "realness starts, and resolves pi without the network"
chroot "$TREE" env PATH=/usr/local/bin:/usr/bin:/bin HOME=/realness \
  /usr/local/bin/realness --version
chroot "$TREE" /realness/.pi/node_modules/.bin/prettier --version
test ! -e "$TREE/realness/node_modules"

log "warm the extension caches"
scratch=/realness/artifacts/pi
rm -rf "$TREE$scratch/jiti" "$TREE$scratch/node-compile-cache"
chroot "$TREE" env PATH=/usr/local/bin:/usr/bin:/bin HOME=/realness \
  sh -c 'cd /realness && /usr/local/bin/realness --help > /dev/null'
jiti_files="$(find "$TREE$scratch/jiti" -type f 2> /dev/null | wc -l)"
[ "$jiti_files" -gt 0 ] || { echo "warm-up left $scratch/jiti empty" >&2; exit 1; }
log "jiti cache: $jiti_files files"

log "realness user owns /realness and the caches"
chroot "$TREE" id -u realness > /dev/null 2>&1 \
  || chroot "$TREE" useradd -M -U -d /realness -s /bin/bash realness
chroot "$TREE" chown -R realness:realness /realness
cat > "$TREE/etc/tmpfiles.d/realness-run.conf" <<'TMPFILES'
d /run/realness 0755 realness realness
TMPFILES

if [ "$STAGE" != base ]; then
  log "skill checks"
  chroot "$TREE" runuser -u realness -- env PATH=/usr/local/bin:/usr/bin:/bin HOME=/realness \
    sh -c 'cd /realness && node .pi/bin/checks/check-skills.js --run --no-browser' \
    || { echo "a shipped skill's check failed" >&2; exit 1; }
fi

log "building $IMG"
cleanup_mounts
rm -f "$IMG.new"
truncate -s "$SIZE" "$IMG.new"
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