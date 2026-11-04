#!/usr/bin/env bash
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$repo"
. "$repo/lib/output.sh"
harness="$OUT/realness-harness.tar.gz"
runtime_folders="$(node "$repo/src/settings/cli.js" folders actor)"

ensure() {
  local name="$1" image="$2" inputs="$3" script="$4"
  local stamp="/opt/fc/$name.inputs"
  if [ -s "$image" ] && [ "$(cat "$stamp" 2> /dev/null)" = "$inputs" ]; then
    echo "$name: current"
    return
  fi
  echo "$name: building"
  bash "$script" > "/opt/fc/$name-build.log" 2>&1 || {
    tail -20 "/opt/fc/$name-build.log" >&2
    exit 1
  }
  echo "$inputs" > "$stamp"
  rm -rf "/opt/fc/$name-tree"
  echo "$name: built"
}

ensure template /opt/fc/template.ext4 "$({
  find package.json tools/control/scripts/template-build.sh tools/control/scripts/stage.js server/halo/guest $runtime_folders -type f -print0 | sort -z | xargs -0 sha256sum
  tar -tzf "$harness" | sort
  tar -xzOf "$harness" | sha256sum
} | sha256sum | cut -d' ' -f1)" tools/control/scripts/template-build.sh

ensure chrome /opt/fc/chrome.ext4 "$(
  find tools/control/scripts/chrome-image-build.sh tools/control/scripts/app-image-build.sh server/halo/guest -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1
)" tools/control/scripts/chrome-image-build.sh
