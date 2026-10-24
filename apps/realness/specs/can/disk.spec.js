import { after, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { rm, writeFile } from 'node:fs/promises'
import { contract } from '../../src/can/contract.js'
import { disk } from '../../src/can/disk.js'

const base = new URL(
  `../../../../artifacts/realness/can-store-test-${randomUUID()}/`,
  import.meta.url
).pathname
after(() => rm(base, { recursive: true, force: true }))

contract({ test: it, assert, make: async () => disk(`${base}${randomUUID()}`) })

it('disk writes and composes names near the filesystem limit', async () => {
  const store = disk(`${base}${randomUUID()}`)
  const key = `vault/${'n'.repeat(240)}.md`
  await store.put(key, 'first')
  assert.equal((await store.get(key)).body.toString(), 'first')
  await store.put('part', 'second')
  await store.compose(key, [key, 'part'])
  assert.equal((await store.get(key)).body.toString(), 'firstsecond')
})

it('disk refuses keys that escape its root', async () => {
  const store = disk(`${base}${randomUUID()}`)
  await assert.rejects(store.put('../outside', 'x'), /escapes the root/)
  await assert.rejects(store.get('people/../../outside'), /escapes the root/)
})

it('disk hides .meta and refuses keys inside it', async () => {
  const store = disk(`${base}${randomUUID()}`)
  await store.put('a.md', 'a', { meta: { sold: 'true' } })
  assert.deepEqual(await store.list(''), { files: ['a.md'], folders: [] })
  assert.deepEqual(Object.keys(await store.walk('')), ['a.md'])
  await assert.rejects(store.put('.meta/a.md.json', '{}'), /reserved/)
})

it('disk sees a hand edit: the bytes are the truth', async () => {
  const root = `${base}${randomUUID()}`
  const store = disk(root)
  const before = await store.put('notes/a.md', 'one')
  assert.equal((await store.walk('notes/'))['a.md'], before)
  await writeFile(`${root}/notes/a.md`, 'edited by hand')
  const after = (await store.walk('notes/'))['a.md']
  assert.notEqual(after, before)
  assert.equal(after, await store.stat('notes/a.md'))
  await assert.rejects(
    store.put('notes/a.md', 'stale', { if_version: before }),
    { code: 'conflict' }
  )
})
