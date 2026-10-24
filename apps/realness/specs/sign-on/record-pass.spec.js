/**
 * A halo's record pass (o1): halos hold no storage key, so they write their
 * status and loop records through sync, signed with the halo secret.
 */
import assert from 'node:assert/strict'
import { after, before, it } from 'node:test'
import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { disk } from '#root/src/can/disk.js'
import { dev_issuer } from '#root/src/sync/dev-token.js'
import {
  issue_halo_pass,
  issue_record_pass,
  verify_halo_pass,
  verify_record_pass
} from '#root/src/sign-on/node/halo-pass.js'
import { rights } from '#root/src/sync/rights.js'
import { sign_pass } from '#root/src/can/pass.js'
import { sync_service } from '#root/src/sync/server.js'
import { out_path } from '#root/lib/output.js'

const secret = 'test-secret-123456789012345678901234567890'
const other_secret = 'other-secret-12345678901234567890123456789'
const phone_secret = 'phone-secret-12345678901234567890123456789'
const A = '+15555550100'
const loop = 'a-0123456789ab'
const issuer = dev_issuer()
const dir = out_path(`record-pass-test-${randomUUID()}`)
const storage = disk(dir)
let server, base

before(async () => {
  await mkdir(dir, { recursive: true })
  await storage.put('halo-keys/realness-1', secret)
  await storage.put('halo-keys/realness-2', other_secret)
  await storage.put('halo-keys/realness-legacy', secret)
  server = sync_service({
    storage,
    rights: rights(storage),
    project: issuer.project,
    certs: issuer.certs,
    halo_pass_secret: phone_secret,
    log: () => {}
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server.close()
  await rm(dir, { recursive: true, force: true })
})

const as_halo = (name, now) => ({
  authorization: `Bearer ${issue_record_pass(name, secret, now)}`
})
const status = async (method, path, headers, body) =>
  (await fetch(`${base}/${path}`, { method, headers, body })).status

it("a record pass names a halo and is never a phone's halo pass", () => {
  const pass = issue_record_pass('realness-1', secret)
  assert.deepEqual(verify_record_pass(pass, secret), { halo: 'realness-1' })
  assert.throws(() => verify_halo_pass(pass, secret))
  assert.throws(() =>
    verify_record_pass(issue_halo_pass({ phone: A }, secret), secret)
  )
  assert.throws(() =>
    verify_record_pass(pass, 'another-secret-1234567890123456789012345')
  )
  for (const bad of ['', 'Realness', 'a/b', '../x', '-x', 'x'.repeat(64)])
    assert.throws(() => issue_record_pass(bad, secret))
  const old = issue_record_pass('realness-1', secret, Date.now() - 301_000)
  assert.throws(() => verify_record_pass(old, secret))
})

it('a halo writes its own status and loop records, and nothing else', async () => {
  const me = as_halo('realness-1')
  assert.equal(
    await status(
      'PUT',
      'halos/realness-1/status.html',
      me,
      '<article></article>'
    ),
    200
  )
  assert.equal(await status('GET', 'halos/realness-1/status.html', me), 200)
  assert.equal(
    await status('PUT', 'halos/realness-2/status.html', me, 'forged'),
    403
  )
  assert.equal(await status('PUT', 'halos/realness-1/other.html', me, 'x'), 403)
  assert.equal(await status('GET', 'halos/', me), 403)
  assert.equal(
    await status('PUT', `loops/${loop}/record.html`, me, '<article></article>'),
    200
  )
  assert.equal(await status('GET', `loops/${loop}/stop.html`, me), 404)
  assert.equal(await status('PUT', `loops/${loop}/stop.html`, me, 'stop'), 403)
  assert.equal(await status('DELETE', `loops/${loop}/record.html`, me), 403)
  assert.equal(await status('GET', 'usage/', me), 403)
  assert.equal(await status('GET', `people/${A}/`, me), 403)
  assert.equal(await status('GET', 'admins.html', me), 403)
  assert.equal(await status('GET', 'halo-keys/realness-1', me), 403)
  assert.equal(
    await status('GET', 'halo-keys/realness-1', {
      authorization: `Bearer ${issuer.token(A)}`
    }),
    403
  )
})

it('canonical halo routes enforce the same record authority', async () => {
  assert.equal(
    await status(
      'PUT',
      'halos/realness-1/status.html',
      as_halo('realness-1'),
      'halo'
    ),
    200
  )
  assert.equal(
    await status('GET', 'halos/realness-1/status.html', as_halo('realness-1')),
    200
  )
  assert.equal(
    await status(
      'PUT',
      'halos/realness-2/status.html',
      as_halo('realness-1'),
      'forged'
    ),
    403
  )
  assert.equal(
    await status('GET', 'halo-keys/realness-1', as_halo('realness-1')),
    403
  )
})

it('legacy record keys still authenticate during the halo migration', async () => {
  assert.equal(
    await status(
      'PUT',
      'halos/realness-legacy/status.html',
      as_halo('realness-legacy'),
      'legacy'
    ),
    200
  )
})

it("a phone's halo pass, an expired pass, or none cannot write halo records", async () => {
  const phone = {
    authorization: `Bearer ${issue_halo_pass({ phone: A }, phone_secret)}`
  }
  assert.equal(
    await status('PUT', 'halos/realness-1/status.html', phone, 'forged'),
    403
  )
  assert.equal(
    await status(
      'PUT',
      'halos/realness-1/status.html',
      as_halo('realness-1', Date.now() - 301_000),
      'x'
    ),
    401
  )
  assert.equal(
    await status('PUT', 'halos/realness-1/status.html', {}, 'x'),
    403
  )
  assert.equal(
    await status(
      'PUT',
      'halos/realness-2/status.html',
      as_halo('realness-2'),
      'x'
    ),
    401
  )
  assert.equal(
    await status(
      'PUT',
      'halos/realness-3/status.html',
      as_halo('realness-3'),
      'x'
    ),
    401
  )
})

it('a record pass naming its halo only as host is refused', () => {
  const old = sign_pass(
    { aud: 'realness-records', host: 'realness-1' },
    secret,
    {
      life_s: 300
    }
  )
  assert.throws(() => verify_record_pass(old, secret), /record pass/)
  assert.equal(
    JSON.parse(
      Buffer.from(
        issue_record_pass('realness-1', secret).split('.')[0],
        'base64url'
      ).toString()
    ).host,
    undefined
  )
})
