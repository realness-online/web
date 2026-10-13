#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
runtime="${1:?usage: stage-runtime.sh destination}"
folders="$(node "$root/src/settings/cli.js" folders actor)"
mkdir -p "$runtime"
cp "$root/package.json" "$runtime/package.json"
for folder in $folders; do
  mkdir -p "$runtime/$folder"
  cp "$root/$folder"/*.js "$runtime/$folder/"
done
