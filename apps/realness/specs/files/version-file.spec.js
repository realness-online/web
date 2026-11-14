import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { after, it } from 'node:test'
import { gzipSync } from 'node:zlib'
import { version_file, gzipped_size } from '#root/src/files/version-file.js'
import { version_sync } from '#root/src/files/version-node.js'
import { zip } from '#root/src/files/zip.js'

const root = new URL(
  `../../../../artifacts/realness/version-file-${randomUUID()}/`,
  import.meta.url
).pathname
after(() => rm(root, { recursive: true, force: true }))

const write = async (name, body) => {
  await mkdir(root, { recursive: true })
  const path = join(root, name)
  await writeFile(path, body)
  return path
}

it('a streamed version is the whole-file version', async () => {
  const body = Buffer.from('## Syncs\n\n- notes\n'.repeat(500))
  const path = await write('plain.md', body)
  assert.equal(await version_file(path), version_sync(body))
})

it('an unpacked version is the plain version of chained members', async () => {
  const first = 'one'.repeat(2000)
  const second = 'two'.repeat(2000)
  const packed = Buffer.concat([
    zip(Buffer.from(first)),
    zip(Buffer.from(second))
  ])
  const path = await write('session.html.gz', packed)
  assert.equal(await version_file(path), version_sync(packed))
  assert.equal(
    await version_file(path, { unpack: true }),
    version_sync(Buffer.from(first + second))
  )
})

it('gzip size is metered without holding the file', async () => {
  const body = Buffer.from('x'.repeat(50000))
  const path = await write('same.txt', body)
  assert.equal(await gzipped_size(path), gzipSync(body).length)
})
