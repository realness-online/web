#!/usr/bin/env bash
# Store a secret in an environment's project, typed or pasted at a hidden prompt.
#   npm run secret -- OPENROUTER_API_KEY          dev (realness-development)
#   npm run secret -- OPENROUTER_API_KEY prod
# Creates the secret if it is new; otherwise adds a version. Never echoes it.
set -euo pipefail
name="${1:?usage: npm run secret -- NAME [dev|prod]}"
env="${2:-dev}"
[[ "$name" =~ ^[A-Z][A-Z0-9_]{1,62}$ ]] || { echo "secret names are UPPER_SNAKE_CASE" >&2; exit 1; }
project="$(node -e 'import("./webspace.config.js").then(m => console.log(m.environment(process.argv[1]).cloud.project))' "$env")"
read -rsp "Paste $name for $env ($project), then press Enter: " value
echo
value="$(printf %s "$value" | tr -d '\r\n')"
[ -n "$value" ] || { echo "nothing pasted; nothing stored" >&2; exit 1; }
if gcloud secrets describe "$name" --project "$project" > /dev/null 2>&1; then
  printf %s "$value" | gcloud secrets versions add "$name" --data-file=- --project "$project"
else
  printf %s "$value" | gcloud secrets create "$name" --data-file=- --replication-policy=automatic --project "$project"
fi
echo "stored $name: ${#value} characters, ending ...${value: -4}"
