#!/usr/bin/env bash

set -euo pipefail

mode=${1:-}
shift || true

case "$mode" in
  writer) args=(--prose-wrap never) ;;
  nvim) args=(--prose-wrap always --print-width 80) ;;
  *)
    echo "usage: wrap.sh writer|nvim <file.md>..." >&2
    exit 1
    ;;
esac

if [ $# -eq 0 ]; then
  echo "usage: wrap.sh writer|nvim <file.md>..." >&2
  exit 1
fi

"$(dirname "$0")/../../../node_modules/.bin/prettier" "${args[@]}" --ignore-path /dev/null --write "$@"
