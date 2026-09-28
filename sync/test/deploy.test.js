import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const deploy = readFileSync(new URL('../scripts/deploy.sh', import.meta.url), 'utf8')

/* The deploy is the only place the service's secrets and allowed origins are
   set, and both failures are silent at deploy time: no host pass secret means
   /v1/host-pass answers 503, and a missing origin means the sign-on page's
   preflight is refused. */
test('the deploy gives the service its host pass secret', () => {
  assert.match(deploy, /--set-secrets "HOST_PASS_SECRET=HOST_PASS_SECRET:latest"/)
})

test('the deploy allows the sign-on page', () => {
  assert.match(deploy, /^origins="\$\{ORIGINS:-https:\/\/brayness-sign-on\.web\.app,http:\/\/localhost:5173\}"/m)
})
