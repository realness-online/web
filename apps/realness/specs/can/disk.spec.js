import { after, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
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

it('a .gz key is gzip on disk yet serves plain bytes and the plain version', async () => {
  const dir = `${base}${randomUUID()}`
  const key = 'people/+1/poster.html.gz'
  const plain = 'repeat. '.repeat(400)
  const store = disk(dir)
  const version = await store.put(key, plain)
  assert.equal(version, await store.stat(key))
  assert.equal((await store.walk('people/+1/'))['poster.html.gz'], version)
  const { body, version: got } = await store.get(key)
  assert.equal(got, version)
  assert.equal(body.toString(), plain)
  const stored = await readFile(join(dir, key))
  assert.equal(stored.subarray(0, 2).toString('hex'), '1f8b')
})

it('other keys keep their bytes as given', async () => {
  const store = disk(`${base}${randomUUID()}`)
  const binary = Buffer.from([0x1f, 0x8b, 1, 2, 3])
  await store.put('people/+1/logo.png', binary)
  assert.deepEqual((await store.get('people/+1/logo.png')).body, binary)
})
