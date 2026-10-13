import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync as exec_file_sync, spawnSync as spawn_sync } from 'node:child_process'
import { fileURLToPath as file_url_to_path } from 'node:url'
import test from 'node:test'

const deploy = readFileSync(new URL('../scripts/deploy.sh', import.meta.url), 'utf8')
const service = readFileSync(new URL('../bin/sync-service.js', import.meta.url), 'utf8')

test('the deploy gives the service its host pass secret', () => {
  assert.match(deploy, /secrets="HOST_PASS_SECRET=HOST_PASS_SECRET:latest"/)
  assert.match(deploy, /--set-secrets "\$secrets"/)
})

test('the deploy turns host alerts on only when both secrets exist', () => {
  assert.match(deploy, /gcloud secrets describe ALERT_TOKEN/)
  assert.match(deploy, /gcloud secrets describe HOST_ALERT_WEBHOOK/)
  assert.match(deploy, /secrets="\$secrets,ALERT_TOKEN=ALERT_TOKEN:latest,HOST_ALERT_WEBHOOK=HOST_ALERT_WEBHOOK:latest"/)
})

test('sync is scaled to zero', () => {
  assert.match(deploy, /--min-instances 0/)
  assert.doesNotMatch(deploy, /--min-instances 1/)
})

test('the service reads the alert secrets the deploy sets', () => {
  assert.match(service, /alert_token: process\.env\.ALERT_TOKEN/)
  assert.match(service, /alert_webhook: process\.env\.HOST_ALERT_WEBHOOK/)
})

const service_env = readFileSync(new URL('../../scripts/service-env.sh', import.meta.url), 'utf8')

test('every deploy reads the shared environment, with the sign-in page allowed', () => {
  for (const service_name of ['sync', 'proxy', 'gate']) {
    const script = readFileSync(new URL(`../../${service_name}/scripts/deploy.sh`, import.meta.url), 'utf8')
    assert.match(script, /scripts\/service-env\.sh/, service_name)
  }
  assert.match(service_env, /src\/settings\/cli\.js.*shell deploy/)
  const path = file_url_to_path(new URL('../../scripts/service-env.sh', import.meta.url))
  const env = { ...process.env, PROJECT: '', BUCKET: '', IDENTITY_PROJECT: '', ORIGINS: '' }
  const output = exec_file_sync('bash', ['-e', '-c', 'source "$1" development; printf "%s\\n" "$bucket" "$origins"', 'deploy-test', path], { env, encoding: 'utf8' })
  assert.ok(output.startsWith('realness-development.firebasestorage.app\n'))
  assert.ok(output.includes('https://realness-development.web.app,'))
  const missing = spawn_sync('bash', ['-e', '-c', 'source "$1"', 'deploy-test', path], { env, encoding: 'utf8' })
  assert.notEqual(missing.status, 0)
  assert.equal(missing.stdout, '')
})
