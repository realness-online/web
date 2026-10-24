import assert from 'node:assert/strict'
import { createHash as create_hash } from 'node:crypto'
import { it } from 'node:test'
import { gzipSync as gzip_sync } from 'node:zlib'
import { version_of } from '#root/src/files/version.js'
import { version_sync } from '#root/src/files/version-node.js'
import { sha as edit_log_sha } from '../../../../.pi/extensions/edit-log/log.js'

const node_version = bytes =>
  create_hash('sha256').update(bytes).digest('base64url').slice(0, 22)

it('a version is the plain bytes hash, 22 base64url characters', async () => {
  const version = await version_of('hello')
  assert.equal(version, node_version('hello'))
  assert.match(version, /^[A-Za-z0-9_-]{22}$/)
})

it('text and its bytes share a version', async () => {
  const text = '<p itemscope>héllo</p>'
  assert.equal(await version_of(text), await version_of(Buffer.from(text)))
})

it('the sync Node copy and the edit log hash the same way', async () => {
  for (const body of ['', 'hello', Buffer.from('00ff1f8b', 'hex')]) {
    const version = await version_of(body)
    assert.equal(version_sync(body), version)
    assert.equal(edit_log_sha(Buffer.from(body)), version)
  }
})

it('gzip never moves the version', async () => {
  const plain = Buffer.from('<p>one</p>\n'.repeat(50))
  assert.notEqual(await version_of(gzip_sync(plain)), await version_of(plain))
  assert.equal(await version_of(plain), node_version(plain))
})
