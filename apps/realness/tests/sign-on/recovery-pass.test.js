import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { disk } from '#root/src/can/disk.js'
import { rights } from '#root/src/sync/rights.js'
import { sign_pass } from '#root/src/can/pass.js'
import {
  harness_path,
  issue_harness_pass,
  issue_recovery_pass,
  recovery_path,
  verify_harness_pass,
  verify_recovery_pass
} from '#root/src/sign-on/node/recovery-pass.js'
import { sync_service } from '#root/src/sync/server.js'

const secret = 'recovery-test-secret-at-least-thirty-two-bytes'
const phone = '+14155550123'
const id = 'a-abcdef123456'
const dir = new URL(
  `../../../../artifacts/realness/recovery-pass-${randomUUID()}/`,
  import.meta.url
).pathname
let server, url

before(async () => {
  await mkdir(dir, { recursive: true })
  const storage = disk(dir)
  await storage.put(`people/${phone}/.pi/agent/sessions/test.jsonl`, 'history')
  await storage.put(`people/${phone}/vault/secret.md`, 'private')
  await storage.put(
    `people/${phone}/vault/95% Of Your Problems.md`,
    'percentage note'
  )
  server = sync_service({
    storage,
    rights: rights(storage),
    project: 'none',
    certs: async () => ({}),
    halo_pass_secret: secret,
    log: () => {}
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  url = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  server.closeAllConnections()
  await new Promise(done => server.close(done))
  await rm(dir, { recursive: true, force: true })
})

const call = (pass, path, method = 'GET') =>
  fetch(`${url}/${path}`, {
    method,
    headers: { authorization: `Bearer ${pass}` }
  })

test('a pass reads, never writes, anything its owner holds', async () => {
  const pass = issue_recovery_pass({ phone, id }, secret)
  assert.deepEqual(verify_recovery_pass(pass, secret), {
    phone,
    id,
    paths: null
  })
  const folder = `people/${phone}/.pi/agent/sessions/`
  assert.equal((await call(pass, `${folder}?deep`)).status, 200)
  assert.equal(
    await (await call(pass, `${folder}test.jsonl`)).text(),
    'history'
  )
  assert.equal(
    (await call(pass, `people/${phone}/work/thoughts/note.md`)).status,
    404
  )
  assert.equal(
    await (await call(pass, `people/${phone}/vault/secret.md`)).text(),
    'private'
  )
  assert.equal(
    (await call(pass, `people/+14155559999/.pi/agent/sessions/test.jsonl`))
      .status,
    403
  )
  assert.equal((await call(pass, `${folder}test.jsonl`, 'PUT')).status, 403)
  assert.equal((await call(pass, `${folder}test.jsonl`, 'DELETE')).status, 403)
  assert.equal((await call(pass, 'v1/halo-pass', 'POST')).status, 401)
  assert.equal(
    recovery_path(
      `people/${phone}/.pi/agent/sessions/../vault/secret.md`,
      phone
    ),
    false
  )
  assert.equal(
    recovery_path(`people/${phone}/.pi/agent/sessions/.env`, phone),
    false
  )
  assert.equal(
    recovery_path(`people/${phone}/.pi/agent/deferred.json`, phone),
    true
  )
  assert.equal(
    recovery_path(`people/${phone}/.pi/agent/auth.json`, phone),
    false
  )
})

test('percentage filenames keep recovery passes read-only and path-limited', async () => {
  const path = 'vault/95% Of Your Problems.md'
  const pass = issue_recovery_pass({ phone, id, paths: [path] }, secret)
  const key = `people/${phone}/${encodeURI(path)}`
  assert.equal(await (await call(pass, key)).text(), 'percentage note')
  assert.equal((await call(pass, key, 'PUT')).status, 403)
  assert.equal(
    (await call(pass, `people/${phone}/vault/secret.md`)).status,
    403
  )
  for (const path of [
    'vault/%2e%2e/secret',
    'vault/%252F',
    'vault/%00',
    'vault/%5c'
  ])
    assert.throws(() =>
      issue_recovery_pass({ phone, id, paths: [path] }, secret)
    )
})

test("a harness pass writes only its owner's safe harness paths", async () => {
  const pass = issue_harness_pass({ phone, id }, secret)
  assert.deepEqual(verify_harness_pass(pass, secret), {
    phone,
    id,
    paths: null
  })
  assert.throws(() => verify_recovery_pass(pass, secret))
  assert.throws(() =>
    verify_harness_pass(issue_recovery_pass({ phone, id }, secret), secret)
  )
  const key = `people/${phone}/harness/apps/blog/post.md`
  assert.equal((await call(pass, key, 'PUT')).status, 200)
  assert.equal((await call(pass, key)).status, 200)
  assert.equal((await call(pass, key, 'DELETE')).status, 204)
  for (const path of [
    `people/+14155559999/harness/note.md`,
    `people/${phone}/vault/note.md`,
    `people/${phone}/harness/.pi/agent/auth.json`,
    `people/${phone}/harness/apps/.env`,
    `people/${phone}/harness/artifacts/note.md`
  ])
    assert.equal((await call(pass, path, 'PUT')).status, 403, path)
  assert.equal((await call(pass, 'v1/halo-pass', 'POST')).status, 401)
  assert.equal(
    harness_path(`people/${phone}/harness/vault/%2e%2e/note.md`, phone),
    false
  )
  const limited = issue_harness_pass(
    { phone, id, paths: ['apps/blog'] },
    secret
  )
  assert.equal((await call(limited, key, 'PUT')).status, 200)
  assert.equal(
    (await call(limited, `people/${phone}/harness/apps/other/post.md`, 'PUT'))
      .status,
    403
  )
  assert.equal(
    (await call(limited, `people/${phone}/harness/?deep`)).status,
    403
  )
  const expired = issue_harness_pass(
    { phone, id },
    secret,
    Date.now() - 600_000
  )
  assert.equal((await call(expired, key, 'PUT')).status, 401)
  assert.equal((await call(pass.slice(0, -2) + 'xx', key, 'PUT')).status, 401)
})

test('a forged or expired pass cannot read history', async () => {
  const pass = issue_recovery_pass({ phone, id }, secret)
  assert.equal(
    (
      await call(
        pass.slice(0, -2) + 'xx',
        `people/${phone}/.pi/agent/sessions/test.jsonl`
      )
    ).status,
    401
  )
  assert.throws(() => verify_recovery_pass(pass, secret, Date.now() + 301000))
})

test('a pass limited to paths reads only those', async () => {
  const pass = issue_recovery_pass(
    { phone, id, paths: ['.pi/agent/sessions'] },
    secret
  )
  assert.deepEqual(verify_recovery_pass(pass, secret).paths, [
    '.pi/agent/sessions'
  ])
  assert.equal(
    await (
      await call(pass, `people/${phone}/.pi/agent/sessions/test.jsonl`)
    ).text(),
    'history'
  )
  assert.equal(
    (await call(pass, `people/${phone}/vault/secret.md`)).status,
    403
  )
  assert.equal(
    (await call(pass, `people/${phone}/?deep`)).status,
    403,
    'no listing above the limit'
  )
  assert.equal(
    recovery_path(`people/${phone}/.pi/agent/sessions-extra/x`, phone, [
      '.pi/agent/sessions'
    ]),
    false
  )
  assert.throws(() =>
    issue_recovery_pass({ phone, id, paths: ['../x'] }, secret)
  )
  assert.throws(() =>
    issue_recovery_pass({ phone, id, paths: ['.pi/agent/auth.json'] }, secret)
  )
})

test('hs-f2: a pass names the halo that issued it, when given', async () => {
  const { issue_harness_pass, verify_harness_pass } =
    await import('#root/src/sign-on/node/recovery-pass.js')
  const key = 'pass-host-secret-at-least-thirty-two-bytes!!'
  const claims = { phone: '+14155550100', id: 'a-000000000001' }
  assert.equal(
    verify_harness_pass(
      issue_harness_pass({ ...claims, halo: 'realness-1' }, key),
      key
    ).halo,
    'realness-1'
  )
  assert.equal(
    verify_harness_pass(issue_harness_pass(claims, key), key).halo,
    undefined
  )
  assert.throws(
    () => issue_harness_pass({ ...claims, halo: '../x' }, key),
    /bad halo name/
  )
})

test('a recovery pass names its halo only as halo', () => {
  const old = sign_pass(
    { aud: 'realness-recovery', phone, id, host: 'realness-1' },
    secret,
    { life_s: 300 }
  )
  assert.equal(verify_recovery_pass(old, secret).halo, undefined)
  const pass = issue_recovery_pass({ phone, id, halo: 'realness-1' }, secret)
  assert.equal(verify_recovery_pass(pass, secret).halo, 'realness-1')
})
