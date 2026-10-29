import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { after, before, it } from 'node:test'
import { gzipSync } from 'node:zlib'
import { disk } from '#root/src/can/disk.js'
import { client } from '#root/src/files/client.js'
import { version_sync } from '#root/src/files/version-node.js'
import { unzip, zip } from '#root/src/files/zip.js'
import { store_of } from '#root/src/can/store.js'
import { issue_harness_pass } from '#root/src/sign-on/node/recovery-pass.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'

const secret = 'zip-sync-test-secret-at-least-thirty-two-bytes!!'
const phone = '+14155550177'
const id = 'a-0123456789ab'
const dir = new URL(
  `../../../../artifacts/realness/zip-${randomUUID()}/`,
  import.meta.url
).pathname
let storage, server, url

before(async () => {
  storage = store_of(disk(join(dir, 'bucket')))
  server = sync_service({
    storage,
    rights: rights(storage),
    halo_pass_secret: secret,
    log: () => {}
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  url = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  server.closeAllConnections()
  await new Promise(done => server.close(done))
  await rm(dir, { recursive: true, force: true })
})

const store = () =>
  client({ url, token: issue_harness_pass({ phone, id }, secret), phone })

it('zip is deterministic: same content, same bytes, OS byte fixed', () => {
  const body = Buffer.from('<p>poster</p>\n'.repeat(50))
  const one = zip(body)
  assert.ok(one.equals(zip(body)))
  assert.equal(one[9], 3)
  assert.equal(one.readUInt32LE(4), 0)
  assert.ok(unzip(one).equals(body))
})

it('harness stores as .gz under plain names; versions hash plain; a second run is idle', async () => {
  const local = join(dir, 'desk')
  await mkdir(join(local, 'vault'), { recursive: true })
  await writeFile(join(local, 'vault/note.md'), 'hello\n')
  const state = join(dir, 'desk-state')

  const first = await store().sync(local, 'can://~/harness/', { state })
  assert.deepEqual(first.pushed, ['vault/note.md'])

  const key = `people/${phone}/harness/vault/note.md`
  const stored = await readFile(join(dir, 'bucket', `${key}.gz`))
  assert.equal(unzip(stored).toString(), 'hello\n')
  assert.equal(
    (await storage.get(key)).version,
    version_sync(Buffer.from('hello\n'))
  )

  const again = await store().sync(local, 'can://~/harness/', { state })
  assert.deepEqual([...again.pushed, ...again.pulled], [])

  const other = join(dir, 'other')
  await store().sync(other, 'can://~/harness/', {
    state: join(dir, 'other-state')
  })
  assert.equal(await readFile(join(other, 'vault/note.md'), 'utf8'), 'hello\n')
})

it('the same content zipped another way agrees, without a conflict or a loop', async () => {
  const key = `people/${phone}/harness/vault/elsewhere.md`
  const body = Buffer.from('made on a halo\n'.repeat(20))
  await storage.put(key, gzipSync(body, { level: 1 }), { encoding: 'gzip' })
  const local = join(dir, 'desk')
  await writeFile(join(local, 'vault/elsewhere.md'), body)
  const state = join(dir, 'desk-state')

  const first = await store().sync(local, 'can://~/harness/', { state })
  assert.deepEqual(first.adopted, ['vault/elsewhere.md'])
  assert.deepEqual(first.kept_both, [])
  const second = await store().sync(local, 'can://~/harness/', { state })
  assert.deepEqual([...second.pushed, ...second.pulled], [])
})
