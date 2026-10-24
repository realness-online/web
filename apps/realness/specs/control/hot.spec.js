/**
 * hs-hot: a crowded halo is relieved by moving the busiest actor off it.
 */
import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  HotError,
  busiest,
  hot_halos,
  hot_text,
  relieve
} from '../../src/control/hot.js'

const limits = { cpu_fraction: 0.9, mem_used_fraction: 0.9, actors: 30 }
const cool = { cpu_fraction: 0.1, mem_used_fraction: 0.2, actors: 3 }
const busy = { cpu_fraction: 0.95, mem_used_fraction: 0.4, actors: 5 }
const full = { cpu_fraction: 0.2, mem_used_fraction: 0.2, actors: 30 }

it('a halo is named for the limit it crossed, and quiet halos are left alone', () => {
  const hot = hot_halos(
    [
      { name: 'realness-1', ...busy },
      { name: 'realness-2', ...cool },
      { name: 'realness-3', ...full }
    ],
    limits
  )
  assert.deepEqual(
    hot.map(({ halo, because }) => [halo, because]),
    [
      ['realness-1', 'cpu'],
      ['realness-3', 'actors']
    ]
  )
  assert.ok(hot[0].over_by > hot[1].over_by, 'worst first')
  assert.deepEqual(hot_halos([{ name: 'realness-1', ...cool }], limits), [])
  assert.deepEqual(
    hot_halos([{ name: 'realness-1', ...cool }], limits, ['realness-9']),
    [],
    'only the named halos are considered'
  )
})

it('an unknown reading is not a limit crossed', () => {
  assert.deepEqual(
    hot_halos(
      [
        {
          name: 'realness-1',
          cpu_fraction: null,
          mem_used_fraction: null,
          actors: 1
        }
      ],
      limits
    ),
    []
  )
})

it('the busiest actors are chosen first', () => {
  const actors = [
    { id: 'a-000000000001', owner: '+1', cpu_fraction: 0.1, mem_mib: 500 },
    { id: 'a-000000000002', owner: '+1', cpu_fraction: 0.9, mem_mib: 10 },
    { id: 'a-000000000003', owner: '+1', cpu_fraction: 0.9, mem_mib: 900 }
  ]
  assert.deepEqual(
    busiest(actors, 2).map(actor => actor.id),
    ['a-000000000003', 'a-000000000002']
  )
  assert.equal(
    busiest(actors, 9).length,
    3,
    'asking for more than there are is fine'
  )
})

it('relief moves one of the person\u2019s busiest actors to the coolest halo', () => {
  const plan = relieve(
    [
      { name: 'realness-1', ...busy },
      { name: 'realness-2', ...cool },
      { name: 'realness-3', ...full }
    ],
    limits,
    {
      halo: 'realness-1',
      actors: [
        { id: 'a-000000000001', owner: '+14156660001', cpu_fraction: 0.9 },
        { id: 'a-000000000002', owner: '+14156660002', cpu_fraction: 0.2 }
      ]
    },
    '+14156660001'
  )
  assert.deepEqual(plan, {
    owner: '+14156660001',
    from: 'realness-1',
    because: 'cpu',
    to: 'realness-2',
    actors: ['a-000000000001']
  })
  assert.match(
    hot_text([plan]),
    /move a-000000000001 from realness-1 to realness-2 \(cpu\)/
  )
})

it('only that person\u2019s actors are moved', () => {
  const plan = relieve(
    [
      { name: 'realness-1', ...busy },
      { name: 'realness-2', ...cool }
    ],
    limits,
    {
      halo: 'realness-1',
      actors: [
        { id: 'a-000000000001', owner: '+14156660002', cpu_fraction: 0.99 },
        { id: 'a-000000000002', owner: '+14156660001', cpu_fraction: 0.5 }
      ]
    },
    '+14156660001'
  )
  assert.deepEqual(plan.actors, ['a-000000000002'])
})

it('a person with no actor there, or a full fleet, is refused plainly', () => {
  const crowded = {
    halo: 'realness-1',
    actors: [{ id: 'a-000000000001', owner: '+14156660001' }]
  }
  assert.throws(
    () =>
      relieve(
        [
          { name: 'realness-1', ...busy },
          { name: 'realness-2', ...cool }
        ],
        limits,
        crowded,
        '+14156660009'
      ),
    HotError
  )
  assert.throws(
    () =>
      relieve(
        [
          { name: 'realness-1', ...busy },
          { name: 'realness-2', ...full }
        ],
        limits,
        crowded,
        '+14156660001'
      ),
    /every other halo is at its limit; add a halo/
  )
})

it('the fields halo hot reads are the fields a halo reports', async () => {
  const { read_status } = await import('#root/src/sync/halo-status.js')
  const { HaloStatus } = await import('#root/src/halo/status.js')
  let written = ''
  const store = {
    list: () => [],
    seedStatus: () => ({ built: true, matches: true }),
    volume: '/tmp',
    activity: () => null
  }
  const status = new HaloStatus(store, {
    halo: 'realness-1',
    mirror: {
      put: async (key, body) => {
        written = body
      }
    },
    resources: () => ({
      mem_available: 1024,
      actor_taps_used: 1,
      actor_taps_limit: 254,
      resource_error: null
    })
  })
  assert.equal(await status.publish(), true)
  const record = read_status(written)
  for (const name of ['mem_total', 'mem_free', 'actors_running', 'actors_idle'])
    assert.ok(Object.hasOwn(record.halo, name), `a halo record carries ${name}`)
  assert.ok(
    Number(record.halo.mem_total) > 0,
    'mem_total is bytes, which is what the share in use is computed from'
  )
})
