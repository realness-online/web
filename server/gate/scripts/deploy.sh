#!/usr/bin/env bash
# Deploy the gate to Cloud Run in development.
#
#   server/gate/scripts/deploy.sh                    GATE_HOST defaults to brayness-demo
#   GATE_HOST=10.142.0.9:8081 server/gate/scripts/deploy.sh
#
# The gate reaches hosts on their private address through Direct VPC egress,
# so hosts need no public terminal. default-allow-internal admits it.
# Its account reads HOST_PASS_SECRET and claims phone pins in the bucket:
#   gcloud iam service-accounts create brayness-gate --project "$project"
#   gcloud secrets add-iam-policy-binding HOST_PASS_SECRET --role roles/secretmanager.secretAccessor \
#     --member "serviceAccount:brayness-gate@$project.iam.gserviceaccount.com" --project "$project"
#   gcloud storage buckets add-iam-policy-binding "gs://$bucket" --role roles/storage.objectAdmin \
#     --member "serviceAccount:brayness-gate@$project.iam.gserviceaccount.com"
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
. "$root/server/scripts/service-env.sh"
account="${SERVICE_ACCOUNT:-brayness-gate@$project.iam.gserviceaccount.com}"
host="${GATE_HOST:-$(gcloud compute instances describe brayness-demo --zone us-east1-b --project "$project" --format='value(networkInterfaces[0].networkIP)'):8081}"
stage="$(bash "$root/server/scripts/stage-service.sh" gate)"

# A terminal stays open for an hour; Cloud Run's longest request.
gcloud run deploy brayness-gate \
  --project "$project" --region "$region" --source "$stage" \
  --service-account "$account" --build-service-account "projects/$project/serviceAccounts/$account" \
  --network default --subnet default --vpc-egress private-ranges-only \
  --timeout 3600 \
  --set-env-vars "^@^IDENTITY_PROJECT=$identity@PINS_BUCKET=$bucket@ORIGINS=$origins@GATE_HOST=$host" \
  --set-secrets "HOST_PASS_SECRET=HOST_PASS_SECRET:latest" \
  --allow-unauthenticated --quiet
