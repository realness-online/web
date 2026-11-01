import { after, it } from 'node:test'
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID as random_uuid } from 'node:crypto'
import { remove_plain } from '#root/src/can/remove-plain.js'
import { disk } from '#root/src/can/disk.js'
import { out_path } from '#root/lib/output.js'

const dir = out_path(`remove-plain-${random_uuid()}`)
const storage = disk(dir)

after(() => rm(dir, { recursive: true, force: true }))

it('dry run lists deletes and removes nothing', async () => {
  await storage.put('admins.html', 'admins')
  await storage.put('server/admins.html.gz', 'admins')
  await storage.put('people/+15555550100/posters/1.bin.gz', Buffer.from([0, 1]))

  const dry = await remove_plain(storage)
  assert.equal(dry.pending, 1)
  assert.equal(dry.deleted, 0)
  assert.equal((await storage.get('admins.html')).body.toString(), 'admins')
})

it('deletes plain files with a placed twin, keeps the rest', async () => {
  await storage.put('admins.html', 'admins')
  await storage.put('server/admins.html.gz', 'admins')
  await storage.put('people/+15555550100/pins/a', 'pin')
  await storage.put('people/+15555550100/pins/a.gz', 'pin')
  await storage.put('people/+15555550100/posters/1.bin.gz', Buffer.from([0, 1]))

  const ran = await remove_plain(storage, { write: true })
  assert.equal(ran.deleted, 2)
  assert.equal(await storage.get('admins.html'), null)
  assert.equal(
    (await storage.get('server/admins.html.gz')).body.toString(),
    'admins'
  )
  assert.equal(await storage.get('people/+15555550100/pins/a'), null)
  assert.equal(
    (await storage.get('people/+15555550100/pins/a.gz')).body.toString(),
    'pin'
  )

  const idle = await remove_plain(storage, { write: true })
  assert.equal(idle.pending, 0)
  assert.equal(idle.deleted, 0)
  assert.deepEqual(
    (await storage.get('people/+15555550100/posters/1.bin.gz')).body,
    Buffer.from([0, 1])
  )
})
