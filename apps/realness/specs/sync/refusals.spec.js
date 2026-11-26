/**
 * i0: a refused write leaves one item on the owner's page, with the path, the
 * action, who asked, and why it was turned away.
 */
import { after, before, it } from 'node:test'
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { randomUUID as random_uuid } from 'node:crypto'
import { read_items } from '#root/lib/items.js'
import { disk } from '#root/src/can/disk.js'
import { store_of } from '#root/src/can/store.js'
import { dev_issuer } from '#root/src/sync/dev-token.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'
import { REFUSALS_PAGE } from '#root/src/sync/refusals.js'
import { out_path } from '#root/lib/output.js'

const A = '+15555550100'
const B = '+15555550101'
const dir = out_path(`refusals-test-${random_uuid()}`)
const issuer = dev_issuer()
const storage = store_of(disk(dir))
let server
let base

before(async () => {
  server = sync_service({
    storage,
    rights: rights(storage),
    project: issuer.project,
    certs: issuer.certs,
    log: () => {}
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server.close()
  await rm(dir, { recursive: true, force: true })
})

const as = phone => ({ authorization: `Bearer ${issuer.token(phone)}` })
const call = (method, path, { headers = {}, body } = {}) =>
  fetch(`${base}/${path}`, { method, headers, body })

const refusals_for = async owner => {
  const page = await storage.get(`people/${owner}/quarantine/${REFUSALS_PAGE}`)
  return page ? read_items(page.body.toString('utf8'), 'refusal') : []
}

it("another person's write leaves the reason on the owner's page", async () => {
  const refused = await call('PUT', `people/${A}/vault/Projects/a.md`, {
    headers: as(B),
    body: 'mine now'
  })
  assert.equal(refused.status, 403)
  const found = await refusals_for(A)
  assert.equal(found.length, 1)
  assert.equal(found[0].path, `people/${A}/vault/Projects/a.md`)
  assert.equal(found[0].action, 'write')
  assert.equal(found[0].who, B)
  assert.match(found[0].reason, /does not allow write/)
})

it('a refusal outside a phone folder leaves no page', async () => {
  const refused = await call('GET', 'people/planning/posters/', {
    headers: as(B)
  })
  assert.equal(refused.status, 403)
  assert.deepEqual(await refusals_for('planning'), [])
})

it('a refused write outside a phone folder keeps no bytes', async () => {
  const refused = await call('PUT', 'people/junk/x.html', {
    headers: as(B),
    body: 'junk'
  })
  assert.equal(refused.status, 403)
  assert.equal(await storage.get(`people/junk/quarantine/${B}/x.html`), null)
  assert.deepEqual(await refusals_for('junk'), [])
})

it('a signed-out write says so, and a second refusal is listed too', async () => {
  await call('PUT', `people/${A}/vault/Projects/b.md`, { body: 'x' })
  const found = await refusals_for(A)
  assert.equal(found.length, 2)
  assert.equal(found[0].who, 'signed out')
  assert.equal(found[0].reason, 'not signed in')
  assert.equal(found[1].path, `people/${A}/vault/Projects/a.md`)
})

it('the owner reads the page beside the waiting changes', async () => {
  const page = await call('GET', `people/${A}/quarantine/${REFUSALS_PAGE}`, {
    headers: as(A)
  })
  assert.equal(page.status, 200)
  assert.match(await page.text(), /Refused writes/)
})

it('an allowed write leaves no refusal', async () => {
  const before = (await refusals_for(A)).length
  assert.equal(
    (
      await call('PUT', `people/${A}/vault/Projects/c.md`, {
        headers: as(A),
        body: 'fine'
      })
    ).status,
    200
  )
  assert.equal((await refusals_for(A)).length, before)
})

it('the page keeps the newest refusals and drops the oldest', async () => {
  for (let n = 0; n < 55; n++)
    await call('PUT', `people/${A}/vault/Projects/many-${n}.md`, {
      headers: as(B),
      body: 'x'
    })
  const found = await refusals_for(A)
  assert.equal(found.length, 50)
  assert.equal(found[0].path, `people/${A}/vault/Projects/many-54.md`)
})

it('a refused write waits in quarantine and never reaches the vault', async () => {
  const refused = await call('PUT', `people/${A}/vault/Projects/held.md`, {
    headers: as(B),
    body: 'my change\n'
  })
  assert.equal(refused.status, 403)
  assert.equal(await storage.stat(`people/${A}/vault/Projects/held.md`), null)
  const held = await storage.get(
    `people/${A}/quarantine/${B}/vault/Projects/held.md`
  )
  assert.equal(held?.body.toString(), 'my change\n')
})

it('the refusal item names where the bytes wait', async () => {
  const found = await refusals_for(A)
  assert.equal(found[0].path, `people/${A}/vault/Projects/held.md`)
  assert.equal(
    found[0].held,
    `people/${A}/quarantine/${B}/vault/Projects/held.md`
  )
})

it("a stranger's write is refused, and nothing is kept", async () => {
  await call('PUT', `people/${A}/vault/Projects/stranger.md`, { body: 'x' })
  const found = await refusals_for(A)
  assert.equal(found[0].who, 'signed out')
  assert.equal(found[0].held, 'not kept')
  assert.equal(
    await storage.stat(
      `people/${A}/quarantine/signed out/vault/Projects/stranger.md`
    ),
    null
  )
})

it('a refused delete keeps no bytes', async () => {
  await call('DELETE', `people/${A}/vault/Projects/held.md`, {
    headers: as(B)
  })
  assert.equal((await refusals_for(A))[0].action, 'delete')
  assert.equal((await refusals_for(A))[0].held, 'not kept')
})
