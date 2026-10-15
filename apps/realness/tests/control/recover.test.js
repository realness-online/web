/**
 * hs-f3: a failed host's actors come back on the hosts still up, and the
 * failed host loses its authority first.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  RecoverError,
  recover,
  recover_text
} from '../../src/control/recover.js'

const actors = [
  { id: 'a-111111111111', owner: '+14156660001', state: 'running' },
  { id: 'a-222222222222', owner: '+14156660002', state: 'idle' },
  { id: 'a-333333333333', owner: '+14156660003', state: 'incomplete' }
]

const fixture = ({
  bundles = {},
  refuse = {},
  hosts = ['realness-2', 'realness-3']
} = {}) => {
  const order = []
  const load = { 'realness-2': 2, 'realness-3': 0 }
  return {
    order,
    hosts,
    api: () => ({}),
    revoke: async host => {
      order.push(`revoke ${host}`)
      return { revoked_at: '2026-10-15T00:00:00.000Z' }
    },
    bundle: async id => {
      order.push(`bundle ${id}`)
      return bundles[id] === null ? null : { bundle: `gs://b/${id}.tgz` }
    },
    restore: async (host, id, owner) => {
      order.push(`restore ${host} ${id}`)
      if (refuse[id]) throw new Error('host full')
      return { id: `a-${id.slice(2, 10)}ffff` }
    },
    place: async (owner, host) => {
      order.push(`place ${owner} ${host}`)
      return { host }
    },
    load: async host => load[host] ?? 0
  }
}

test('authority is revoked before anything is restored', async () => {
  const one = fixture()
  const result = await recover('realness-1', {
    reason: 'quiet for 120s',
    actors,
    ...one
  })
  assert.deepEqual(one.order.slice(0, 2), [
    'revoke realness-1',
    'bundle a-111111111111'
  ])
  assert.equal(result.revoked, '2026-10-15T00:00:00.000Z')
  assert.equal(result.recovered.length, 2)
  assert.deepEqual(
    result.skipped,
    ['a-333333333333'],
    'no disk is not lost work'
  )
  assert.equal(one.order.filter(line => line.startsWith('revoke')).length, 1)
})

test('an actor goes to the host with the fewest actors', async () => {
  const one = fixture()
  const result = await recover('realness-1', { reason: 'x', actors, ...one })
  assert.ok(result.recovered.every(actor => actor.host === 'realness-3'))
  assert.match(
    recover_text(result),
    /\+14156660001: a-111111111111 -> a-11111111ffff on realness-3/
  )
})

test('an actor with no bundle, or a refusing host, is reported lost', async () => {
  const one = fixture({
    bundles: { 'a-222222222222': null },
    refuse: { 'a-111111111111': true }
  })
  const result = await recover('realness-1', { reason: 'x', actors, ...one })
  assert.deepEqual(result.lost, ['a-111111111111', 'a-222222222222'])
  assert.deepEqual(result.recovered, [])
  assert.ok(
    one.order.every(line => !line.startsWith('place')),
    'a person never moves to an actor that is not there'
  )
})

test('one host cannot recover from itself', async () => {
  const one = fixture({ hosts: ['realness-1'] })
  await assert.rejects(
    recover('realness-1', { reason: 'x', actors, ...one }),
    error => {
      assert.ok(error instanceof RecoverError)
      assert.match(error.message, /single point of failure/)
      return true
    }
  )
  assert.deepEqual(
    one.order,
    [],
    'nothing is revoked if nothing can take the actors'
  )
})

test('a host that reuses the old actor id stops the run', async () => {
  const one = fixture()
  one.restore = async host => {
    one.order.push(`restore ${host}`)
    return { id: 'a-111111111111' }
  }
  await assert.rejects(
    recover('realness-1', { reason: 'x', actors, ...one }),
    /reused a-111111111111/
  )
})

test('no host name is refused', async () => {
  const one = fixture()
  await assert.rejects(
    recover('', { reason: 'x', actors, ...one }),
    /needs the failed host name/
  )
})
