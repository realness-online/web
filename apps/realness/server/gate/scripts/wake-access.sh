#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
. "$root/server/scripts/service-env.sh"
account="${SERVICE_ACCOUNT:-realness-gate@$project.iam.gserviceaccount.com}"
halo_name="${GATE_HALO_NAME:-realness-1}"
halo_zone="${GATE_HALO_ZONE:-us-west2-a}"
role="realnessHaloStarter"

if ! gcloud iam roles describe "$role" --project "$project" > /dev/null 2>&1; then
  gcloud iam roles create "$role" --project "$project" \
    --title "Start a realness halo" \
    --permissions compute.instances.start --stage GA --quiet
fi

gcloud compute instances add-iam-policy-binding "$halo_name" \
  --project "$project" --zone "$halo_zone" \
  --member "serviceAccount:$account" \
  --role "projects/$project/roles/$role" --quiet > /dev/null

printf 'gate %s may start %s\n' "$account" "$halo_name"
