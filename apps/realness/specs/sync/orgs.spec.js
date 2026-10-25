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
  assert.deepEqual(mine, { orgs: [FAMILY] })
  const client = await (await call('GET', 'v1/orgs', client_a)).json()
  assert.deepEqual(client, { orgs: [CLIENT_A] })
  assert.equal(await status('GET', 'v1/orgs', null), 401)
})

const id = 'a-000000000001'
const by_pass = (pass, method, path, body) =>
  fetch(`${base}/${path}`, {
    method,
    headers: { authorization: `Bearer ${pass}` },
    body
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

it('the founder publishes to commons; anyone reads it', async () => {
  const file = `commons/${FAMILY}/recipe.html`
  assert.equal(await status('PUT', file, daughter, 'soup'), 403)
  assert.equal(await status('PUT', file, me, 'soup'), 200)
  assert.equal(await (await call('GET', file, null)).text(), 'soup')
  assert.equal(await status('GET', `commons/${FAMILY}/`, client_b), 200)
  assert.equal(await status('DELETE', file, daughter), 403)
  assert.equal(await status('DELETE', file, me), 204)
})

const publish = (phone, path) =>
  fetch(`${base}/v1/publish`, {
    method: 'POST',
    headers: phone ? as(phone) : {},
    body: JSON.stringify({ path })
  })

it('publishing copies an org file to commons, frozen until republished', async () => {
  const from = `orgs/${FAMILY}/recipes/soup.html`
  const to = `commons/${FAMILY}/recipes/soup.html`
  await call('PUT', from, me, 'v1')
  const first = await publish(me, from)
  assert.equal(first.status, 200)
  assert.equal((await first.json()).path, to)
  await call('PUT', from, me, 'v2')
  assert.equal(await (await call('GET', to, null)).text(), 'v1')
  assert.equal((await publish(me, from)).status, 200)
  assert.equal(await (await call('GET', to, null)).text(), 'v2')
})

it('only the founder publishes, and never the members page or secrets', async () => {
  const from = `orgs/${FAMILY}/notes.md`
  assert.equal((await publish(daughter, from)).status, 403)
  assert.equal((await publish(client_a, from)).status, 403)
  assert.equal((await publish(null, from)).status, 401)
  assert.equal((await publish(me, `orgs/${FAMILY}/members.html`)).status, 400)
  assert.equal((await publish(me, `orgs/${FAMILY}/.env`)).status, 403)
  assert.equal((await publish(me, `people/${me}/vault/x.md`)).status, 400)
  assert.equal((await publish(me, `orgs/${FAMILY}/missing.md`)).status, 404)
  const pass = issue_harness_pass({ phone: me, id }, secret)
  const by_harness = await fetch(`${base}/v1/publish`, {
    method: 'POST',
    headers: { authorization: `Bearer ${pass}` },
    body: JSON.stringify({ path: from })
  })
  assert.equal(by_harness.status, 401)
})
