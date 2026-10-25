/**
 * An org's life over sync: start it (sh4), change members (sh5), narrow a
 * subfolder (sh2, sh3), sync it to a member's machine (o3), then leave and
 * close it (o7).
 */
import { after, before, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { disk } from '#root/src/can/disk.js'
import { client } from '#root/src/files/client.js'
import { dev_issuer } from '../../src/sync/dev-token.js'
import { rights } from '../../src/sync/rights.js'
import { sync_service } from '../../src/sync/server.js'
import { sync_org } from '../../src/harness/harness.js'
import { members_html } from '../../src/can/members.js'
import { issue_harness_pass } from '../../src/sign-on/node/recovery-pass.js'
import { out_path } from '#root/lib/output.js'

const me = '+15555550200'
const partner = '+15555550201'
const intern = '+15555550202'
const outsider = '+15555550203'
const dir = out_path(`org-life-${randomUUID()}`)
const issuer = dev_issuer()
const secret = 'org-life-secret-at-least-thirty-two-bytes!!'
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

const headers = phone =>
  phone ? { authorization: `Bearer ${issuer.token(phone)}` } : {}
const call = (method, path, phone, body) =>
  fetch(`${base}/${path}`, { method, headers: headers(phone), body })
const status = async (...args) => (await call(...args)).status
const post = (path, phone, body = {}) =>
  call('POST', path, phone, JSON.stringify(body))
const store_for = (phone, name) =>
  client({
    url: base,
    token: issuer.token(phone),
    state: join(dir, `${name}-state`),
    trash: join(dir, `${name}-trash`)
  })

it('sh4: only an admin starts an org, once, as its founder', async () => {
  const body = {
    name: '+acme',
    founder_name: 'Scott',
    members: [
      { name: 'Pat', phone: partner },
      { name: 'Ivy', phone: intern }
    ]
  }
  assert.equal((await post('v1/orgs', partner, body)).status, 403)
  assert.equal((await post('v1/orgs', null, body)).status, 401)
  assert.equal((await post('v1/orgs', me, { name: 'Acme' })).status, 400)
  assert.equal(
    (await post('v1/orgs', me, { name: '+bad', members: [{ phone: 'x' }] }))
      .status,
    400
  )
  assert.equal((await post('v1/orgs', me, body)).status, 200)
  assert.equal((await post('v1/orgs', me, body)).status, 412)
  const page = await (
    await call('GET', 'orgs/+acme/members.html', intern)
  ).text()
  assert.match(page, /<span itemprop="name">Ivy<\/span>/)
  assert.match(page, /<h1 itemprop="name">\+acme<\/h1>/)
})

it('sh5: the founder adds and removes members; nobody else can', async () => {
  const add = { add: [{ name: 'Oz', phone: outsider }] }
  assert.equal((await post('v1/orgs/+acme/members', partner, add)).status, 403)
  const added = await post('v1/orgs/+acme/members', me, add)
  assert.deepEqual((await added.json()).members, [
    me,
    partner,
    intern,
    outsider
  ])
  assert.equal(await status('PUT', 'orgs/+acme/hello.md', outsider, 'hi'), 200)
  const removed = await post('v1/orgs/+acme/members', me, {
    remove: [outsider]
  })
  assert.equal(removed.status, 200)
  assert.equal(await status('GET', 'orgs/+acme/hello.md', outsider), 403)
  assert.equal(
    (await post('v1/orgs/+acme/members', me, { remove: [me] })).status,
    400
  )
})

it('sh2, sh3: a subfolder list narrows; it never widens', async () => {
  const narrow = members_html({
    name: '+acme',
    founder: { phone: me },
    members: [{ phone: partner }, { phone: outsider }]
  })
  assert.equal(
    await status('PUT', 'orgs/+acme/money/members.html', partner, narrow),
    403
  )
  assert.equal(
    await status('PUT', 'orgs/+acme/money/members.html', me, narrow),
    200
  )
  assert.equal(await status('PUT', 'orgs/+acme/money/q3.md', partner, '$'), 200)
  assert.equal(await status('GET', 'orgs/+acme/money/q3.md', intern), 403)
  assert.equal(await status('GET', 'orgs/+acme/money/q3.md', outsider), 403)
  assert.equal(await status('GET', 'orgs/+acme/hello.md', intern), 200)
  const listed = await (await call('GET', 'orgs/+acme/?deep', intern)).json()
  assert.ok(listed['hello.md'])
  assert.equal(listed['money/q3.md'], undefined)
  const folders = await (await call('GET', 'orgs/+acme/', intern)).json()
  assert.equal(folders.folders.includes('money'), false)
})

it('o3: an org folder syncs to a member, narrowed, and stops when they go', async () => {
  const local = join(dir, 'ivy', 'orgs', '+acme')
  await mkdir(local, { recursive: true })
  const store = store_for(intern, 'ivy')
  const first = await sync_org(store, local, 'orgs/+acme', {})
  assert.ok(first.report)
  assert.equal(await readFile(join(local, 'hello.md'), 'utf8'), 'hi')
  assert.equal(existsSync(join(local, 'members.html')), false)
  assert.equal(existsSync(join(local, 'money', 'q3.md')), false)
  await writeFile(join(local, 'from-ivy.md'), 'mine')
  await sync_org(store, local, 'orgs/+acme', {})
  assert.equal(await status('GET', 'orgs/+acme/from-ivy.md', me), 200)

  await post('v1/orgs/+acme/members', me, { remove: [intern] })
  const after_removal = await sync_org(store, local, 'orgs/+acme', {})
  assert.equal(after_removal.refused, 'not a member of this org')
  assert.equal(await readFile(join(local, 'hello.md'), 'utf8'), 'hi')
  await post('v1/orgs/+acme/members', me, { add: [{ phone: intern }] })
})

it('o3: a harness pass syncs only the orgs its task names', async () => {
  const id = 'a-000000000002'
  const pass = issue_harness_pass(
    { phone: partner, id, paths: ['orgs/+acme'] },
    secret
  )
  const store = client({
    url: base,
    token: pass,
    phone: partner,
    state: join(dir, 'vm-state'),
    trash: join(dir, 'vm-trash')
  })
  const local = join(dir, 'vm', 'orgs', '+acme')
  await mkdir(local, { recursive: true })
  const { report } = await sync_org(store, local, 'orgs/+acme', {})
  assert.ok(report)
  assert.equal(await readFile(join(local, 'money', 'q3.md'), 'utf8'), '$')
  assert.equal(existsSync(join(local, 'members.html')), false)
  assert.equal(existsSync(join(local, 'money', 'members.html')), false)
})

it('o7: a member leaves; the founder cannot', async () => {
  assert.equal((await post('v1/orgs/+acme/leave', me)).status, 409)
  assert.equal((await post('v1/orgs/+acme/leave', outsider)).status, 403)
  assert.equal((await post('v1/orgs/+acme/leave', intern)).status, 200)
  assert.equal(await status('GET', 'orgs/+acme/hello.md', intern), 403)
  const orgs = await (await call('GET', 'v1/orgs', intern)).json()
  assert.deepEqual(orgs, { orgs: [] })
})

it('o7: only the founder closes, after confirming; files land in their archive', async () => {
  await status('PUT', 'orgs/+acme/report.html', me, 'final')
  await post('v1/publish', me, { path: 'orgs/+acme/report.html' })
  assert.equal(await status('GET', 'commons/+acme/report.html', null), 200)
  assert.equal(
    (await post('v1/orgs/+acme/close', partner, { confirm: '+acme' })).status,
    403
  )
  assert.equal((await post('v1/orgs/+acme/close', me, {})).status, 400)
  const closed = await post('v1/orgs/+acme/close', me, { confirm: '+acme' })
  assert.equal(closed.status, 200)
  const { archive, withdrawn } = await closed.json()
  assert.equal(withdrawn, 1)
  assert.ok(archive.startsWith(`people/${me}/archive/orgs/+acme/`))
  assert.equal(
    await (await call('GET', `${archive}money/q3.md`, me)).text(),
    '$'
  )
  assert.equal(await status('GET', `${archive}hello.md`, partner), 403)
  assert.equal(await status('GET', 'orgs/+acme/hello.md', partner), 403)
  assert.equal(await status('GET', 'commons/+acme/report.html', null), 404)
  const orgs = await (await call('GET', 'v1/orgs', partner)).json()
  assert.deepEqual(orgs, { orgs: [] })
})
