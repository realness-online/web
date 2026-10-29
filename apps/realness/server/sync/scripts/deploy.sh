#!/usr/bin/env bash
# Deploy sync to Cloud Run. The bucket is set up once, not per deploy:
# rewriting its lifecycle would drop rules added beside ours. So this refuses
# to deploy unless deletes stay recoverable: versioning on, noncurrent copies
# kept 30 days.
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
. "$root/server/scripts/service-env.sh"
account="realness-sync@$project.iam.gserviceaccount.com"
stage="$(bash "$root/server/scripts/stage-service.sh" sync)"

bucket_json="$(curl -sf -H "authorization: Bearer $(gcloud auth print-access-token)" \
  "https://storage.googleapis.com/storage/v1/b/$bucket?fields=versioning,lifecycle")"
BUCKET_JSON="$bucket_json" node -e '
  const b = JSON.parse(process.env.BUCKET_JSON)
  const kept = (b.lifecycle?.rule ?? []).some(r =>
    r.action?.type === "Delete" && r.condition?.isLive === false &&
    r.condition?.daysSinceNoncurrentTime === 30)
  if (!b.versioning?.enabled || !kept) {
    console.error("bucket needs versioning and a 30-day noncurrent delete rule; set it once by hand")
    process.exit(1)
  }
  console.log("bucket: versioned, noncurrent kept 30 days")
'

secrets="HALO_PASS_SECRET=HALO_PASS_SECRET:latest"
env_vars="^@^PROJECT=$identity@STORE=gcs@GCS_BUCKET=$bucket@ORIGINS=$origins@HALO_POWER_PROJECT=$project"
if gcloud secrets describe ALERT_TOKEN --project "$project" > /dev/null 2>&1 &&
  gcloud secrets describe HALO_ALERT_WEBHOOK --project "$project" > /dev/null 2>&1; then
  secrets="$secrets,ALERT_TOKEN=ALERT_TOKEN:latest,HALO_ALERT_WEBHOOK=HALO_ALERT_WEBHOOK:latest"
  echo "halo alerts: on"
else
  echo "halo alerts: off (run server/sync/scripts/alert-schedule.sh)"
fi
if gcloud secrets describe GITHUB_APP_ID --project "$project" > /dev/null 2>&1 &&
  gcloud secrets describe GITHUB_APP_KEY --project "$project" > /dev/null 2>&1; then
  secrets="$secrets,GITHUB_APP_ID=GITHUB_APP_ID:latest,GITHUB_APP_KEY=GITHUB_APP_KEY:latest"
  echo "vm git: on"
else
  echo "vm git: off (store GITHUB_APP_ID and GITHUB_APP_KEY in Secret Manager)"
fi

gcloud run deploy realness-sync \
  --project "$project" \
  --region "$region" \
  --source "$stage" \
  --service-account "$account" --build-service-account "projects/$project/serviceAccounts/$account" \
  --set-env-vars "$env_vars" \
  --set-secrets "$secrets" \
  --min-instances 0 \
  --max-instances 1 \
  --memory 512Mi \
  --cpu 1 \
  --allow-unauthenticated \
  --quiet

node "$root/tools/cli/bin/realness.js" "$1" admins init
