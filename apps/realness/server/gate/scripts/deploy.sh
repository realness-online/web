#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
. "$root/server/scripts/service-env.sh"
account="${SERVICE_ACCOUNT:-brayness-gate@$project.iam.gserviceaccount.com}"
host="${GATE_HOST:-$(gcloud compute instances describe brayness-demo --zone us-east1-b --project "$project" --format='value(networkInterfaces[0].networkIP)'):8081}"
stage="$(bash "$root/server/scripts/stage-service.sh" gate)"

gcloud run deploy brayness-gate \
  --project "$project" --region "$region" --source "$stage" \
  --service-account "$account" --build-service-account "projects/$project/serviceAccounts/$account" \
  --network default --subnet default --vpc-egress private-ranges-only \
  --timeout 3600 \
  --set-env-vars "^@^IDENTITY_PROJECT=$identity@PINS_BUCKET=$bucket@ORIGINS=$origins@GATE_HOST=$host" \
  --set-secrets "HOST_PASS_SECRET=HOST_PASS_SECRET:latest" \
  --allow-unauthenticated --quiet
