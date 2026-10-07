#!/usr/bin/env bash
# Stage the same root source for either standard-library-only service.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
service="${1:?usage: stage-service.sh sync|proxy|gate}"
case "$service" in sync|proxy|gate) ;; *) echo "unknown service: $service" >&2; exit 1 ;; esac
. "$root/lib/output.sh"
stage="$OUT/$service-deploy"
rm -rf "$stage"
mkdir -p "$stage"
cp "$root/package.json" "$stage/package.json"
# Shared code without tests or browser entries; then the service's own folders.
rsync -a --exclude test/ --exclude browser/ "$root/lib/" "$stage/lib/"
folders="server/sync/src server/$service/bin"
# The gate checks sign-in with the proxy's phone identity.
[ "$service" = proxy ] || [ "$service" = gate ] && folders="$folders server/proxy/src"
[ "$service" = gate ] && folders="$folders server/gate/src"
for folder in $folders; do
  mkdir -p "$stage/$folder"
  rsync -a "$root/$folder/" "$stage/$folder/"
done
cat > "$stage/Dockerfile" <<EOF
FROM node:22-slim
WORKDIR /app
COPY . .
ENV NODE_ENV=production
CMD ["node", "server/$service/bin/$service-service.js"]
EOF
printf '%s\n' "$stage"
