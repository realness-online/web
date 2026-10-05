#!/usr/bin/env bash
# Deploy the sync service to Cloud Run.
#
#   sync/scripts/deploy.sh                 realness-development
#
# IDENTITY is the Firebase project whose phone sign-in the service trusts:
# the deploy's own project unless set. One project only, since one number
# has a different uid in each project and the pin would refuse the other.
#   PROJECT=... BUCKET=... sync/scripts/deploy.sh
#
# Stages can, can-store, and sync into dist/sync-deploy so the file: links
# resolve inside the image, then builds with Cloud Build. One copy, scaled to
# zero when nothing calls it (the alert clock wakes it on a schedule).
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
project="${PROJECT:-realness-development}"
bucket="${BUCKET:-$project.appspot.com}"
region="${REGION:-us-central1}"
account="brayness-sync@$project.iam.gserviceaccount.com"
origins="${ORIGINS:-https://brayness-sign-on.web.app,http://localhost:5173}"
identity="${IDENTITY:-$project}"
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

# Every overwrite and delete stays recoverable: old versions live 30 days.
echo '{ "rule": [ { "action": { "type": "Delete" }, "condition": { "isLive": false, "daysSinceNoncurrentTime": 30 } } ] }' \
  > "$stage/lifecycle.json"
gcloud storage buckets update "gs://$bucket" --project "$project" --versioning --lifecycle-file="$stage/lifecycle.json"

# m8 alerts turn on once the scheduler secret and the webhook exist:
#   sync/scripts/alert-schedule.sh stores ALERT_TOKEN and the webhook URL.
secrets="HOST_PASS_SECRET=HOST_PASS_SECRET:latest"
env_vars="^@^PROJECT=$identity@STORE=gcs@GCS_BUCKET=$bucket@ORIGINS=$origins"
if gcloud secrets describe ALERT_TOKEN --project "$project" > /dev/null 2>&1 &&
  gcloud secrets describe HOST_ALERT_WEBHOOK --project "$project" > /dev/null 2>&1; then
  secrets="$secrets,ALERT_TOKEN=ALERT_TOKEN:latest,HOST_ALERT_WEBHOOK=HOST_ALERT_WEBHOOK:latest"
  echo "host alerts: on"
else
  echo "host alerts: off (run sync/scripts/alert-schedule.sh)"
fi

gcloud run deploy brayness-sync \
  --project "$project" \
  --region "$region" \
  --source "$stage" \
  --service-account "$account" \
  --set-env-vars "$env_vars" \
  --set-secrets "$secrets" \
  --min-instances 0 \
  --max-instances 1 \
  --memory 512Mi \
  --cpu 1 \
  --allow-unauthenticated \
  --quiet
