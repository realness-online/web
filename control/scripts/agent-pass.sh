#!/usr/bin/env bash
# The shared pass for the realness agent proxy, from Secret Manager into dist/.
# dist/ is ignored and never enters the ship tree; template-build.sh copies the
# pass into the image as a root-only file that hosted Pi reads per request.
set -euo pipefail

project="$(cd "$(dirname "$0")/../.." && pwd)"
out="$project/dist/agent-pass"
mkdir -p "$project/dist"
umask 077
gcloud secrets versions access latest --secret AGENT_PASS \
  --project "${AGENT_PASS_PROJECT:-realness-online}" > "$out.tmp"
[ -s "$out.tmp" ] || { rm -f "$out.tmp"; echo "AGENT_PASS is empty" >&2; exit 1; }
mv "$out.tmp" "$out"
echo "agent pass: $out"
