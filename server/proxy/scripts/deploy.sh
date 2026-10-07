#!/usr/bin/env bash
# Stage the proxy and deploy it to Cloud Run.
#
# The proxy shares sync's phone pins, so it defaults to the same project and
# bucket sync uses. Deployment needs the target project to already hold
# MODEL_PASS_SECRET and OPENROUTER_API_KEY, and the service account below.
#
#   server/proxy/scripts/deploy.sh                     realness-development
#   PROJECT=... BUCKET=... server/proxy/scripts/deploy.sh
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
. "$root/server/scripts/service-env.sh"
account="${SERVICE_ACCOUNT:-brayness-proxy@$project.iam.gserviceaccount.com}"
stage="$(bash "$root/server/scripts/stage-service.sh" proxy)"

# Payments turn on once server/proxy/scripts/stripe-setup.js has stored both secrets.
secrets="MODEL_PASS_SECRET=MODEL_PASS_SECRET:latest,OPENROUTER_API_KEY=OPENROUTER_API_KEY:latest"
if gcloud secrets describe STRIPE_SECRET_KEY --project "$project" > /dev/null 2>&1 &&
  gcloud secrets describe STRIPE_WEBHOOK_SECRET --project "$project" > /dev/null 2>&1; then
  secrets="$secrets,STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest,STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest"
  echo "payments: on"
else
  echo "payments: off (run server/proxy/scripts/stripe-setup.js)"
fi
# The pay page reads /limit and starts checkout from these browser origins.

gcloud run deploy brayness-proxy \
  --project "$project" --region "$region" --source "$stage" \
  --service-account "$account" --build-service-account "projects/$project/serviceAccounts/$account" \
  --set-env-vars "^@^IDENTITY_PROJECT=$identity@PINS_BUCKET=$bucket@ORIGINS=$origins" \
  --set-secrets "$secrets" \
  --allow-unauthenticated --quiet
