import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { disk } from '#root/src/can/disk.js'
import { dev_issuer } from '#root/src/sync/dev-token.js'
import {
  issue_host_pass,
  verify_host_pass
} from '#root/src/sign-on/node/host-pass.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'
import { out_path } from '#root/lib/output.js'

const secret = 'test-secret-123456789012345678901234567890'
const issuer = dev_issuer()
const dir = out_path(`host-pass-test-${randomUUID()}`)
let server, base

before(async () => {
  await mkdir(dir, { recursive: true })
  const storage = disk(dir)
  server = sync_service({
    storage,
    rights: rights(storage),
    project: issuer.project,
    certs: issuer.certs,
    host_pass_secret: secret,
    log: () => {}
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server.close()
  await rm(dir, { recursive: true, force: true })
})

const request = token =>
  fetch(`${base}/v1/host-pass`, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {}
  })

test('only a pinned phone token gets a pass the host accepts', async () => {
  const response = await request(issuer.token('+15555550100'))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const { pass, expires_in } = await response.json()
  assert.equal(expires_in, 300)
  assert.deepEqual(verify_host_pass(pass, secret), { phone: '+15555550100' })
  assert.equal((await request()).status, 401)
  assert.equal((await request('not-a-token')).status, 401)
  assert.equal(
    (await request(issuer.token('+15555550100', { uid: 'other' }))).status,
    401
  )
  assert.equal(
    (await request(issuer.token('+15555550100', { lifetime: -10 }))).status,
    401
  )
})

test('forged, expired, and foreign passes fail', () => {
  const now = 1_800_000_000_000
  const pass = issue_host_pass({ phone: '+15555550100' }, secret, now)
  assert.deepEqual(verify_host_pass(pass, secret, now), {
    phone: '+15555550100'
  })
  assert.throws(() =>
    verify_host_pass(pass, 'another-secret-123456789012345678901234', now)
  )
  assert.throws(() => verify_host_pass(pass.replace(/.$/, 'x'), secret, now))
  assert.throws(() => verify_host_pass(pass, secret, now + 301_000))
  assert.throws(() => issue_host_pass({ phone: 'invalid' }, secret))
  assert.throws(() => issue_host_pass({ phone: '+15555550100' }, 'short'))
})
