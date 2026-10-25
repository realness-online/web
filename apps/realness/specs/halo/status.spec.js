import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  HaloStatus,
  activity_fields,
  read_status,
  status_html
} from '../../src/halo/status.js'

const A = '+14155550123'

const fake_store = (volume = '/') => ({
  volume,
  seed_status: () => ({ built: true, matches: true }),
  list: () => [
    {
      id: 'a-000000000001',
      owner: A,
      state: 'running',
      created: '2026-09-30T10:00:00Z',
      last_activity: '2026-09-30T12:00:00Z'
    },
    {
      id: 'a-000000000002',
      owner: A,
      state: 'idle',
      created: '2026-09-30T09:00:00Z',
      last_activity: '2026-09-30T11:00:00Z'
    },
    {
      id: 'a-000000000003',
      owner: null,
      state: 'incomplete',
      created: '',
      last_activity: ''
    }
  ]
})
const fake_apps = {
  list: () => [{ id: 'p-000000000001', owner: A, public: false }]
}
const fake_loops = {
  all: () => [
    { id: 'a-000000000002', status: 'running' },
    { id: 'a-000000000009', status: 'stopped' }
  ]
}

it('a status record reads back as the halo, its actors, and its apps', async () => {
  const now = new Date('2026-09-30T12:00:30Z')
  const status = new HaloStatus(fake_store(), {
    apps: fake_apps,
    loops: fake_loops,
    halo: 'realness-1',
    now: () => now
  })
  const read = read_status(status_html(await status.snapshot()))
  assert.equal(read.halo.name, 'realness-1')
  assert.equal(read.halo.checked, now.toISOString())
  assert.equal(read.halo.seed, 'ready')
  assert.equal(read.halo.actors_running, '1')
  assert.equal(read.halo.actors_idle, '1')
  assert.equal(read.halo.loops_running, '1')
  assert.equal(read.halo.apps, '1')
  assert.equal(
    read.halo.actors_busy,
    undefined,
    'unknown activity is absent, not zero'
  )
  assert.ok(Number(read.halo.mem_total) > 0)
  assert.ok(Number(read.halo.volume_size) > 0)
  assert.deepEqual(
    read.actors.map(actor => [actor.id, actor.owner, actor.state]),
    [
      ['a-000000000001', A, 'running'],
      ['a-000000000002', A, 'idle'],
      ['a-000000000003', '', 'incomplete']
    ]
  )
  assert.deepEqual(
    read.apps.map(app => [app.id, app.owner, app.public]),
    [['p-000000000001', A, 'false']]
  )
})

it('values are escaped, so a record cannot inject markup', () => {
  const html = status_html({
    halo: { name: `x"><script>` },
    actors: [{ id: 'a<b', owner: '&' }],
    apps: []
  })
  assert.ok(!html.includes('<script>'))
  const read = read_status(html)
  assert.equal(read.halo.name, `x"><script>`)
  assert.equal(read.actors[0].id, 'a<b')
  assert.equal(read.actors[0].owner, '&')
})

it('publish writes halos/<name>/status.html; no mirror writes nothing', async () => {
  const puts = []
  const mirror = { put: async (key, body) => puts.push([key, body]) }
  await new HaloStatus(fake_store(), { mirror, halo: 'realness-1' }).publish()
  assert.equal(puts.length, 1)
  assert.equal(puts[0][0], 'halos/realness-1/status.html')
  assert.equal(read_status(puts[0][1]).halo.name, 'realness-1')
  assert.equal(
    await new HaloStatus(fake_store(), { halo: 'realness-1' }).publish(),
    false
  )
})

it('a failed write is reported and never thrown', async () => {
  const mirror = {
    put: async () => {
      throw new Error('503 from storage')
    }
  }
  const warned = []
  const status = new HaloStatus(fake_store(), {
    mirror,
    halo: 'realness-1',
    warn: message => warned.push(message)
  })
  assert.equal(await status.publish(), false)
  assert.match(warned[0], /503 from storage/)
})

it('a volume that cannot be read reports zero, and the record still writes', async () => {
  const status = new HaloStatus(fake_store('/no/such/volume'), { halo: 'h' })
  const read = read_status(status_html(await status.snapshot()))
  assert.equal(read.halo.volume_size, '0')
  assert.equal(read.actors.length, 3)
})

it('held work reaches the record by kind', () => {
  assert.deepEqual(
    activity_fields({ actors: 2, kinds: { turn: 1, browser: 1 } }),
    {
      actors_busy: 2,
      held_connection: 0,
      held_turn: 1,
      held_loop: 0,
      held_exec: 0,
      held_browser: 1
    }
  )
  assert.deepEqual(activity_fields(undefined), {})
})
