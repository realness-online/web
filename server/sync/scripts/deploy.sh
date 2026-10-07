#!/usr/bin/env bash
# Deploy the sync service to Cloud Run.
#
#   server/sync/scripts/deploy.sh                 realness-development
#
# IDENTITY is the Firebase project whose phone sign-in the service trusts:
# the deploy's own project unless set. One project only, since one number
# has a different uid in each project and the pin would refuse the other.
#   PROJECT=... BUCKET=... server/sync/scripts/deploy.sh
#
# Stages root source with its import map, then builds with Cloud Build.
# The Node service needs no installed browser dependencies.
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
. "$root/server/scripts/service-env.sh"
account="brayness-sync@$project.iam.gserviceaccount.com"
stage="$(bash "$root/server/scripts/stage-service.sh" sync)"

# Every overwrite and delete stays recoverable: old versions live 30 days.
echo '{ "rule": [ { "action": { "type": "Delete" }, "condition": { "isLive": false, "daysSinceNoncurrentTime": 30 } } ] }' \
  > "$stage/lifecycle.json"
gcloud storage buckets update "gs://$bucket" --project "$project" --versioning --lifecycle-file="$stage/lifecycle.json"

# m8 alerts turn on once the scheduler secret and the webhook exist:
#   server/sync/scripts/alert-schedule.sh stores ALERT_TOKEN and the webhook URL.
secrets="HOST_PASS_SECRET=HOST_PASS_SECRET:latest"
env_vars="^@^PROJECT=$identity@STORE=gcs@GCS_BUCKET=$bucket@ORIGINS=$origins"
if gcloud secrets describe ALERT_TOKEN --project "$project" > /dev/null 2>&1 &&
  gcloud secrets describe HOST_ALERT_WEBHOOK --project "$project" > /dev/null 2>&1; then
  secrets="$secrets,ALERT_TOKEN=ALERT_TOKEN:latest,HOST_ALERT_WEBHOOK=HOST_ALERT_WEBHOOK:latest"
  echo "host alerts: on"
else
  echo "host alerts: off (run server/sync/scripts/alert-schedule.sh)"
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
