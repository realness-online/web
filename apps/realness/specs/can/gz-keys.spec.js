import { after, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { gunzipSync as gunzip_sync, gzipSync as gzip_sync } from 'node:zlib'
import { disk } from '#root/src/can/disk.js'
import { gz_keys } from '#root/src/can/gz-keys.js'
import { version_of } from '#root/src/files/version.js'
import { out_path } from '#root/lib/output.js'

const dir = out_path(`gz-keys-${randomUUID()}`)
const store = gz_keys(disk(dir))
const on_disk = key => readFile(join(dir, key))

after(() => rm(dir, { recursive: true, force: true }))

it('a people/ file lands as name.gz and reads back plain', async () => {
  const version = await store.put('people/+1/vault/a.md', 'alpha\n')
  assert.equal(version, await version_of('alpha\n'))
  assert.equal(
    gunzip_sync(await on_disk('people/+1/vault/a.md.gz')).toString(),
    'alpha\n'
  )
  const file = await store.get('people/+1/vault/a.md')
  assert.equal(file.body.toString(), 'alpha\n')
  assert.equal(file.version, version)
})

it('sent gzip is kept as sent, chained members included', async () => {
  const sent = Buffer.concat([gzip_sync('one\n'), gzip_sync('two\n')])
  const version = await store.put('people/+1/vault/s.html', sent, {
    encoding: 'gzip'
  })
  assert.deepEqual(await on_disk('people/+1/vault/s.html.gz'), sent)
  assert.equal(version, await version_of('one\ntwo\n'))
  const raw = await store.get('people/+1/vault/s.html', { raw: true })
  assert.deepEqual(raw.body, sent)
  assert.equal(raw.packed, true)
})

it('the same content agrees however it was zipped', async () => {
  const a = await store.put(
    'people/+1/vault/x.md',
    gzip_sync('same', { level: 1 }),
    {
      encoding: 'gzip'
    }
  )
  const b = await store.put('people/+1/vault/y.md', 'same')
  assert.equal(a, b)
})

it('listings, walks, and finds show plain names and hide others', async () => {
  await disk(dir).put('people/+1/vault/stray.md', 'old plain original')
  const listing = await store.list('people/+1/vault/')
  assert.ok(listing.files.includes('a.md'))
  assert.ok(!listing.files.some(name => name.endsWith('.gz')))
  assert.ok(!listing.files.includes('stray.md'))
  const walked = await store.walk('people/+1/')
  assert.equal(walked['vault/a.md'], await version_of('alpha\n'))
  assert.ok(!('vault/stray.md' in walked))
  const meta = await store.walk_meta('people/+1/vault/')
  assert.ok('a.md' in meta)
})

it('delete removes the .gz', async () => {
  await store.put('people/+1/vault/gone.md', 'bye')
  await store.delete('people/+1/vault/gone.md')
  assert.equal(await store.get('people/+1/vault/gone.md'), null)
})

it('every key is stored .gz, not only people/', async () => {
  await store.put('server/admins.html', 'admins')
  assert.equal(
    gunzip_sync(await on_disk('server/admins.html.gz')).toString(),
    'admins'
  )
  assert.equal(
    (await store.get('server/admins.html')).body.toString(),
    'admins'
  )
  assert.deepEqual((await store.list('server/')).files, ['admins.html'])
})
