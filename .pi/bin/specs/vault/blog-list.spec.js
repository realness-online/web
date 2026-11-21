import { it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync as read_file_sync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../../../..', import.meta.url).pathname

const read = path => read_file_sync(join(root, path), 'utf8')

it('f2: the blog list comes from Areas/Blog, and the app names no articles', () => {
  const app = JSON.parse(read('apps/blog/app.json'))
  assert.equal(app.sources, undefined)
  assert.match(read('apps/realness/src/app/blog/vault-blog.js'), /'\/v1\/vault\/articles'/)
  assert.match(read('apps/realness/src/sync/vault.js'), /path LIKE 'Areas\/Blog\/%'/)
})
