import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  rmSync as rm_sync
} from 'node:fs'
import { join } from 'node:path'
import { ActorStore } from '#root/src/halo/actors.js'
import { out_path } from '#root/lib/output.js'

const volume_with = (t, names) => {
  mkdir_sync(out_path('actor-list-tests'), { recursive: true })
  const volume = mkdtemp_sync(join(out_path('actor-list-tests'), 'volume-'))
  t.after(() => rm_sync(volume, { recursive: true, force: true }))
  for (const name of names) mkdir_sync(join(volume, name))
  const store = Object.create(ActorStore.prototype)
  store.volume = volume
  return store
}

it('a web cache directory is not an actor', t => {
  const store = volume_with(t, ['web-cache'])
  assert.deepEqual(store.list(), [])
  assert.throws(() => store.get('web-cache'), /web-cache/)
})

it('halo directories stay out of the actor list', t => {
  const store = volume_with(t, [
    'seed',
    'apps',
    'traces',
    'exports',
    'published',
    'published-versions'
  ])
  assert.deepEqual(store.list(), [])
})
