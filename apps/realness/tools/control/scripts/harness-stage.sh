#!/usr/bin/env bash
set -euo pipefail

project="$(cd "$(dirname "$0")/../../.." && pwd)"
node "$project/tools/control/scripts/ship-stage.js"
. "$project/lib/output.sh"
out="$OUT"
tar czf "$out/realness-harness.tar.gz" --owner=0 --group=0 --numeric-owner \
  --no-mac-metadata -C "$out/ship" .
shasum -a 256 "$out/realness-harness.tar.gz" > "$out/realness-harness.manifest"
echo "staged $out/realness-harness.tar.gz"
