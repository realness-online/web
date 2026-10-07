#!/usr/bin/env bash
# template-ensure - rebuild the actor template only when its inputs changed.
#
#   sudo bash ~/brayness/tools/control/scripts/template-ensure.sh
#
# Inputs are the build script, the guest programs, and the staged harness. Their
# hash sits beside the template; a match skips the build, so a plain restart
# stays fast. A rebuilt template changes the seed fingerprint, and the next
# serve rebuilds the seed from it.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
stamp=/opt/fc/template.inputs
cd "$repo"
# The harness is repacked on every push, so hash its names and contents, not
# its bytes: tar timestamps would force a rebuild every time.
. "$repo/lib/output.sh"
harness="$OUT/brayness-harness.tar.gz"
inputs="$({
  find package.json tools/control/scripts/template-build.sh server/host/guest lib tools/cli -type f -print0 | sort -z | xargs -0 sha256sum
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
