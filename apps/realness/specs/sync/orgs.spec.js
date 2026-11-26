/**
 * Orgs end to end over sync: family, business, and one org per client.
 * An org's name is its folder: orgs/+family/.
 */
import { after, before, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { disk } from '#root/src/can/disk.js'
import { dev_issuer } from '../../src/sync/dev-token.js'
import { rights } from '../../src/sync/rights.js'
import { orgs_of } from '../../src/sync/orgs.js'
import { sync_service } from '../../src/sync/server.js'
import { out_path } from '#root/lib/output.js'
import { issue_harness_pass } from '../../src/sign-on/node/recovery-pass.js'

const me = '+15555550100'
const daughter = '+15555550101'
const partner = '+15555550102'
const client_a = '+15555550103'
const client_b = '+15555550104'
const dir = out_path(`orgs-test-${randomUUID()}`)
const issuer = dev_issuer()
const secret = 'orgs-test-secret-at-least-thirty-two-bytes!'
const storage = disk(dir)
let server
let base

const as = phone => ({ authorization: `Bearer ${issuer.token(phone)}` })
const call = (method, path, phone, body) =>
  fetch(`${base}/${path}`, { method, headers: phone ? as(phone) : {}, body })
const status = async (...args) => (await call(...args)).status
const person = (prop, phone, tag) =>
  `<${tag} itemprop="${prop}" itemscope itemtype="https://schema.org/Person">
    <span itemprop="telephone">${phone}</span></${tag}>`
const members = (founder, ...others) =>
  `<article itemscope itemtype="https://schema.org/Organization">
    ${person('founder', founder, 'p')}
    <ul>${others.map(p => person('member', p, 'li')).join('')}</ul>
  </article>`
const FAMILY = '+family'
const BUSINESS = '+business'
const CLIENT_A = '+client-a'
const CLIENT_B = '+client-b'
const NEW = '+new'

before(async () => {
  await mkdir(dir, { recursive: true })
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
  await storage.put('admins.html', `<a href="tel:${me}">${me}</a>`)
  const start = [
    [FAMILY, members(me, daughter)],
    [BUSINESS, members(me, partner)],
    [CLIENT_A, members(me, client_a)],
    [CLIENT_B, members(me, client_b)]
  ]
  for (const [name, page] of start)
    assert.equal(
      await status('PUT', `orgs/${name}/members.html`, me, page),
      200
    )
  for (const [name] of start) {
    assert.equal(await status('PUT', `orgs/${name}/notes.md`, me, name), 200)
  }
})

after(async () => {
  server.close()
  await rm(dir, { recursive: true, force: true })
})

it('I reach every org', async () => {
  for (const name of [FAMILY, BUSINESS, CLIENT_A, CLIENT_B])
    assert.equal(await status('GET', `orgs/${name}/notes.md`, me), 200)
})

it('my daughter reaches family and nothing else', async () => {
  assert.equal(await status('GET', `orgs/${FAMILY}/notes.md`, daughter), 200)
  for (const name of [BUSINESS, CLIENT_A, CLIENT_B])
    assert.equal(await status('GET', `orgs/${name}/notes.md`, daughter), 403)
})

it('a client never reaches another client', async () => {
  assert.equal(await status('GET', `orgs/${CLIENT_A}/notes.md`, client_a), 200)
  assert.equal(await status('GET', `orgs/${CLIENT_B}/notes.md`, client_a), 403)
  assert.equal(await status('GET', `orgs/${FAMILY}/notes.md`, client_a), 403)
  assert.equal(await status('GET', `orgs/${CLIENT_A}/notes.md`, null), 403)
})

it('a member cannot rewrite the members page or claim an org', async () => {
  assert.equal(
    await status(
      'PUT',
      `orgs/${CLIENT_A}/members.html`,
      client_a,
      members(client_a, client_b)
    ),
    403
  )
  assert.equal(
    await status(
      'PUT',
      `orgs/${NEW}/members.html`,
      client_a,
      members(client_a)
    ),
    403
  )
})

it('an admin starts an org only as its founder', async () => {
  assert.equal(
    await status('PUT', `orgs/${NEW}/members.html`, me, members(client_a, me)),
    400
  )
  assert.equal(
    await status('PUT', `orgs/${NEW}/members.html`, me, members(me)),
    200
  )
})

it('members write but only the founder deletes', async () => {
  const file = `orgs/${BUSINESS}/plan.md`
  assert.equal(await status('PUT', file, partner, 'draft'), 200)
  assert.equal(await status('DELETE', file, partner), 403)
  assert.equal(await status('DELETE', file, me), 204)
})

it('a removed member is refused on their next request', async () => {
  await call('PUT', `orgs/${BUSINESS}/members.html`, me, members(me))
  assert.equal(await status('GET', `orgs/${BUSINESS}/notes.md`, partner), 403)
  await call('PUT', `orgs/${BUSINESS}/members.html`, me, members(me, partner))
  assert.equal(await status('GET', `orgs/${BUSINESS}/notes.md`, partner), 200)
})

it('my org list comes from scanning the members pages', async () => {
  assert.deepEqual(
    (await orgs_of(storage, me)).sort(),
    [BUSINESS, CLIENT_A, CLIENT_B, FAMILY, NEW].sort()
  )
  assert.deepEqual(await orgs_of(storage, daughter), [FAMILY])
  assert.deepEqual(await orgs_of(storage, client_b), [CLIENT_B])
})

it('GET v1/orgs lists only the orgs the caller is in', async () => {
  const mine = await (await call('GET', 'v1/orgs', daughter)).json()
  assert.equal(mine.admin, false)
  assert.deepEqual(
    mine.orgs.map(org => org.name),
    [FAMILY]
  )
  assert.deepEqual(mine.orgs[0].founder, me)
  assert.deepEqual(
    mine.orgs[0].people.map(person => person.phone).sort(),
    [me, daughter].sort()
  )
  const client = await (await call('GET', 'v1/orgs', client_a)).json()
  assert.deepEqual(
    client.orgs.map(org => org.name),
    [CLIENT_A]
  )
  assert.equal(await status('GET', 'v1/orgs', null), 401)
  const admin = await (await call('GET', 'v1/orgs', me)).json()
  assert.equal(admin.admin, true)
})

it('n4: anyone reads who runs the network, founder first', async () => {
  const network = await (await call('GET', 'v1/network', null)).json()
  assert.deepEqual(network.people, [{ name: '', phone: me, role: 'founder' }])
  await storage.put('orgs/+realness/members.html', members(me, daughter))
  const org = await (await call('GET', 'v1/network', null)).json()
  assert.deepEqual(
    org.people.map(person => [person.phone, person.role]),
    [
      [me, 'founder'],
      [daughter, 'member']
    ]
  )
  await storage.delete('orgs/+realness/members.html')
})

const id = 'a-000000000001'
const by_pass = (pass, method, path, body) =>
  fetch(`${base}/${path}`, {
    method,
    headers: { authorization: `Bearer ${pass}` },
    body
  })

it("sh8: chat lists and changes orgs as its owner, with the owner's rights", async () => {
  const chat = issue_harness_pass({ phone: me, id }, secret)
  const stranger = issue_harness_pass({ phone: partner, id }, secret)
  const listed = await (await by_pass(chat, 'GET', 'v1/orgs')).json()
  assert.ok(listed.orgs.some(org => org.name === FAMILY))
  const add = JSON.stringify({ add: [{ name: 'Kit', phone: client_b }] })
  assert.equal(
    (await by_pass(stranger, 'POST', `v1/orgs/${FAMILY}/members`, add)).status,
    403
  )
  assert.equal(
    (await by_pass(chat, 'POST', `v1/orgs/${FAMILY}/members`, add)).status,
    200
  )
  const made = JSON.stringify({ name: '+chat-made' })
  assert.equal((await by_pass(stranger, 'POST', 'v1/orgs', made)).status, 403)
  assert.equal((await by_pass(chat, 'POST', 'v1/orgs', made)).status, 200)
  const drop = JSON.stringify({ remove: [client_b] })
  assert.equal(
    (await by_pass(chat, 'POST', `v1/orgs/${FAMILY}/members`, drop)).status,
    200
  )
})

it("a harness reaches its owner's orgs, with the owner's rights", async () => {
  const pass = issue_harness_pass({ phone: partner, id }, secret)
  const file = `orgs/${BUSINESS}/harness.md`
  assert.equal((await by_pass(pass, 'PUT', file, 'x')).status, 200)
  assert.equal((await by_pass(pass, 'GET', file)).status, 200)
  assert.equal((await by_pass(pass, 'DELETE', file)).status, 403)
  assert.equal(
    (await by_pass(pass, 'GET', `orgs/${FAMILY}/notes.md`)).status,
    403
  )
  assert.equal(
    (
      await by_pass(
        pass,
        'PUT',
        `orgs/${BUSINESS}/members.html`,
        members(partner)
      )
    ).status,
    403
  )
  assert.equal(
    (await by_pass(pass, 'GET', `orgs/${BUSINESS}/members.html`)).status,
    403
  )
  assert.equal(
    (await by_pass(pass, 'PUT', `orgs/${BUSINESS}/.env`, 'k')).status,
    403
  )
})

it('a harness pass limited to paths reaches only the orgs it names', async () => {
  const pass = issue_harness_pass(
    { phone: me, id, paths: [`orgs/${CLIENT_A}`] },
    secret
  )
  assert.equal(
    (await by_pass(pass, 'GET', `orgs/${CLIENT_A}/notes.md`)).status,
    200
  )
  assert.equal(
    (await by_pass(pass, 'GET', `orgs/${CLIENT_B}/notes.md`)).status,
    403
  )
})

it('a harness loses an org the moment its owner does', async () => {
  const pass = issue_harness_pass({ phone: partner, id }, secret)
  await call('PUT', `orgs/${BUSINESS}/members.html`, me, members(me))
  assert.equal(
    (await by_pass(pass, 'GET', `orgs/${BUSINESS}/notes.md`)).status,
    403
  )
  await call('PUT', `orgs/${BUSINESS}/members.html`, me, members(me, partner))
})

it('o4: publish is gone', async () => {
  const gone = await fetch(`${base}/v1/publish`, {
    method: 'POST',
    headers: as(me),
    body: JSON.stringify({ path: `orgs/${FAMILY}/notes.md` })
  })
  assert.notEqual(gone.status, 200)
  assert.equal(await status('PUT', `commons/${FAMILY}/x.html`, me, 'x'), 403)
})

it('o2: a grant naming an org reaches its members, and no one else', async () => {
  const GRANTED = '+granted'
  const private_folder = `people/${me}/vault/Sessions/`
  const file = `${private_folder}a.html`
  const grant = (grantee, type) => `
    <li itemscope itemtype="https://schema.org/DigitalDocumentPermission">
      <meta itemprop="grantee" content="${grantee}">
      <meta itemprop="permissionType" content="https://schema.org/${type}Permission">
      <a itemprop="about" href="/${me}/vault/Sessions/">Sessions</a>
    </li>`
  assert.equal(
    await status(
      'PUT',
      `orgs/${GRANTED}/members.html`,
      me,
      members(me, daughter)
    ),
    200
  )
  assert.equal(
    await status(
      'PUT',
      `people/${me}/rights.html`,
      me,
      `<ul>${grant(`/${GRANTED}`, 'Read')}</ul>`
    ),
    200
  )
  assert.equal(await status('PUT', file, me, 'secret'), 200)
  assert.equal(await status('GET', file, daughter), 200)
  assert.equal(await status('GET', private_folder, daughter), 200)
  assert.equal(await status('GET', file, partner), 403)
  assert.equal(await status('GET', private_folder, partner), 403)
  assert.equal(await status('GET', file, null), 403)
  assert.equal(
    await status('PUT', `${private_folder}b.html`, daughter, 'x'),
    403
  )
})

it('o2: a write grant to an org lets a member write there', async () => {
  const GRANTED = '+granted'
  const folder = `people/${me}/vault/Sessions/`
  const grant = (grantee, type) => `
    <li itemscope itemtype="https://schema.org/DigitalDocumentPermission">
      <meta itemprop="grantee" content="${grantee}">
      <meta itemprop="permissionType" content="https://schema.org/${type}Permission">
      <a itemprop="about" href="/${me}/vault/Sessions/">Sessions</a>
    </li>`
  assert.equal(
    await status(
      'PUT',
      `people/${me}/rights.html`,
      me,
      `<ul>${grant(`/${GRANTED}`, 'Write')}</ul>`
    ),
    200
  )
  assert.equal(
    await status('PUT', `${folder}draft.html`, daughter, 'draft'),
    200
  )
  assert.equal(await status('GET', `${folder}draft.html`, me), 200)
  assert.equal(await status('PUT', `${folder}other.html`, partner, 'x'), 403)
})

it('o2: removing a member ends their granted reads', async () => {
  const GRANTED = '+granted'
  const file = `people/${me}/vault/Sessions/a.html`
  assert.equal(await status('GET', file, daughter), 200)
  assert.equal(
    await status('PUT', `orgs/${GRANTED}/members.html`, me, members(me)),
    200
  )
  assert.equal(await status('GET', file, daughter), 403)
})

it('o2: a grant naming the commons reaches anyone', async () => {
  const file = `people/${me}/vault/Sessions/a.html`
  const grant = (grantee, type) => `
    <li itemscope itemtype="https://schema.org/DigitalDocumentPermission">
      <meta itemprop="grantee" content="${grantee}">
      <meta itemprop="permissionType" content="https://schema.org/${type}Permission">
      <a itemprop="about" href="/${me}/vault/Sessions/">Sessions</a>
    </li>`
  assert.equal(
    await status(
      'PUT',
      `people/${me}/rights.html`,
      me,
      `<ul>${grant('commons', 'Read')}</ul>`
    ),
    200
  )
  assert.equal(await status('GET', file, null), 200)
  assert.equal(await status('GET', file, partner), 200)
  assert.equal(await status('PUT', file, null, 'x'), 403)
  assert.equal(await status('PUT', file, partner, 'x'), 403)
})
