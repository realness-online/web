#!/usr/bin/env bash
# Service accounts, roles, and pass secrets the sync, proxy, and gate deploys expect.
# Each service builds its own source with its own account; sync also reads
# compute so it can label quiet hosts (hs-m7b).
# Safe to rerun: existing accounts, secrets, and bindings are kept.
#   bash tools/control/scripts/service-accounts.sh production
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
. "$root/server/scripts/service-env.sh" "${1:?usage: service-accounts.sh development|production}"
g() { gcloud "$@" --project "$project" --quiet > /dev/null; }

echo "apis"
g services enable cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com \
  secretmanager.googleapis.com compute.googleapis.com iap.googleapis.com

for name in HOST_PASS_SECRET MODEL_PASS_SECRET; do
  if gcloud secrets describe "$name" --project "$project" > /dev/null 2>&1; then
    echo "secret $name: kept"
  else
    openssl rand -hex 32 | tr -d '\n' | g secrets create "$name" --data-file=-
    echo "secret $name: created"
  fi
done

secret_access() { g secrets add-iam-policy-binding "$2" --member="serviceAccount:$1" --role=roles/secretmanager.secretAccessor --condition=None; }
for service in sync proxy gate; do
  account="realness-$service@$project.iam.gserviceaccount.com"
  gcloud iam service-accounts describe "$account" --project "$project" > /dev/null 2>&1 ||
    g iam service-accounts create "realness-$service" --display-name "realness $service"
  g projects add-iam-policy-binding "$project" --member="serviceAccount:$account" --role=roles/run.builder --condition=None
  g storage buckets add-iam-policy-binding "gs://$bucket" --member="serviceAccount:$account" --role=roles/storage.objectAdmin
  echo "account $account: ready"
done

secret_access "realness-sync@$project.iam.gserviceaccount.com" HOST_PASS_SECRET
secret_access "realness-gate@$project.iam.gserviceaccount.com" HOST_PASS_SECRET
for name in MODEL_PASS_SECRET OPENROUTER_API_KEY STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET; do
  gcloud secrets describe "$name" --project "$project" > /dev/null 2>&1 &&
    secret_access "realness-proxy@$project.iam.gserviceaccount.com" "$name"
done
g projects add-iam-policy-binding "$project" --member="serviceAccount:realness-sync@$project.iam.gserviceaccount.com" \
  --role=roles/compute.viewer --condition=None
echo "secrets and roles: ready"
