import assert from 'node:assert/strict'
import { after, before, it } from 'node:test'
import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { disk } from '#root/src/can/disk.js'
import { dev_issuer } from '../../src/sync/dev-token.js'
import { rights } from '../../src/sync/rights.js'
import { sync_service } from '../../src/sync/server.js'
import {
  QUIET_AFTER_MS,
  halo_health,
  quiet_halos
} from '../../src/sync/halo-watch.js'
import { out_path } from '#root/lib/output.js'
import {
  intent_now,
  lifecycle_html,
  lifecycle_key
} from '../../src/sync/halo-lifecycle.js'

const dir = out_path(`halo-watch-test-${randomUUID()}`)
const issuer = dev_issuer()
const storage = disk(dir)
const admin = '+15555550100'
const other = '+15555550101'
let server
let url

const record = (name, checked) =>
  storage.put(
    `halos/${name}/status.html`,
    `<article itemscope itemtype="/halo"><meta itemprop="name" content="${name}"><meta itemprop="checked" content="${checked}"></article>\n`
  )

before(async () => {
  await mkdir(dir, { recursive: true })
  await storage.put('admins.html', `<a href="tel:${admin}">Admin</a>`)
  await record('realness-1', '2026-10-05T12:00:00.000Z')
  await record('realness-2', '2026-10-05T11:59:30.000Z')
  server = sync_service({
    storage,
    rights: rights(storage),
    project: issuer.project,
    certs: issuer.certs,
    log: () => {}
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  url = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server.close()
  await rm(dir, { recursive: true, force: true })
})

const as = phone => ({ authorization: `Bearer ${issuer.token(phone)}` })
const at = Date.parse('2026-10-05T12:01:00Z')

it('a halo quiet past the threshold is named, with its age', async () => {
  const quiet = await quiet_halos(storage, {
    now: Date.parse('2026-10-05T12:02:30Z')
  })
  assert.deepEqual(quiet, [
    {
      name: 'realness-2',
      checked: '2026-10-05T11:59:30.000Z',
      age_s: 180,
      cause: 'unknown'
    },
    {
      name: 'realness-1',
      checked: '2026-10-05T12:00:00.000Z',
      age_s: 150,
      cause: 'unknown'
    }
  ])
})

it('a halo inside the threshold is not quiet, and the boundary is exclusive', async () => {
  const fresh = await quiet_halos(storage, {
    now: Date.parse('2026-10-05T12:01:00Z')
  })
  assert.deepEqual(fresh, [])
  const just = await quiet_halos(storage, {
    now: Date.parse('2026-10-05T12:02:00Z')
  })
  assert.deepEqual(
    just.map(h => h.name),
    ['realness-2']
  )
  const past = await quiet_halos(storage, {
    now: Date.parse('2026-10-05T12:02:01Z')
  })
  assert.deepEqual(
    past.map(h => h.name),
    ['realness-2', 'realness-1']
  )
})

it('the threshold is the report interval with room to miss three', () => {
  assert.equal(QUIET_AFTER_MS, 120_000)
})

it('a record with no readable time is quiet, not alive', async () => {
  await record('realness-3', '')
  const quiet = await quiet_halos(storage, { now: at })
  assert.deepEqual(
    quiet.map(h => h.name),
    ['realness-3']
  )
  assert.equal(quiet[0].age_s, null)
})

it('a halo directory with no record is quiet', async () => {
  await storage.put('halos/realness-4/notes.txt', 'half-made')
  const quiet = await quiet_halos(storage, { now: at })
  assert.ok(quiet.some(h => h.name === 'realness-4' && h.age_s === null))
})

it('the derived answer carries its own reading time and threshold', async () => {
  const health = await halo_health(storage, { now: at })
  assert.equal(health.checked, '2026-10-05T12:01:00.000Z')
  assert.equal(health.quiet_ms, QUIET_AFTER_MS)
  assert.ok(health.quiet.some(h => h.name === 'realness-3'))
})

it('a parked halo leaves the quiet list; every halo carries its state', async () => {
  await storage.put(
    'halos/realness-5/status.html',
    '<article itemscope itemtype="/halo"><meta itemprop="name" content="realness-5"><meta itemprop="checked" content="2026-10-05T11:00:00.000Z"></article>\n'
  )
  await storage.put(
    lifecycle_key('realness-5'),
    lifecycle_html(
      intent_now('parked', { now: Date.parse('2026-10-05T11:00:30Z') })
    )
  )
  const health = await halo_health(storage, { now: at })
  assert.ok(!health.quiet.some(h => h.name === 'realness-5'))
  assert.deepEqual(
    health.halos.find(h => h.name === 'realness-5'),
    { name: 'realness-5', state: 'parked' }
  )
  assert.equal(health.halos.find(h => h.name === 'realness-3').state, 'failed')
})

it('only an admin reads halo health, and it is never stored', async () => {
  const get = headers => fetch(`${url}/halos/quiet.json`, { headers })
  assert.equal((await get()).status, 401)
  assert.equal((await get(as(other))).status, 403)
  const body = await (await get(as(admin))).json()
  assert.ok(body.quiet.some(h => h.name === 'realness-3'))
  assert.equal(await storage.get('halos/quiet.json'), null)
})
