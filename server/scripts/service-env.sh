#!/usr/bin/env bash
# The development environment every Cloud Run service deploys into, in one
# place, so sync, proxy, and gate cannot drift apart. Each value can be
# overridden from the environment; production waits for promotion.
project="${PROJECT:-realness-development}"
region="${REGION:-us-central1}"
bucket="${BUCKET:-$project.firebasestorage.app}"
identity="${IDENTITY_PROJECT:-$project}"
origins="${ORIGINS:-https://realness-development.web.app,https://realness-development.firebaseapp.com,https://realness.local,http://localhost:5173}"
