/**
 * sy15: a delete from any client lands in a trash the owner can restore
 * from, for 30 days. A stale version guard keeps nothing and removes nothing.
 */
import { after, before, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { disk } from '#root/src/can/disk.js'
import { client } from '#root/src/files/client.js'
import { dev_issuer } from '../../src/sync/dev-token.js'
import { rights } from '../../src/sync/rights.js'
import { sync_service } from '../../src/sync/server.js'
import { keeper } from '../../src/sync/trash.js'
import { trash_key, trashed_from } from '../../src/can/trash-keys.js'
import { out_path } from '#root/lib/output.js'

const me = '+15555550300'
const member = '+15555550301'
const dir = out_path(`trash-${randomUUID()}`)
const issuer = dev_issuer()
const storage = disk(join(dir, 'bucket'))
let server
let base

before(async () => {
  await mkdir(dir, { recursive: true })
  await storage.put('admins.html', `<a href="tel:${me}">${me}</a>`)
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

const as = phone =>
  client({
    url: base,
    token: issuer.token(phone),
    state: join(dir, `${phone}-state`)
  })

it('trash keys keep the day, the time, and the path; other trees have none', () => {
  const at = new Date('2026-10-25T10:15:30.123Z')
  const key = trash_key(`people/${me}/vault/a.md`, at)
  assert.equal(key, `trash/people/${me}/2026-10-25/101530123/vault/a.md`)
  assert.equal(trashed_from(key), `people/${me}/vault/a.md`)
  assert.equal(trash_key('commons/+x/a.md', at), null)
  assert.equal(trash_key(`trash/people/${me}/x.md`, at), null)
  assert.equal(trashed_from(`people/${me}/a.md`), null)
})

it('a deleted file is kept, listed, and restored where it was', async () => {
  const store = as(me)
  await store.put('can://~/vault/a.md', 'keep me')
  await store.rm('can://~/vault/a.md')
  assert.equal(await store.version('can://~/vault/a.md'), null)
  const kept = Object.keys(await store.trash())
  assert.equal(kept.length, 1)
  assert.match(kept[0], /^\d{4}-\d{2}-\d{2}\/\d{9}\/vault\/a\.md$/)
  assert.deepEqual(await store.walk('can://~/'), {})
  assert.equal(await store.restore(kept[0]), `can://people/${me}/vault/a.md`)
  assert.equal((await store.cat('can://~/vault/a.md')).toString(), 'keep me')
  assert.deepEqual(await store.trash(), {})
})

it('a restore never overwrites a file written since', async () => {
  const store = as(me)
  await store.put('can://~/b.md', 'old')
  await store.rm('can://~/b.md')
  await store.put('can://~/b.md', 'new')
  const [name] = Object.keys(await store.trash())
  await assert.rejects(store.restore(name), { status: 412 })
  assert.equal((await store.cat('can://~/b.md')).toString(), 'new')
  assert.deepEqual(Object.keys(await store.trash()), [name])
  await store.rm(`can://trash/people/${me}/${name}`)
  assert.deepEqual(await store.trash(), {})
})

it('a stale version guard keeps nothing and removes nothing', async () => {
  const store = as(me)
  await store.put('can://~/c.md', 'one')
  const response = await fetch(
    `${base}/people/${encodeURIComponent(me)}/c.md`,
    {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${issuer.token(me)}`,
        'if-match': '"not-the-version"'
      }
    }
  )
  assert.equal(response.status, 412)
  assert.equal((await store.cat('can://~/c.md')).toString(), 'one')
  assert.deepEqual(await store.trash(), {})
})

it('nobody else reads or writes your trash, and nobody writes it by hand', async () => {
  const store = as(me)
  await store.put('can://~/d.md', 'mine')
  await store.rm('can://~/d.md')
  const [name] = Object.keys(await store.trash())
  const path = `can://trash/people/${me}/${name}`
  await assert.rejects(as(member).cat(path), { status: 403 })
  await assert.rejects(as(member).walk(`can://trash/people/${me}/`), {
    status: 403
  })
  await assert.rejects(store.put(`can://trash/people/${me}/x.md`, 'x'), {
    status: 403
  })
  await store.rm(path)
})

it("an org's deletes go to its trash, which only the founder sees", async () => {
  const body = {
    name: '+trashy',
    founder_name: 'Me',
    members: [{ name: 'Mo', phone: member }]
  }
  const made = await fetch(`${base}/v1/orgs`, {
    method: 'POST',
    headers: { authorization: `Bearer ${issuer.token(me)}` },
    body: JSON.stringify(body)
  })
  assert.equal(made.status, 200)
  await as(member).put('can://orgs/+trashy/notes.md', 'shared')
  await as(me).rm('can://orgs/+trashy/notes.md')
  await assert.rejects(as(member).trash('+trashy'), { status: 403 })
  const [name] = Object.keys(await as(me).trash('+trashy'))
  assert.match(name, /\/notes\.md$/)
  assert.equal(
    await as(me).restore(name, '+trashy'),
    'can://orgs/+trashy/notes.md'
  )
  assert.equal(
    (await as(member).cat('can://orgs/+trashy/notes.md')).toString(),
    'shared'
  )
})

it('days older than 30 are emptied on a later delete', async () => {
  const shelf = disk(join(dir, 'shelf'))
  const keep = keeper(shelf)
  const day = 86_400_000
  const start = Date.parse('2026-09-01T12:00:00Z')
  await shelf.put(`people/${me}/old.md`, 'old')
  await keep(`people/${me}/old.md`, null, start)
  await shelf.delete(`people/${me}/old.md`)
  await shelf.put(`people/${me}/new.md`, 'new')
  await keep(`people/${me}/new.md`, null, start + 31 * day)
  const left = Object.keys(await shelf.walk(`trash/people/${me}/`))
  assert.deepEqual(
    left.map(name => name.split('/').at(-1)),
    ['new.md']
  )
})
