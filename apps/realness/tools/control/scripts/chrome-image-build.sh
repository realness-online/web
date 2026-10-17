#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-/opt/fc}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TREE="${TREE:-$ROOT/chrome-tree}"
IMG="${IMG:-$ROOT/chrome.ext4}"
SIZE="${SIZE:-2G}"
GUEST_SRC="$REPO/server/halo/guest"
REVISION=1194
case "$(uname -m)" in
  x86_64) ZIP=chromium-headless-shell-linux.zip SUM=d745c7210cc88b73c7991a22c9624819960d84bc3de77ac7336d2de841a8c91f ;;
  aarch64 | arm64) ZIP=chromium-headless-shell-linux-arm64.zip SUM=6b963b7651119c81fa51312c1176429d3235bbefb56d5c687730cf44a5b1fdd7 ;;
  *) echo "unsupported arch $(uname -m)" >&2; exit 1 ;;
esac

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
log() { printf '\n==> %s\n' "$*"; }

EXTRA_PACKAGES="libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 libcairo2 libcups2t64
  libdbus-1-3 libdrm2 libgbm1 libglib2.0-0t64 libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1
  libxcomposite1 libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2
  fonts-liberation fonts-noto-core fonts-noto-color-emoji fonts-noto-cjk unzip"
TREE="$TREE" STAGE=base EXTRA_PACKAGES="$(echo $EXTRA_PACKAGES)" bash "$REPO/tools/control/scripts/app-image-build.sh"

log "chromium headless shell r$REVISION"
[ -f "$ROOT/$ZIP" ] || curl -fsSL -o "$ROOT/$ZIP" "https://cdn.playwright.dev/dbazure/download/playwright/builds/chromium/$REVISION/$ZIP"
echo "$SUM  $ROOT/$ZIP" | sha256sum -c -
rm -rf "$TREE/opt/chrome"
cp "$ROOT/$ZIP" "$TREE/tmp/chrome.zip"
chroot "$TREE" unzip -q /tmp/chrome.zip -d /opt
rm -f "$TREE/tmp/chrome.zip"
mv "$TREE/opt/chrome-linux" "$TREE/opt/chrome"
chmod -R a+rX,go-w "$TREE/opt/chrome"
missing="$(chroot "$TREE" ldd /opt/chrome/headless_shell | grep 'not found' || true)"
[ -z "$missing" ] || { echo "headless_shell is missing libraries:" >&2; echo "$missing" >&2; exit 1; }
chroot "$TREE" /opt/chrome/headless_shell --version 2> /dev/null || true

log "chrome user and unit"
echo realness-chrome > "$TREE/etc/hostname"
chroot "$TREE" id chrome > /dev/null 2>&1 || chroot "$TREE" useradd --system --home-dir /var/lib/chrome --shell /usr/sbin/nologin chrome
for unit in realness-chrome.service realness-devtools.socket realness-devtools.service; do
  install -m 0644 "$GUEST_SRC/$unit" "$TREE/etc/systemd/system/$unit"
done
systemctl --root="$TREE" disable realness-app.service > /dev/null 2>&1 || true
rm -f "$TREE/etc/systemd/system/realness-app.service"
systemctl --root="$TREE" enable realness-chrome.service realness-devtools.socket
chroot "$TREE" /bin/sh -c 'command -v unzip' > /dev/null && rm -f "$TREE/usr/bin/unzip"

log "building $IMG"
rm -f "$IMG.new"
truncate -s "$SIZE" "$IMG.new"
mkfs.ext4 -q -F -d "$TREE" "$IMG.new"
e2fsck -fn "$IMG.new" > /dev/null && mv "$IMG.new" "$IMG"
du -sh "$TREE" | sed 's/^/  tree: /'
ls -lh "$IMG" | awk '{print "  image: " $5 " " $9}'
