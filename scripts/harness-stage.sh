#!/usr/bin/env bash
# Runs on the Mac. Stages the "stock harness" - the part of this repo that is
# not personal - as a tarball the Lima guest can read at /mnt/fc/build/.
#
#   bash work/brayness-webspace/scripts/harness-stage.sh
#
# An allowlist, not an exclude list: a new personal file must be added here
# deliberately before it can reach a hosted template. Deliberately excluded:
#
#   .pi/agent/auth.json        model credentials
#   .pi/agent/trust.json       this machine's paths
#   .pi/agent/sessions/        272 transcripts
#   .pi/agent/npm/node_modules installed separately, in the image
#   .pi/agent/mcp-cache.json   machine-local caches
#   .pi/agent/models-store.json
#   AGENTS.local.md            personal context
#   plans/ work/ artifacts/    not harness
#   */node_modules             installed in the image, not shipped
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="$(cd "$(dirname "$0")/.." && pwd)/dist"
TAR="$OUT/brayness-harness.tar.gz"
MANIFEST="$OUT/brayness-harness.manifest"

INCLUDE=(
  AGENTS.md
  README.md
  LICENSE
  package.json
  bin
  skills
  extensions
  .pi/agent/settings.json
  .pi/agent/models.json
  .pi/agent/subagents.json
  .pi/agent/npm/package.json
)

mkdir -p "$OUT"
for entry in "${INCLUDE[@]}"; do
  [ -e "$REPO/$entry" ] || { echo "missing from the repo: $entry" >&2; exit 1; }
done

# --owner/--group with a numeric uid: the image is root-owned regardless of who
# runs this. .DS_Store and AppleDouble files are macOS junk that would otherwise
# ride along inside skills/.
# --no-mac-metadata: macOS bsdtar synthesises ._* members from xattrs during
# creation, and --exclude does not filter members it synthesises.
tar czf "$TAR" --owner=0 --group=0 --numeric-owner --no-mac-metadata \
  --exclude='.DS_Store' --exclude='._*' --exclude='node_modules' \
  -C "$REPO" "${INCLUDE[@]}"

{
  echo "# stock harness staged $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# from $REPO"
  echo
  echo "## sha256"
  shasum -a 256 "$TAR" | awk '{print $1}'
  echo
  echo "## contents ($(tar tzf "$TAR" | wc -l | tr -d ' ') entries)"
  tar tzf "$TAR"
} > "$MANIFEST"

echo "staged $TAR"
echo "       $(du -h "$TAR" | cut -f1), $(tar tzf "$TAR" | wc -l | tr -d ' ') entries"
echo "       sha256 $(shasum -a 256 "$TAR" | awk '{print $1}')"
tar tzf "$TAR" | sed 's/^/       /'