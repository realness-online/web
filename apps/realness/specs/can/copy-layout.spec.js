import { after, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile as read_file, rm, utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID as random_uuid } from 'node:crypto'
import { gunzipSync as gunzip_sync } from 'node:zlib'
import { copy_layout } from '#root/src/can/copy-layout.js'
import { disk } from '#root/src/can/disk.js'
import { out_path } from '#root/lib/output.js'

const dir = out_path(`copy-layout-${random_uuid()}`)
const storage = disk(dir)
const usage = 'usage/+15555550100/d/a.html'
const packed_usage = 'people/+15555550100/usage/d/a.html.gz'

after(() => rm(dir, { recursive: true, force: true }))

it('gz3: dry run lists copies without writing, then copy is resumable', async () => {
  const poster = Buffer.from([0, 1, 2, 255])
  await storage.put('admins.html', 'admins')
  await storage.put(usage, 'old', { meta: { created: '2020-01-01' } })
  await storage.put('people/+15555550100/posters/1.bin', poster)

  const dry = await copy_layout(storage)
  assert.equal(dry.files, 3)
  assert.equal(dry.pending, 3)
  assert.equal(dry.copied, 0)
  assert.equal(await storage.get('server/admins.html.gz'), null)

  const first = await copy_layout(storage, { write: true })
  assert.equal(first.copied, 3)
  assert.equal(
    (await storage.get('server/admins.html.gz')).body.toString(),
    'admins'
  )
  assert.deepEqual(
    (await storage.get('people/+15555550100/posters/1.bin.gz')).body,
    poster
  )
  assert.deepEqual(
    gunzip_sync(await read_file(join(dir, packed_usage))).toString(),
    'old'
  )
  assert.equal((await storage.get(packed_usage)).meta.created, '2020-01-01')
  assert.equal((await storage.get(usage)).body.toString(), 'old')

  const idle = await copy_layout(storage, { write: true })
  assert.equal(idle.pending, 0)
  assert.equal(idle.copied, 0)
  assert.equal(idle.skipped, 3)

  await storage.put(usage, 'new')
  await utimes(join(dir, usage), new Date('2035-01-01'), new Date('2035-01-01'))
  const changed = await copy_layout(storage, { write: true })
  assert.equal(changed.pending, 1)
  assert.equal(changed.copied, 1)
  assert.deepEqual(changed.copies, [
    { source: usage, destination: packed_usage }
  ])
  assert.equal((await storage.get(packed_usage)).body.toString(), 'new')
  assert.equal((await storage.get(usage)).body.toString(), 'new')
})
