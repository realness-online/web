/**
 * e1: an article frames a page, and only a page the blog app publishes.
 */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile as write_file } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, it } from 'node:test'
import { blog_page } from '#root/src/sync/blog-pages.js'

let root = ''

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'blog-pages-'))
  const vault = join(root, 'vault')
  await mkdir(join(root, 'apps/blog'), { recursive: true })
  await mkdir(join(vault, 'Projects/deck'), { recursive: true })
  await write_file(
    join(vault, 'Projects/deck/engine.html'),
    '<!doctype html>\n<p>engine</p>\n'
  )
  await write_file(join(vault, 'Projects/deck/private.html'), '<p>private</p>')
  await write_file(
    join(root, 'apps/blog/app.json'),
    JSON.stringify({
      pages: [
        {
          id: '/+1555/plans/1/engine.html',
          path: 'engine.html',
          from: 'Projects/deck/engine.html'
        }
      ]
    })
  )
})

after(() => rm(root, { recursive: true, force: true }))

const vault = () => join(root, 'vault')

it('serves a page the blog app publishes', async () => {
  assert.equal(
    await blog_page(root, vault(), 'engine.html'),
    '<!doctype html>\n<p>engine</p>\n'
  )
})

it('refuses a page the blog app does not publish', async () => {
  assert.equal(await blog_page(root, vault(), 'private.html'), null)
})

it('refuses a name that leaves the vault', async () => {
  for (const name of ['../app.json', 'Projects/deck/engine.html', '', 3, null])
    assert.equal(await blog_page(root, vault(), name), null)
})

it('refuses a name that is not HTML', async () => {
  assert.equal(await blog_page(root, vault(), 'engine.svg'), null)
})
