#!/usr/bin/env bash
# The browser terminal, built here and shipped with the host.
#
# Fetches the terminal example (brayness-examples/terminal) with giget, builds
# it, and puts its dist/ at host/term/, which host/src/webterm.js serves.
# No network needed at deploy.
#
#   TERMINAL_REF=<branch|tag|sha>   default main
#   TERMINAL_SOURCE=<dir>           build a local checkout instead of fetching
set -euo pipefail

project="$(cd "$(dirname "$0")/../.." && pwd)"
work="$project/dist/terminal"
out="$project/host/term"
ref="${TERMINAL_REF:-main}"

rm -rf "$work"
mkdir -p "$work"
if [ -n "${TERMINAL_SOURCE:-}" ]; then
  tar -C "$TERMINAL_SOURCE" -cf - --exclude=node_modules --exclude=dist --exclude=.cache . \
    | tar -C "$work" -xf -
else
  npx -y giget "gh:scott-fryxell/brayness-examples/terminal#$ref" "$work" --force > /dev/null
fi

(cd "$work" && npm ci --no-fund --no-audit --silent && npm run build --silent > /dev/null)
rm -rf "$out"
cp -R "$work/dist" "$out"
printf 'terminal: %s (%s)\n' "$out" "${TERMINAL_SOURCE:-gh:scott-fryxell/brayness-examples/terminal#$ref}"
