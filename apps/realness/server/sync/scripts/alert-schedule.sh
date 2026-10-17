#!/usr/bin/env bash
set -euo pipefail

project="${PROJECT:-realness-development}"
region="${REGION:-us-central1}"
service="realness-sync"
job="realness-halo-watch"
webhook="${1:-}"

if [ -z "$webhook" ]; then
  echo "usage: $0 <webhook-url>" >&2
  echo "  the webhook is stored from this argument; it is never echoed back" >&2
  exit 2
fi

url="$(gcloud run services describe "$service" --project "$project" --region "$region" --format='value(status.url)')" ||
  { echo "no $service in $project/$region: run server/sync/scripts/deploy.sh first" >&2; exit 1; }

ensure_secret() {
  gcloud secrets describe "$1" --project "$project" > /dev/null 2>&1 ||
    gcloud secrets create "$1" --project "$project" --replication-policy=automatic > /dev/null
}

ensure_secret ALERT_TOKEN
if ! gcloud secrets versions access latest --secret ALERT_TOKEN --project "$project" > /dev/null 2>&1; then
  head -c 32 /dev/urandom | base64 | tr -d '\n' |
    gcloud secrets versions add ALERT_TOKEN --project "$project" --data-file=- > /dev/null
  echo "ALERT_TOKEN: created"
else
  echo "ALERT_TOKEN: kept"
fi

ensure_secret HALO_ALERT_WEBHOOK
printf '%s' "$webhook" |
  gcloud secrets versions add HALO_ALERT_WEBHOOK --project "$project" --data-file=- > /dev/null
echo "HALO_ALERT_WEBHOOK: stored a new version"

token="$(gcloud secrets versions access latest --secret ALERT_TOKEN --project "$project")"
target="$url/v1/halo-watch/run"
common=(--project "$project" --location "$region" --schedule "* * * * *" --uri "$target" --http-method POST --headers "Authorization=Bearer $token")

if gcloud scheduler jobs describe "$job" --project "$project" --location "$region" > /dev/null 2>&1; then
  gcloud scheduler jobs update http "$job" "${common[@]}" > /dev/null
  echo "scheduler: $job updated, POST $target every minute"
else
  gcloud scheduler jobs create http "$job" "${common[@]}" > /dev/null
  echo "scheduler: $job created, POST $target every minute"
fi