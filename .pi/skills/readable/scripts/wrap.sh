#!/usr/bin/env bash

set -euo pipefail

mode=${1:-}
shift || true

case "$mode" in
  writer | nvim) ;;
  *)
    echo "usage: wrap.sh writer|nvim <file.md>..." >&2
    exit 1
    ;;
esac

if [ $# -eq 0 ]; then
  echo "usage: wrap.sh writer|nvim <file.md>..." >&2
  exit 1
fi

here="$(cd "$(dirname "$0")" && pwd)"
files=()
for file in "$@"; do files+=("$(cd "$(dirname "$file")" && pwd)/$(basename "$file")"); done
"$here/../../../../apps/realness/node_modules/.bin/oxfmt" -c "$here/wrap-$mode.json" --ignore-path /dev/null --write "${files[@]}"
