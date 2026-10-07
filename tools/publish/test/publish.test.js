import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { test } from 'node:test'
import { disk } from '#root/lib/can/src/disk.js'
import { dev_issuer } from '#root/server/sync/src/dev-token.js'
import { rights } from '#root/server/sync/src/rights.js'
import { sync_service } from '#root/server/sync/src/server.js'
import { add_source, move_source, write_app } from '../src/sources.js'
import { build_app, renderer_path as example } from '../src/view.js'
import { publish_app, site_links, unpublish_app } from '../src/publish.js'

const execute = promisify(execFile)
const scratch = new URL('../../../../../artifacts/brayness/apps-publish/', import.meta.url).pathname
const command = new URL('../bin/publish.js', import.meta.url).pathname
const id = 'a-0123456789ab'

async function fixture(type = 'blog') {
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, 'publish-'))
  const vault = join(root, 'vault')
  await mkdir(vault)
  await writeFile(join(vault, 'public.md'), '# Public\n\nSelected content.\n\n[Private](private.md)\n\n![Private image](private.svg)\n\n![Selected image](/media/public.svg)\n')
  await writeFile(join(vault, 'private.md'), 'PRIVATE NOTE')
  await writeFile(join(vault, 'private.svg'), '<svg>PRIVATE IMAGE</svg>')
  const source = await add_source(vault, 'public.md')
  await writeFile(join(vault, 'public.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><title>Selected image</title></svg>')
  const image = await add_source(vault, 'public.svg', { kind: 'image' })
  await write_app(join(root, 'apps', 'test'), { id, type, vault: '../../vault', sources: [{ id: source.id, slug: 'public' }], assets: [{ id: image.id, path: 'media/public.svg' }] })
  await writeFile(join(root, 'apps/test/site.json'), JSON.stringify({ name: 'Test', url: '', tagline: '', poster: 'example.svg' }))
  const storage = disk(join(root, 'storage'))
  const issuer = dev_issuer()
  const phone = '+15555550100'
  const server = sync_service({ storage, rights: rights(storage), project: issuer.project, certs: issuer.certs, host_pass_secret: 'publish-test-secret-at-least-thirty-two-bytes', log: () => {} })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const url = `http://127.0.0.1:${server.address().port}`
  return {
    root, vault, source, storage, issuer, phone, url,
    options: { url, get_token: async () => issuer.token(phone), example },
    async close() {
      server.closeAllConnections()
      await new Promise(done => server.close(done))
      await rm(root, { recursive: true, force: true })
    },
  }
}

for (const type of ['blog', 'plans']) test(`the public ${type} CLI publishes stable links and private dependencies`, async () => {
  const f = await fixture(type)
  try {
    await build_app(f.root, 'test', { example })
    assert.equal((await fetch(`${f.url}/sites/${id}/`)).status, 404, 'build alone does not publish')
    const result = await execute(process.execPath, [command, 'app', 'publish', 'test', '--url', f.url], {
      cwd: f.root, env: { ...process.env, BRAYNESS_ROOT: f.root, APPS_EXAMPLE: example, TOKEN: f.issuer.token(f.phone) },
    })
    assert.match(result.stdout, new RegExp(`/sites/${id}/`))
    const page_url = `${f.url}/sites/${id}/blog/public/`
    const page = await fetch(page_url)
    assert.equal(page.status, 200)
    assert.match(await page.text(), /Selected content/)
    const index = await (await fetch(`${f.url}/sites/${id}/`)).text()
    assert.match(index, new RegExp(`href="/sites/${id}/blog/public"`))
    assert.equal((await fetch(`${f.url}/sites/${id}/blog/public`)).status, 200, 'the index link works without a trailing slash')
    assert.equal((await fetch(`${f.url}/sites/${id}/style.css`)).status, 200)
    assert.match(await (await fetch(`${f.url}/sites/${id}/media/public.svg`)).text(), /Selected image/)
    for (const name of ['private.md', 'private.svg', 'vault/private.md', 'catalog.json', 'app.json', '.env'])
      assert.equal((await fetch(`${f.url}/sites/${id}/${name}`)).status, 404, name)
    await move_source(f.vault, f.source.id, 'Archive/moved.md')
    await writeFile(join(f.vault, 'Archive/moved.md'), '# Public\n\nMoved source.\n')
    const second = await publish_app(f.root, 'test', f.options)
    assert.equal(second.sources[0].url, page_url)
    const elsewhere = await publish_app(f.root, 'test', { ...f.options, site_url: 'https://sites.example/' })
    assert.equal(elsewhere.sources[0].url, `https://sites.example/sites/${id}/blog/public/`, 's1: links use the public site address')
    assert.match(await (await fetch(page_url)).text(), /Moved source/)
    await assert.rejects(publish_app(f.root, 'test', { ...f.options, get_token: async () => f.issuer.token('+15555550101') }), /403/)
    assert.match(await (await fetch(page_url)).text(), /Moved source/)
    await unpublish_app(id, f.options)
    assert.equal((await fetch(page_url)).status, 404)
    assert.match(await readFile(join(f.vault, 'Archive/moved.md'), 'utf8'), /Moved source/)
  } finally { await f.close() }
})

