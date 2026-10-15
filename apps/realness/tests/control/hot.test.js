/**
 * hs-hot: a crowded host is relieved by moving the busiest actor off it.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  HotError,
  busiest,
  hot_hosts,
  hot_text,
  relieve
} from '../../src/control/hot.js'

const limits = { cpu_fraction: 0.9, mem_used_fraction: 0.9, actors: 30 }
const cool = { cpu_fraction: 0.1, mem_used_fraction: 0.2, actors: 3 }
const busy = { cpu_fraction: 0.95, mem_used_fraction: 0.4, actors: 5 }
const full = { cpu_fraction: 0.2, mem_used_fraction: 0.2, actors: 30 }

test('a host is named for the limit it crossed, and quiet hosts are left alone', () => {
  const hot = hot_hosts(
    [
      { name: 'realness-1', ...busy },
      { name: 'realness-2', ...cool },
      { name: 'realness-3', ...full }
    ],
    limits
  )
  assert.deepEqual(
    hot.map(({ host, because }) => [host, because]),
    [
      ['realness-1', 'cpu'],
      ['realness-3', 'actors']
    ]
  )
  assert.ok(hot[0].over_by > hot[1].over_by, 'worst first')
  assert.deepEqual(hot_hosts([{ name: 'realness-1', ...cool }], limits), [])
  assert.deepEqual(
    hot_hosts([{ name: 'realness-1', ...cool }], limits, ['realness-9']),
    [],
    'only the named hosts are considered'
  )
})

test('an unknown reading is not a limit crossed', () => {
  assert.deepEqual(
    hot_hosts(
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

test('the busiest actors are chosen first', () => {
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

test('relief moves one of the person\u2019s busiest actors to the coolest host', () => {
  const plan = relieve(
    [
      { name: 'realness-1', ...busy },
      { name: 'realness-2', ...cool },
      { name: 'realness-3', ...full }
    ],
    limits,
    {
      host: 'realness-1',
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

test('only that person\u2019s actors are moved', () => {
  const plan = relieve(
    [
      { name: 'realness-1', ...busy },
      { name: 'realness-2', ...cool }
    ],
    limits,
    {
      host: 'realness-1',
      actors: [
        { id: 'a-000000000001', owner: '+14156660002', cpu_fraction: 0.99 },
        { id: 'a-000000000002', owner: '+14156660001', cpu_fraction: 0.5 }
      ]
    },
    '+14156660001'
  )
  assert.deepEqual(plan.actors, ['a-000000000002'])
})

test('a person with no actor there, or a full fleet, is refused plainly', () => {
  const crowded = {
    host: 'realness-1',
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
    /every other host is at its limit; add a host/
  )
})
