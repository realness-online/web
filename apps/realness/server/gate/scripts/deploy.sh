#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
. "$root/server/scripts/service-env.sh"
account="${SERVICE_ACCOUNT:-realness-gate@$project.iam.gserviceaccount.com}"
host_name="${GATE_HOST_NAME:-realness-demo}"
host_zone="${GATE_HOST_ZONE:-us-east1-b}"
host="${GATE_HOST:-$(gcloud compute instances describe "$host_name" --zone "$host_zone" --project "$project" --format='value(networkInterfaces[0].networkIP)'):8081}"
stage="$(bash "$root/server/scripts/stage-service.sh" gate)"
bash "$root/server/gate/scripts/wake-access.sh" "${1:-}"

gcloud run deploy realness-gate \
  --project "$project" --region "$region" --source "$stage" \
  --service-account "$account" --build-service-account "projects/$project/serviceAccounts/$account" \
  --network default --subnet default --vpc-egress private-ranges-only \
  --timeout 3600 \
  --min-instances 0 \
  --set-env-vars "^@^IDENTITY_PROJECT=$identity@PINS_BUCKET=$bucket@ORIGINS=$origins@GATE_HOST=$host@GATE_HOST_NAME=$host_name@GATE_HOST_ZONE=$host_zone@SYNC_URL=$sync_url" \
  --set-secrets "HOST_PASS_SECRET=HOST_PASS_SECRET:latest" \
  --allow-unauthenticated --quiet
