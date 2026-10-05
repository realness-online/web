import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const deploy = readFileSync(new URL('../scripts/deploy.sh', import.meta.url), 'utf8')
const service = readFileSync(new URL('../bin/sync-service.js', import.meta.url), 'utf8')

/* The deploy is the only place the service's secrets and allowed origins are
   set, and both failures are silent at deploy time: no host pass secret means
   /v1/host-pass answers 503, and a missing origin means the sign-on page's
   preflight is refused. */
test('the deploy gives the service its host pass secret', () => {
  assert.match(deploy, /secrets="HOST_PASS_SECRET=HOST_PASS_SECRET:latest"/)
  assert.match(deploy, /--set-secrets "\$secrets"/)
})

/* Alerts arrive only when both secrets exist; a one-sided secret would make
   the deploy fail or wake the endpoint with no webhook to post to. */
test('the deploy turns host alerts on only when both secrets exist', () => {
  assert.match(deploy, /gcloud secrets describe ALERT_TOKEN/)
  assert.match(deploy, /gcloud secrets describe HOST_ALERT_WEBHOOK/)
  assert.match(deploy, /secrets="\$secrets,ALERT_TOKEN=ALERT_TOKEN:latest,HOST_ALERT_WEBHOOK=HOST_ALERT_WEBHOOK:latest"/)
})

/* Sync sleeps between calls, so the alert clock must be the scheduler job. */
test('sync is scaled to zero', () => {
  assert.match(deploy, /--min-instances 0/)
  assert.doesNotMatch(deploy, /--min-instances 1/)
})

/* A deploy that names one secret and a service that reads another is a silent
   401 on every scheduled run. */
test('the service reads the alert secrets the deploy sets', () => {
  assert.match(service, /alert_token: process\.env\.ALERT_TOKEN/)
  assert.match(service, /alert_webhook: process\.env\.HOST_ALERT_WEBHOOK/)
})

test('the deploy allows the sign-on page', () => {
  assert.match(deploy, /^origins="\$\{ORIGINS:-https:\/\/brayness-sign-on\.web\.app,http:\/\/localhost:5173\}"/m)
})
