import { after, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID as random_uuid } from 'node:crypto'
import { mkdir, rm, writeFile as write_file } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync as gunzip_sync } from 'node:zlib'
import {
  OpenSession,
  disk_bytes,
  new_local_path,
  packed_on_disk,
  read_local,
  sync_names,
  version_local
} from '#root/src/files/session-gz.js'
import { version_sync } from '#root/src/files/version-node.js'
import { zip } from '#root/src/files/zip.js'
import { PREVIEW_LINK } from '#root/src/files/preview-styles.js'

const root = new URL(
  `../../../../artifacts/realness/session-gz-${random_uuid()}/`,
  import.meta.url
).pathname
after(() => rm(root, { recursive: true, force: true }))

it('a packed session syncs under its .html name unless a plain one is beside it', () => {
  const names = sync_names(['a.html.gz', 'b.html.gz', 'b.html', 'c.tar.gz'])
  assert.equal(names.get('a.html'), 'a.html.gz')
  assert.equal(names.get('b.html'), 'b.html')
  assert.equal(names.get('b.html.gz'), 'b.html.gz')
  assert.equal(names.get('c.tar.gz'), 'c.tar.gz')
})

it('only a renamed session is packed on the way to disk', () => {
  assert.ok(packed_on_disk('a.html', '/d/a.html.gz'))
  assert.ok(!packed_on_disk('b.html.gz', '/d/b.html.gz'))
  assert.equal(
    gunzip_sync(disk_bytes('a.html', '/d/a.html.gz', 'x')).toString(),
    'x'
  )
  assert.equal(disk_bytes('a.html', '/d/a.html', 'x'), 'x')
})

it('a packed session syncs its plain version, and a truncated one is open', async () => {
  await mkdir(root, { recursive: true })
  const packed = join(root, 'a.html.gz')
  await write_file(packed, zip(Buffer.from('hello')))
  assert.equal(
    await version_local('a.html', packed),
    version_sync(Buffer.from('hello'))
  )
  await write_file(packed, zip(Buffer.from('hello')).subarray(0, 12))
  await assert.rejects(version_local('a.html', packed), OpenSession)
  await rm(packed, { force: true })
})

it('a vault session opens styled, with the one stylesheet linked above it', async () => {
  await mkdir(root, { recursive: true })
  const packed = join(root, 'b.html.gz')
  const entry =
    '<article itemscope itemtype="/sessions/message" itemid="/sessions/x/1"></article>\n'
  await write_file(packed, zip(Buffer.from(entry)))
  const styled = await read_local('vault/Sessions/b.html', packed)
  assert.ok(styled.toString().startsWith(`${PREVIEW_LINK}\n`))
  assert.equal(
    await version_local('vault/Sessions/b.html', packed),
    version_sync(styled)
  )
  const outside = join(root, 'c.html.gz')
  await write_file(outside, zip(Buffer.from(entry)))
  assert.equal(
    (await read_local('.pi/agent/sessions/c.html', outside)).toString(),
    entry
  )
})

it('a session arriving with no copy here lands packed, as the Mac keeps it', () => {
  assert.equal(new_local_path('/r/s', 'a.html', true), '/r/s/a.html.gz')
  assert.equal(new_local_path('/r/s', 'x/a.html', true), '/r/s/x/a.html.gz')
  assert.equal(new_local_path('/r/s', 'a.jsonl', true), '/r/s/a.jsonl')
  assert.equal(new_local_path('/r/s', 'a.html.gz', true), '/r/s/a.html.gz')
  assert.equal(new_local_path('/r', 'notes/a.html', false), '/r/notes/a.html')
})
