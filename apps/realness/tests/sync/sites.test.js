import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { disk } from '#root/src/can/disk.js'
import { issue_halo_pass } from '#root/src/sign-on/node/halo-pass.js'
import { rights } from '../../src/sync/rights.js'
import { sync_service } from '../../src/sync/server.js'
import { out_path } from '#root/lib/output.js'

const secret = 'test-secret-123456789012345678901234567890'
const id = 'a-123456789abc'
const owner = '+15555550100'
const stranger = '+15555550101'
const dir = out_path(`sites-test-${randomUUID()}`)
let server, base
const pass = phone => ({
  authorization: `Bearer ${issue_halo_pass({ phone }, secret)}`
})
const call = (method, path, { phone, body } = {}) =>
  fetch(`${base}/${path}`, { method, headers: phone ? pass(phone) : {}, body })
const status = async (...args) => (await call(...args)).status

before(async () => {
  await mkdir(dir, { recursive: true })
  const storage = disk(dir)
  server = sync_service({
    storage,
    rights: rights(storage),
    project: 'none',
    certs: async () => ({}),
    halo_pass_secret: secret,
    log: () => {}
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  server.close()
  await rm(dir, { recursive: true, force: true })
})

test('only a signed owner uploads; immutable versions remain private until activated', async () => {
  const path = `v1/sites/${id}/versions/aaaaaaaaaaaa/files/index.html`
  assert.equal(await status('PUT', path, { body: 'forged' }), 401)
  assert.equal(await status('PUT', path, { phone: owner, body: 'first' }), 201)
  assert.equal(
    await status('PUT', path, { phone: owner, body: 'overwrite' }),
    409
  )
  assert.equal(
    await status(
      'PUT',
      `v1/sites/${id}/versions/bbbbbbbbbbbb/files/index.html`,
      { phone: stranger, body: 'foreign' }
    ),
    403
  )
  assert.equal(await status('GET', `sites/${id}/`), 404)
  assert.equal(
    await status('GET', `sites/${id}/versions/aaaaaaaaaaaa/files/index.html`),
    404
  )
  assert.equal(
    await status('POST', `v1/sites/${id}/activate`, {
      phone: stranger,
      body: 'aaaaaaaaaaaa'
    }),
    403
  )
  assert.equal(
    await status('POST', `v1/sites/${id}/activate`, {
      phone: owner,
      body: 'aaaaaaaaaaaa'
    }),
    200
  )
  const page = await call('GET', `sites/${id}/`)
  assert.equal(await page.text(), 'first')
  assert.match(page.headers.get('content-type'), /text\/html/)
})

test('a missing site is never cached, so a fresh publish shows at once', async () => {
  const missing = await call('GET', 'sites/a-000000000000/')
  assert.equal(missing.status, 404)
  assert.equal(missing.headers.get('cache-control'), 'no-store')
})

test('revision, restore and removal keep the site ID and previous files', async () => {
  assert.equal(
    await status(
      'PUT',
      `v1/sites/${id}/versions/bbbbbbbbbbbb/files/index.html`,
      { phone: owner, body: 'second' }
    ),
    201
  )
  assert.equal(
    await status(
      'PUT',
      `v1/sites/${id}/versions/bbbbbbbbbbbb/files/style.css`,
      { phone: owner, body: 'body{}' }
    ),
    201
  )
  assert.equal(
    await status('POST', `v1/sites/${id}/activate`, {
      phone: owner,
      body: 'bbbbbbbbbbbb'
    }),
    200
  )
  assert.equal(await (await call('GET', `sites/${id}/`)).text(), 'second')
  assert.equal(
    (
      await (
        await call('GET', `v1/sites/${id}/versions`, { phone: owner })
      ).json()
    )[0].id,
    'aaaaaaaaaaaa'
  )
  assert.equal(
    await status('GET', `v1/sites/${id}/versions`, { phone: stranger }),
    403
  )
  assert.equal(
    await status('POST', `v1/sites/${id}/activate`, {
      phone: owner,
      body: 'aaaaaaaaaaaa'
    }),
    200
  )
  assert.equal(await (await call('GET', `sites/${id}/`)).text(), 'first')
  assert.equal(await status('GET', `sites/${id}/style.css`), 404)
  assert.equal(
    await status('DELETE', `v1/sites/${id}/active`, { phone: owner }),
    200
  )
  assert.equal(await status('GET', `sites/${id}/`), 404)
  assert.equal(
    await status('POST', `v1/sites/${id}/activate`, {
      phone: owner,
      body: 'bbbbbbbbbbbb'
    }),
    200
  )
  assert.equal(await (await call('GET', `sites/${id}/`)).text(), 'second')
})

test("a halo pass writes only its owner's site source", async () => {
  const source = `people/${owner}/work/site/index.html`
  assert.equal(
    await status('PUT', source, { phone: owner, body: 'editable' }),
    200
  )
  assert.equal(
    await status('PUT', `people/${owner}/vault/private.md`, {
      phone: owner,
      body: 'bad'
    }),
    403
  )
  assert.equal(
    await status('PUT', source, { phone: stranger, body: 'bad' }),
    403
  )
  assert.equal(await status('GET', source), 403)
  assert.equal(
    await (await call('GET', source, { phone: owner })).text(),
    'editable'
  )
})

test('bad paths, missing versions and invalid passes cannot publish', async () => {
  assert.equal(
    await status(
      'PUT',
      `v1/sites/${id}/versions/cccccccccccc/files/%252e%252e/secret`,
      { phone: owner, body: 'x' }
    ),
    403
  )
  assert.equal(await status('GET', `sites/${id}/%252e%252e/secret`), 403)
  assert.equal(
    await status('POST', `v1/sites/${id}/activate`, {
      phone: owner,
      body: 'cccccccccccc'
    }),
    404
  )
  assert.equal(
    await status(
      'PUT',
      `v1/sites/${id}/versions/cccccccccccc/files/index.html`,
      { phone: owner, body: 'x' }
    ),
    201
  )
  assert.equal(
    await status('POST', `v1/sites/${id}/activate`, {
      phone: owner,
      body: 'nonsense'
    }),
    400
  )
  assert.equal(await status('GET', `sites/${id}/owner`), 404)
  assert.equal(
    await status('GET', `v1/sites/${id}/versions`, {
      phone: owner,
      body: undefined
    }),
    200
  )
})
