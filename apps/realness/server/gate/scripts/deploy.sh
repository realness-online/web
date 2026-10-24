#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
. "$root/server/scripts/service-env.sh"
account="${SERVICE_ACCOUNT:-realness-gate@$project.iam.gserviceaccount.com}"
halo_name="${GATE_HALO_NAME:-realness-1}"
halo_zone="${GATE_HALO_ZONE:-us-west2-a}"
halo_address="${GATE_HALO:-$(gcloud compute instances describe "$halo_name" --zone "$halo_zone" --project "$project" --format='value(networkInterfaces[0].networkIP)'):8081}"
stage="$(bash "$root/server/scripts/stage-service.sh" gate "" "${1:-}")"
bash "$root/server/gate/scripts/wake-access.sh" "${1:-}"

gcloud run deploy realness-gate \
  --project "$project" --region "$region" --source "$stage" \
  --service-account "$account" --build-service-account "projects/$project/serviceAccounts/$account" \
  --network default --subnet default --vpc-egress private-ranges-only \
  --timeout 3600 \
  --min-instances 0 \
  --set-env-vars "^@^IDENTITY_PROJECT=$identity@PINS_BUCKET=$bucket@ORIGINS=$origins@GATE_HALO=$halo_address@GATE_HALO_NAME=$halo_name@GATE_HALO_ZONE=$halo_zone" \
  --set-secrets "HALO_PASS_SECRET=HALO_PASS_SECRET:latest" \
  --allow-unauthenticated --quiet
