#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
service="${1:?usage: stage-service.sh sync|proxy|gate [output-root] [environment]}"
environment="${3:-}"
args=""
[ -n "$environment" ] && args=", \"--environment\", \"$environment\""
case "$service" in sync|proxy|gate) ;; *) echo "unknown service: $service" >&2; exit 1 ;; esac
. "$root/lib/output.sh"
stage="${2:-$OUT}/$service-deploy"
rm -rf "$stage"
mkdir -p "$stage"
cp "$root/package.json" "$stage/package.json"
folders="$(node "$root/src/settings/cli.js" folders service "$service")"
for folder in $folders; do
  mkdir -p "$stage/$folder"
  rsync -a --exclude test/ --exclude browser/ --exclude .DS_Store "$root/$folder/" "$stage/$folder/"
done
cat > "$stage/Dockerfile" <<EOF
FROM node:22-slim
WORKDIR /app
COPY . .
ENV NODE_ENV=production
CMD ["node", "server/$service/bin/$service-service.js"$args]
EOF
node "$root/scripts/release-stamp.js" "$stage" > /dev/null
printf '%s\n' "$stage"
