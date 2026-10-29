import { it } from 'node:test'
import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
import {
  disk_bytes,
  packed_on_disk,
  sync_names
} from '#root/src/files/session-gz.js'

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
    gunzipSync(disk_bytes('a.html', '/d/a.html.gz', 'x')).toString(),
    'x'
  )
  assert.equal(disk_bytes('a.html', '/d/a.html', 'x'), 'x')
})
