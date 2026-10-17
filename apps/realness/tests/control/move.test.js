/**
 * hs-n3: an actor moves to another halo with its files and its identity.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MoveError, move } from '../../src/control/move.js'

const id = 'a-abcdef123456'
const owner = '+14156667777'

const fixture = ({
  restore = {},
  bundle_fails = false,
  place_fails = false
} = {}) => {
  const asked = []
  const manifest = {
    schema: 1,
    id,
    artifacts: { sha256: 'ab', path: 'artifacts.tar.gz' }
  }
  const from = {
    call: async (path, options) => {
      asked.push(`from ${options?.method ?? 'GET'} ${path}`)
      if (path.endsWith('/export')) return JSON.stringify(manifest)
      return ''
    },
    json: async () => ({ halo: { name: 'realness-1' } })
  }
  const to = {
    call: async (path, options) => {
      asked.push(`to ${options?.method ?? 'GET'} ${path}`)
      return JSON.stringify({ id: 'a-999999999999', owner, ...restore })
    },
    json: async () => ({})
  }
  const bundle = async actor => {
    asked.push(`bundle ${actor}`)
    if (bundle_fails) throw new Error('upload failed')
    return { object: `gs://bucket/actors/${actor}/bundle.tar.gz` }
  }
  const place = async (phone, halo) => {
    asked.push(`place ${phone} ${halo}`)
    if (place_fails) throw new Error('placement refused')
    return { phone, halo, placed: true }
  }
  return { asked, from, to, bundle, place }
}

test('an actor is exported, restored, placed, and only then removed', async () => {
  const one = fixture()
  const result = await move(id, owner, {
    from: one.from,
    to: one.to,
    bundle: one.bundle,
    place: one.place,
    halo: 'realness-2'
  })
  assert.deepEqual(result, {
    from_actor: id,
    to_actor: 'a-999999999999',
    halo: 'realness-2',
    placed: 'realness-2'
  })
  assert.deepEqual(one.asked, [
    'from POST /v1/actors/' + id + '/export',
    'bundle ' + id,
    'to POST /v1/actors',
    'place ' + owner + ' realness-2',
    'from DELETE /v1/actors/' + id
  ])
})

test('a restore that reuses the old id, or changes owner, is refused', async () => {
  const reused = fixture({ restore: { id } })
  await assert.rejects(
    move(id, owner, { ...reused, halo: 'realness-2' }),
    /reused the old actor id/
  )
  const stranger = fixture({ restore: { owner: '+14155550000' } })
  await assert.rejects(
    move(id, owner, { ...stranger, halo: 'realness-2' }),
    /belongs to \+14155550000/
  )
  assert.ok(
    reused.asked.every(line => !line.startsWith('place ')),
    'a refused restore never moves the person'
  )
})

test('nothing is moved when the bundle never reaches the bucket', async () => {
  const one = fixture({ bundle_fails: true })
  await assert.rejects(
    move(id, owner, { ...one, halo: 'realness-2' }),
    /upload failed/
  )
  assert.deepEqual(one.asked, [
    'from POST /v1/actors/' + id + '/export',
    'bundle ' + id
  ])
})

test('the old actor stays when the placement refuses', async () => {
  const one = fixture({ place_fails: true })
  await assert.rejects(
    move(id, owner, { ...one, halo: 'realness-2' }),
    /placement refused/
  )
  assert.ok(
    one.asked.every(line => !line.startsWith('from DELETE')),
    'the source actor is still there'
  )
})

test('a bad id or a missing halo is refused before anything runs', async () => {
  const one = fixture()
  await assert.rejects(
    move('../etc', owner, { ...one, halo: 'realness-2' }),
    MoveError
  )
  await assert.rejects(
    move(id, owner, { ...one, halo: '' }),
    /needs a target halo/
  )
  assert.deepEqual(one.asked, [])
})

test('release false keeps the old actor for a caller that removes it later', async () => {
  const one = fixture()
  await move(id, owner, { ...one, halo: 'realness-2', release: false })
  assert.ok(one.asked.every(line => !line.startsWith('from DELETE')))
})
