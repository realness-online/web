#!/usr/bin/env bash
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
stamp=/opt/fc/template.inputs
cd "$repo"
. "$repo/lib/output.sh"
harness="$OUT/realness-harness.tar.gz"
runtime_folders="$(node "$repo/src/settings/cli.js" folders actor)"
inputs="$({
  find package.json tools/control/scripts/template-build.sh tools/control/scripts/stage-runtime.sh server/halo/guest $runtime_folders -type f -print0 | sort -z | xargs -0 sha256sum
  tar -tzf "$harness" | sort
  tar -xzOf "$harness" | sha256sum
} | sha256sum | cut -d' ' -f1)"

if [ -s /opt/fc/template.ext4 ] && [ "$(cat "$stamp" 2> /dev/null)" = "$inputs" ]; then
  echo "template: current"
  exit 0
fi
echo "template: building"
bash tools/control/scripts/template-build.sh > /opt/fc/template-build.log 2>&1 || {
  tail -20 /opt/fc/template-build.log >&2
  exit 1
}
echo "$inputs" > "$stamp"
echo "template: built"