test('a failed upload preserves the public snapshot; a removed source disappears only after publish', async () => {
  const f = await fixture()
  try {
    const first = await publish_app(f.root, 'test', f.options)
    await writeFile(join(f.vault, 'public.md'), '# Public\n\nUnpublished edit.\n')
    assert.doesNotMatch(await (await fetch(first.sources[0].url)).text(), /Unpublished edit/)
    await assert.rejects(publish_app(f.root, 'test', { ...f.options, fetcher: (url, options) => options.method === 'PUT' && url.endsWith('/index.html') ? new Response('', { status: 503 }) : fetch(url, options) }), /503/)
    assert.match(await (await fetch(first.sources[0].url)).text(), /Selected content/)
    await write_app(join(f.root, 'apps/test'), { id, type: 'blog', vault: '../../vault', sources: [], assets: [] })
    await publish_app(f.root, 'test', f.options)
    assert.equal((await fetch(first.sources[0].url)).status, 404)
  } finally { await f.close() }
})

test('a plans publication keeps covers, script paths, and page navigation under its site', async () => {
  const f = await fixture('plans')
  try {
    await writeFile(join(f.vault, 'public.md'), '# Plan\n\n```mermaid\nflowchart LR\n  a["a"] --> b["b"]\n```\n')
    const published = await publish_app(f.root, 'test', f.options)
    const vendor = await (await fetch(`${published.url}scripts/mermaid.min.js`)).arrayBuffer()
    assert.deepEqual(Buffer.from(vendor), await readFile(join(f.root, 'artifacts/apps/test/dist/scripts/mermaid.min.js')), 'vendor code is not rewritten')
    const index = await (await fetch(published.url)).text()
    assert.match(index, new RegExp(`src="/sites/${id}/scripts/plan-covers.js"`))
    assert.match(index, new RegExp(`href="/sites/${id}/plans.css"`))
    const script = await (await fetch(`${published.url}scripts/diagrams.js`)).text()
    assert.match(script, new RegExp(`script.src = '/sites/${id}/scripts/mermaid.min.js'`))
    assert.equal((await fetch(`${published.url}scripts/plan-diagrams.js`)).status, 200)
  } finally { await f.close() }
})

test('publish rejects secret files before uploading, and renews an expired site pass', async () => {
  const f = await fixture()
  try {
    await mkdir(join(f.root, 'apps/test/static'), { recursive: true })
    await writeFile(join(f.root, 'apps/test/static/.env'), 'DO NOT SHARE')
    await assert.rejects(publish_app(f.root, 'test', f.options), /not publishable: .env/)
    assert.equal((await fetch(`${f.url}/sites/${id}/`)).status, 404)
    await rm(join(f.root, 'apps/test/static/.env'))
    let refused = false
    let authorizations = 0
    const result = await publish_app(f.root, 'test', { ...f.options, fetcher: (url, options) => {
      if (url.endsWith('/v1/host-pass')) authorizations++
      if (!refused && options.method === 'PUT') {
        refused = true
        return new Response('', { status: 401 })
      }
      return fetch(url, options)
    } })
    assert.equal(authorizations, 2)
    assert.equal((await fetch(result.url)).status, 200)
  } finally { await f.close() }
})

test('rooted URLs get a site prefix without changing external URLs or double-prefixing', () => {
  const prefix = `/sites/${id}/`
  const html = '<a href="/blog/note">Note</a><img src="https://example.com/img.svg"><link href="/style.css">'
  const result = site_links(html, prefix)
  assert.match(result, new RegExp(`href="${prefix}blog/note"`))
  assert.match(result, /https:\/\/example.com\/img.svg/)
  assert.equal(site_links(result, prefix), result)
  assert.match(site_links('url(/fonts/body.woff2)', prefix), new RegExp(`url\\(${prefix}fonts/`))
})
