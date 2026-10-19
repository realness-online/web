#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
. "$root/server/scripts/service-env.sh"
account="${SERVICE_ACCOUNT:-realness-proxy@$project.iam.gserviceaccount.com}"
stage="$(bash "$root/server/scripts/stage-service.sh" proxy)"

secrets="MODEL_PASS_SECRET=MODEL_PASS_SECRET:latest,OPENROUTER_API_KEY=OPENROUTER_API_KEY:latest"
if gcloud secrets describe STRIPE_SECRET_KEY --project "$project" > /dev/null 2>&1 &&
  gcloud secrets describe STRIPE_WEBHOOK_SECRET --project "$project" > /dev/null 2>&1; then
  secrets="$secrets,STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest,STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest"
  echo "payments: on"
else
  echo "payments: off (run server/proxy/scripts/stripe-setup.js)"
fi

if gcloud secrets describe OPERATOR_SECRET --project "$project" > /dev/null 2>&1; then
  secrets="$secrets,OPERATOR_SECRET=OPERATOR_SECRET:latest"
  echo "usage report: on"
else
  echo "usage report: off (add OPERATOR_SECRET to turn it on)"
fi

gcloud run deploy realness-proxy \
  --project "$project" --region "$region" --source "$stage" \
  --service-account "$account" --build-service-account "projects/$project/serviceAccounts/$account" \
  --set-env-vars "^@^IDENTITY_PROJECT=$identity@PINS_BUCKET=$bucket@ORIGINS=$origins" \
  --set-secrets "$secrets" \
  --min-instances 0 \
  --allow-unauthenticated --quiet
