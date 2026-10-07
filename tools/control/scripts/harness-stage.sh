#!/usr/bin/env bash
# Tar the same ship tree used by the binary. Nothing personal enters this tree.
set -euo pipefail

project="$(cd "$(dirname "$0")/../../.." && pwd)"
node "$project/tools/control/scripts/ship-stage.js"
. "$project/lib/output.sh"
out="$OUT"
tar czf "$out/brayness-harness.tar.gz" --owner=0 --group=0 --numeric-owner \
  --no-mac-metadata -C "$out/ship" .
shasum -a 256 "$out/brayness-harness.tar.gz" > "$out/brayness-harness.manifest"
echo "staged $out/brayness-harness.tar.gz"
