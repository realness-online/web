import { after, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, rm, stat } from 'node:fs/promises'
import { disk, pack } from '../../src/can/disk.js'

const base = new URL(
  `../../../../artifacts/realness/pack-test-${randomUUID()}/`,
  import.meta.url
).pathname
after(() => rm(base, { recursive: true, force: true }))

it('pack zips plain text in place; reads and versions are unchanged', async () => {
  const plain = disk(base)
  const html = `<p>${'poster '.repeat(200)}</p>`
  await plain.put('people/+1/posters/1.html', html)
  await plain.put('people/+1/avatar.jpg', Buffer.from([1, 2, 3]))
  const before = await plain.get('people/+1/posters/1.html')
  const { mtimeMs } = await stat(`${base}people/+1/posters/1.html`)

  const dry = await pack(base, { dry_run: true })
  assert.deepEqual(dry.packed, ['people/+1/posters/1.html'])
  assert.equal(await readFile(`${base}people/+1/posters/1.html`, 'utf8'), html)

  await pack(base)
  const raw = await readFile(`${base}people/+1/posters/1.html`)
  assert.equal(raw[0], 0x1f)
  const kept = (await stat(`${base}people/+1/posters/1.html`)).mtimeMs
  assert.ok(Math.abs(kept - mtimeMs) < 1, 'mtime kept to the millisecond')
  const after_pack = await disk(base, { gzip_at_rest: true }).get(
    'people/+1/posters/1.html'
  )
  assert.equal(after_pack.body.toString(), html)
  assert.equal(after_pack.version, before.version)
  assert.deepEqual((await pack(base)).packed, [])
})
