#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
. "$root/server/scripts/service-env.sh"
account="${SERVICE_ACCOUNT:-realness-gate@$project.iam.gserviceaccount.com}"
host_name="${GATE_HOST_NAME:-realness-demo}"
host_zone="${GATE_HOST_ZONE:-us-east1-b}"
role="realnessHostStarter"

if ! gcloud iam roles describe "$role" --project "$project" > /dev/null 2>&1; then
  gcloud iam roles create "$role" --project "$project" \
    --title "Start a realness host" \
    --permissions compute.instances.start --stage GA --quiet
fi

gcloud compute instances add-iam-policy-binding "$host_name" \
  --project "$project" --zone "$host_zone" \
  --member "serviceAccount:$account" \
  --role "projects/$project/roles/$role" --quiet > /dev/null

printf 'gate %s may start %s\n' "$account" "$host_name"
