#!/usr/bin/env bash
# Stage the proxy and deploy it to Cloud Run.
#
# The proxy shares sync's phone pins, so it defaults to the same project and
# bucket sync uses. Deployment needs the target project to already hold
# MODEL_PASS_SECRET and OPENROUTER_API_KEY, and the service account below.
#
#   proxy/scripts/deploy.sh                     realness-development
#   PROJECT=... BUCKET=... proxy/scripts/deploy.sh
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
project="${PROJECT:-realness-development}"
region="${REGION:-us-central1}"
identity="${IDENTITY_PROJECT:-$project}"
bucket="${PINS_BUCKET:-$project.appspot.com}"
account="${SERVICE_ACCOUNT:-brayness-proxy@$project.iam.gserviceaccount.com}"
stage="$root/dist/proxy-deploy"

rm -rf "$stage"
mkdir -p "$stage"
for package in can can-store sync proxy; do
  rsync -a --exclude node_modules --exclude test --exclude scripts "$root/$package/" "$stage/$package/"
done
cat > "$stage/Dockerfile" <<'EOF'
FROM node:22-slim
WORKDIR /app
COPY can ./can
COPY can-store ./can-store
COPY sync ./sync
COPY proxy ./proxy
# Proxy imports sync's pin store, so sync needs its own dependencies.
WORKDIR /app/sync
RUN npm install --omit=dev --no-audit --no-fund
WORKDIR /app/proxy
RUN npm install --omit=dev --no-audit --no-fund
ENV NODE_ENV=production
CMD ["node", "bin/proxy-service.js"]
EOF

gcloud run deploy brayness-proxy \
  --project "$project" --region "$region" --source "$stage" \
  --service-account "$account" \
  --set-env-vars "^@^IDENTITY_PROJECT=$identity@PINS_BUCKET=$bucket" \
  --set-secrets "MODEL_PASS_SECRET=MODEL_PASS_SECRET:latest,OPENROUTER_API_KEY=OPENROUTER_API_KEY:latest" \
  --allow-unauthenticated --quiet
