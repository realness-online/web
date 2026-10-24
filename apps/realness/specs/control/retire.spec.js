/**
 * hs-n4: a halo stops only after its actors have moved off it.
 */
import assert from 'node:assert/strict'
import { it } from 'node:test'
import { RetireError, retire } from '../../src/control/retire.js'

const fixtures = (actors = []) => {
  const asked = []
  const api = { call: async () => JSON.stringify({ actors }) }
  const placements = {
    release: async halo => {
      asked.push(`release ${halo}`)
      return actors.length
    }
  }
  const halo = {
    stop: async name => asked.push(`stop ${name}`),
    drop: async name => asked.push(`drop ${name}`)
  }
  return { asked, api, placements, halo }
}

it('a halo still holding an actor is not retired', async () => {
  const { asked, api, placements, halo } = fixtures([
    { id: 'a-1', state: 'running' },
    { id: 'a-2', state: 'idle' }
  ])
  await assert.rejects(retire(api, placements, halo, 'realness-1'), error => {
    assert.ok(error instanceof RetireError)
    assert.match(error.message, /realness-1 still holds 2 actor\(s\): a-1, a-2/)
    return true
  })
  assert.deepEqual(asked, [], 'nothing is released or stopped')
})

it('a halo with no live actor stops, and its people are released to move', async () => {
  const { asked, api, placements, halo } = fixtures([
    { id: 'a-1', state: 'incomplete' }
  ])
  const result = await retire(api, placements, halo, 'realness-1')
  assert.deepEqual(result, {
    halo: 'realness-1',
    actors: 1,
    released: 1,
    deleted: false
  })
  assert.deepEqual(asked, ['release realness-1', 'stop realness-1'])
})

it('--delete takes the halo away instead of stopping it', async () => {
  const { asked, api, placements, halo } = fixtures([])
  const result = await retire(api, placements, halo, 'realness-2', {
    delete: true
  })
  assert.equal(result.deleted, true)
  assert.deepEqual(asked, ['release realness-2', 'drop realness-2'])
})

it('a halo that does not answer is an error, not a retirement', async () => {
  const api = {
    call: async () => {
      throw new Error('ssh refused')
    }
  }
  const { asked, placements, halo } = fixtures([])
  await assert.rejects(
    retire(api, placements, halo, 'realness-1'),
    /ssh refused/
  )
  assert.deepEqual(asked, [])
})
