/**
 * k3: every file an actor returns waits in quarantine, listed on the waiting
 * page. The vault itself changes only when the person writes.
 */
import assert from 'node:assert/strict'
import { randomUUID as random_uuid } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { after, before, it } from 'node:test'
import { read_items } from '#root/lib/items.js'
import { out_path } from '#root/lib/output.js'
import { disk } from '#root/src/can/disk.js'
import { store_of } from '#root/src/can/store.js'
import { issue_harness_pass } from '#root/src/sign-on/node/recovery-pass.js'
import { dev_issuer } from '#root/src/sync/dev-token.js'
import { WAITING_PAGE } from '#root/src/sync/quarantine.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'

const secret = 'quarantine-test-secret-at-least-thirty-two-bytes!'
const issuer = dev_issuer()
const phone = '+15555550100'
const id = 'a-0123456789ab'
const dir = out_path(`quarantine-test-${random_uuid()}`)
let storage
let server
let url

before(async () => {
  await mkdir(dir, { recursive: true })
  storage = store_of(disk(join(dir, 'bucket')))
  server = sync_service({
    storage,
    rights: rights(storage),
    project: issuer.project,
    certs: issuer.certs,
    halo_pass_secret: secret,
    log: () => {}
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  url = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise(done => server.close(done))
  await rm(dir, { recursive: true, force: true })
})

const actor = {
  authorization: `Bearer ${issue_harness_pass({ phone, id }, secret)}`
}
const person = { authorization: `Bearer ${issuer.token(phone)}` }
const call = (method, path, headers, body) =>
  fetch(`${url}/${path}`, { method, headers, body })
const text_at = async key =>
  (await storage.get(key))?.body.toString('utf8') ?? null
const waiting = async () =>
  read_items(
    (await text_at(`people/${phone}/quarantine/${WAITING_PAGE}`)) ?? '',
    'change'
  )

it('an actor write waits in quarantine, and the vault stays as it was', async () => {
  const note = `people/${phone}/vault/Projects/n.md`
  const saved = await call('PUT', note, person, 'mine\n')
  assert.equal(saved.status, 200)
  const version = saved.headers.get('etag')
  const returned = await call(
    'PUT',
    note,
    { ...actor, 'if-match': version },
    'theirs\n'
  )
  assert.equal(returned.status, 202)
  assert.equal(await text_at(note), 'mine\n')
  assert.equal(
    await text_at(`people/${phone}/quarantine/${id}/vault/Projects/n.md`),
    'theirs\n'
  )
  const [change] = await waiting()
  assert.equal(change.path, 'vault/Projects/n.md')
  assert.equal(change.action, 'write')
  assert.equal(change.actor, id)
  assert.equal(`"${change.base}"`, version)
})

it('an actor delete is listed, and the file stays', async () => {
  const note = `people/${phone}/vault/keep.md`
  await call('PUT', note, person, 'kept\n')
  assert.equal((await call('DELETE', note, actor)).status, 202)
  assert.equal(await text_at(note), 'kept\n')
  const [change] = await waiting()
  assert.equal(change.action, 'delete')
  assert.equal(change.held, 'nothing kept')
})

it('a person writes straight into the vault, with nothing waiting', async () => {
  const before_count = (await waiting()).length
  const note = `people/${phone}/vault/direct.md`
  assert.equal((await call('PUT', note, person, 'direct\n')).status, 200)
  assert.equal(await text_at(note), 'direct\n')
  assert.equal((await waiting()).length, before_count)
})
