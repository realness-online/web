#!/usr/bin/env bash
# Deploy the sync service to Cloud Run.
#
#   sync/scripts/deploy.sh                 realness-development
#   PROJECT=... BUCKET=... sync/scripts/deploy.sh
#
# Stages can, can-store, and sync into dist/sync-deploy so the file: links
# resolve inside the image, then builds with Cloud Build. One copy, always
# awake, running as its own service account that reaches one bucket only.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
project="${PROJECT:-realness-development}"
bucket="${BUCKET:-$project.appspot.com}"
region="${REGION:-us-central1}"
account="brayness-sync@$project.iam.gserviceaccount.com"
origins="${ORIGINS:-https://realness.local,https://realness.online}"
stage="$root/dist/sync-deploy"

rm -rf "$stage"
mkdir -p "$stage"
for package in can can-store sync; do
  rsync -a --exclude node_modules --exclude test --exclude scripts "$root/$package/" "$stage/$package/"
done

cat > "$stage/Dockerfile" <<'EOF'
FROM node:22-slim
WORKDIR /app
COPY can ./can
COPY can-store ./can-store
COPY sync ./sync
WORKDIR /app/sync
RUN npm install --omit=dev --no-audit --no-fund
ENV NODE_ENV=production
CMD ["node", "bin/sync-service.js"]
EOF

gcloud run deploy brayness-sync \
  --project "$project" \
  --region "$region" \
  --source "$stage" \
  --service-account "$account" \
  --set-env-vars "^@^PROJECT=$project@STORE=gcs@GCS_BUCKET=$bucket@ORIGINS=$origins" \
  --min-instances 1 \
  --max-instances 1 \
  --memory 512Mi \
  --cpu 1 \
  --allow-unauthenticated \
  --quiet
