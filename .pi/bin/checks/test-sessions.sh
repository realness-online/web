#!/bin/sh
set -e
cd "$(dirname "$0")/../../../work/pi/packages/coding-agent"
for format in jsonl html.gz; do
  echo "== PI_SESSION_FORMAT=$format"
  env $(env | grep -o '^PI_[A-Z_]*' | sed 's/^/-u /') PI_SESSION_FORMAT=$format npx vitest run "$@"
done
