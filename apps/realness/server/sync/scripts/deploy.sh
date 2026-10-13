#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
. "$root/server/scripts/service-env.sh"
account="brayness-sync@$project.iam.gserviceaccount.com"
stage="$(bash "$root/server/scripts/stage-service.sh" sync)"

echo '{ "rule": [ { "action": { "type": "Delete" }, "condition": { "isLive": false, "daysSinceNoncurrentTime": 30 } }, { "action": { "type": "Delete" }, "condition": { "age": 7, "matchesPrefix": ["changes/"] } } ] }' \
  > "$stage/lifecycle.json"
gcloud storage buckets update "gs://$bucket" --project "$project" --versioning --lifecycle-file="$stage/lifecycle.json"

secrets="HOST_PASS_SECRET=HOST_PASS_SECRET:latest"
env_vars="^@^PROJECT=$identity@STORE=gcs@GCS_BUCKET=$bucket@ORIGINS=$origins"
if gcloud secrets describe ALERT_TOKEN --project "$project" > /dev/null 2>&1 &&
  gcloud secrets describe HOST_ALERT_WEBHOOK --project "$project" > /dev/null 2>&1; then
  secrets="$secrets,ALERT_TOKEN=ALERT_TOKEN:latest,HOST_ALERT_WEBHOOK=HOST_ALERT_WEBHOOK:latest"
  echo "host alerts: on"
else
  echo "host alerts: off (run server/sync/scripts/alert-schedule.sh)"
fi
if gcloud secrets describe GITHUB_APP_ID --project "$project" > /dev/null 2>&1 &&
  gcloud secrets describe GITHUB_APP_KEY --project "$project" > /dev/null 2>&1; then
  secrets="$secrets,GITHUB_APP_ID=GITHUB_APP_ID:latest,GITHUB_APP_KEY=GITHUB_APP_KEY:latest"
  echo "vm git: on"
else
  echo "vm git: off (store GITHUB_APP_ID and GITHUB_APP_KEY in Secret Manager)"
fi

gcloud run deploy brayness-sync \
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

node "$root/tools/control/bin/webspace.js" "$1" admins init
