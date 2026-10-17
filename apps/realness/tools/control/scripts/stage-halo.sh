#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
stage="${1:?usage: stage-halo.sh destination}"
folders="$(node "$root/src/settings/cli.js" folders halo)"
files="$(node "$root/src/settings/cli.js" files halo)"
for file in $files; do
  mkdir -p "$stage/$(dirname "$file")"
  cp "$root/$file" "$stage/$file"
done
for folder in $folders; do
  mkdir -p "$stage/$folder"
  rsync -a --exclude test/ --exclude checks/ --exclude browser/ --exclude node_modules/ --exclude dist/ --exclude __pycache__/ "$root/$folder/" "$stage/$folder/"
done
