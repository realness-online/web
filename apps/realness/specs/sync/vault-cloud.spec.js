/**
 * w1: with no Mac folder, sync serves each person's vault from storage. A
 * reader sees their own vault and hears their own changes, never another's.
 */
import { read_item, read_items } from '#root/lib/items.js'
import { after, before, it } from 'node:test'
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { request } from 'node:http'
import { randomUUID as random_uuid } from 'node:crypto'
import { disk } from '#root/src/can/disk.js'
import { store_of } from '#root/src/can/store.js'
import { dev_issuer } from '#root/src/sync/dev-token.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'
import { out_path } from '#root/lib/output.js'
import { members_html } from '#root/src/can/members.js'

const A = '+15555550100'
const B = '+15555550101'
const dir = out_path(`vault-cloud-test-${random_uuid()}`)
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

const plan = (phone, title) =>
  `---\nitemid: "/${phone}/plans/1"\n---\n\n# ${title}\n`

it('a person reads their own uploaded plans from storage', async () => {
  await storage.put(`people/${A}/vault/Projects/a.md`, plan(A, 'Mine'))
  await storage.put(`people/${B}/vault/Projects/b.md`, plan(B, 'Theirs'))
  const mine = await call('GET', 'v1/vault/projects', { headers: as(A) })
  assert.equal(mine.status, 200)
  assert.deepEqual(
    read_items(await mine.text(), 'plan').map(item => item.title),
    ['Mine']
  )
  const note = await call('GET', 'v1/vault/note?path=Projects/a.md', {
    headers: as(A)
  })
  assert.match(await note.text(), /Mine/)
})

it('a signed-out reader and another person open nothing', async () => {
  assert.equal((await call('GET', 'v1/vault/projects')).status, 404)
  const theirs = await call('GET', 'v1/vault/note?path=Projects/b.md', {
    headers: as(A)
  })
  assert.equal(theirs.status, 404)
  const item = await call(
    'GET',
    `v1/vault/item?itemid=${encodeURIComponent(`/${B}/plans/1`)}`,
    { headers: as(A) }
  )
  assert.equal(item.status, 404)
})

it('a write through sync shows on the next read', async () => {
  assert.equal(
    (
      await call('PUT', `people/${A}/vault/Projects/c.md`, {
        headers: as(A),
        body: plan(A, 'Fresh').replace('plans/1', 'plans/2')
      })
    ).status,
    200
  )
  const listed = await call('GET', 'v1/vault/projects', { headers: as(A) })
  assert.deepEqual(
    read_items(await listed.text(), 'plan')
      .map(item => item.title)
      .sort(),
    ['Fresh', 'Mine']
  )
})

it("a person hears their own vault changes, never another's", async () => {
  const heard = []
  const stream = request(
    `${base}/v1/vault/events`,
    { headers: as(B) },
    response => {
      response.setEncoding('utf8')
      response.on('data', chunk => {
        for (const line of chunk.split('\n'))
          if (line.startsWith('data: '))
            heard.push(read_item(line.slice('data: '.length), 'change')?.path)
      })
    }
  )
  stream.end()
  await new Promise(done => setTimeout(done, 50))
  await call('PUT', `people/${A}/vault/Projects/d.md`, {
    headers: as(A),
    body: 'theirs'
  })
  await call('PUT', `people/${B}/vault/Projects/e.md`, {
    headers: as(B),
    body: 'mine'
  })
  await new Promise(done => setTimeout(done, 100))
  stream.destroy()
  assert.deepEqual(heard, [`people/${B}/vault/Projects/e.md`])
})

it('x4: a member sees the plans of the orgs they are in, named by the org', async () => {
  const C = '+15555550102'
  await storage.put(
    'orgs/+team/members.html',
    members_html({
      name: '+team',
      short: 'Team',
      founder: { name: 'A', phone: A },
      members: [{ name: 'B', phone: B }]
    })
  )
  await storage.put(
    'orgs/+team/Projects/shared.md',
    plan(A, 'Shared').replace('plans/1', 'plans/9')
  )
  await storage.put(
    'orgs/+team/Projects/big/index.md',
    plan(A, 'Folder').replace('plans/1', 'plans/8')
  )
  const theirs = await call('GET', 'v1/vault/projects', { headers: as(B) })
  const plans = read_items(await theirs.text(), 'plan')
  const shared = plans.filter(item => item.area === 'Team')
  assert.deepEqual(shared.map(item => item.title).sort(), ['Folder', 'Shared'])
  assert.ok(plans.some(item => item.title === 'Theirs'))
  const outside = await call('GET', 'v1/vault/projects', { headers: as(C) })
  const seen =
    outside.status === 200 ? read_items(await outside.text(), 'plan') : []
  assert.ok(!seen.some(item => item.area === 'Team'))
  const id = encodeURIComponent(`/${A}/plans/9`)
  const opened = await call('GET', `v1/vault/item?itemid=${id}`, {
    headers: as(B)
  })
  assert.equal(opened.status, 200)
  assert.match(await opened.text(), /Shared/)
  const refused = await call('GET', `v1/vault/item?itemid=${id}`, {
    headers: as(C)
  })
  assert.equal(refused.status, 404)
})

it('x5: a member opens an org dashboard by its itemid; others do not', async () => {
  await storage.put(
    'orgs/+team/Resources/dashboard.md',
    '---\nitemid: "/' +
      A +
      '/pages/7"\ntitle: Team dashboard\nlayout: app\n---\n\n# Team dashboard\n\n| Stories |\n| --- |\n| 12 |\n'
  )
  const id = encodeURIComponent(`/${A}/pages/7`)
  const opened = await call('GET', `v1/vault/item?itemid=${id}`, {
    headers: as(B)
  })
  assert.equal(opened.status, 200)
  const page = read_item(await opened.text(), 'note')
  assert.equal(page.title, 'Team dashboard')
  assert.match(page.text, /\| 12 \|/)
  const outside = await call('GET', `v1/vault/item?itemid=${id}`, {
    headers: as('+15555550102')
  })
  assert.equal(outside.status, 404)
})
