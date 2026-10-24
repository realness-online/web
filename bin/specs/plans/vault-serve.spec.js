import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, rmSync as rm_sync, writeFileSync as write_file_sync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { it } from 'node:test'
import { serve } from '../../plans/plans-serve.js'

const root = resolve(import.meta.dirname, '../../..')

const write = (path, text) => {
  mkdir_sync(dirname(path), { recursive: true })
  write_file_sync(path, text)
}

it('vault:serve answers every route: plans, articles, blog posts, and pages', async t => {
  mkdir_sync(join(root, 'artifacts/vault-serve'), { recursive: true })
  const dir = mkdtemp_sync(join(root, 'artifacts/vault-serve/test-'))
  t.after(() => rm_sync(dir, { recursive: true, force: true }))
  const plans = join(dir, 'plans')
  const blog = join(dir, 'blog')
  write(join(plans, 'index.html'), 'plans index')
  write(join(plans, '+1/plans/1/index.html'), 'a plan')
  write(join(blog, 'index.html'), 'articles')
  write(join(blog, 'blog/family-money/index.html'), 'family money')
  write(join(blog, 'resume.html'), 'resume')

  const server = serve(plans, blog).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())
  const at = `http://127.0.0.1:${server.address().port}`

  const routes = {
    '/': 'plans index',
    '/+1/plans/1/': 'a plan',
    '/articles/': 'articles',
    '/blog/family-money/': 'family money',
    '/resume': 'resume'
  }
  for (const [route, text] of Object.entries(routes)) {
    const response = await fetch(at + route)
    assert.equal(response.status, 200, route)
    assert.equal(await response.text(), text, route)
  }
  assert.equal((await fetch(`${at}/service.worker.js`)).status, 200)
  assert.equal((await fetch(`${at}/blog/missing/`)).status, 404)
})
