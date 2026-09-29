#!/usr/bin/env bash
# Build the local HTML chat example for the host's browser server.
set -euo pipefail
project="$(cd "$(dirname "$0")/../.." && pwd)"
source="${CHAT_SOURCE:-$project/../brayness-examples/chat}"
out="$project/host/chat"
(cd "$source" && npm run build --silent)
rm -rf "$out"
cp -R "$source/dist" "$out"
printf 'chat: %s (%s)\n' "$out" "$source"
