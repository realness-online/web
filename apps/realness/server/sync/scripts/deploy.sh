#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
. "$root/server/scripts/service-env.sh"
account="realness-sync@$project.iam.gserviceaccount.com"
stage="$(bash "$root/server/scripts/stage-service.sh" sync)"

echo '{ "rule": [ { "action": { "type": "Delete" }, "condition": { "isLive": false, "daysSinceNoncurrentTime": 30 } } ] }' \
  > "$stage/lifecycle.json"
gcloud storage buckets update "gs://$bucket" --project "$project" --versioning --lifecycle-file="$stage/lifecycle.json"

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
