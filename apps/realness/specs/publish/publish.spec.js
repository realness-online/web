import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile
} from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { it } from 'node:test'

const author = '/+15550001111'

/** An edit keeps the note's frontmatter, so it keeps its itemid. */
const edit_body = async (file, body) =>
  writeFile(
    file,
    (await readFile(file, 'utf8')).match(/^---\n[\s\S]*?\n---\n/)[0] + body
  )

/** Make a vault file an item, the way the apps command does. */
const add = async (vault, path, type = 'articles') => ({
  id: await mint_item(vault, path, { author, type })
})
import { disk } from '#root/src/can/disk.js'
import { dev_issuer } from '#root/src/sync/dev-token.js'
import { rights } from '#root/src/sync/rights.js'
import { sync_service } from '#root/src/sync/server.js'
import { mint_item, read_app, write_app } from '../../src/publish/sources.js'
import { build_app, renderer_path as example } from '../../src/publish/view.js'
import {
  publish_app,
  site_links,
  unpublish_app
} from '../../src/publish/publish.js'

const execute = promisify(execFile)
const scratch = new URL(
  '../../../../artifacts/realness/apps-publish/',
  import.meta.url
).pathname
const command = new URL('../../tools/publish/bin/publish.js', import.meta.url)
  .pathname
const id = 'a-0123456789ab'

async function fixture(type = 'blog') {
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, 'publish-'))
  const vault = join(root, 'vault')
  await mkdir(vault)
  await writeFile(
    join(vault, 'public.md'),
    '# Public\n\nSelected content.\n\n[Private](private.md)\n\n![Private image](private.svg)\n\n![Selected image](/media/public.svg)\n'
  )
  await writeFile(join(vault, 'private.md'), 'PRIVATE NOTE')
  await writeFile(join(vault, 'private.svg'), '<svg>PRIVATE IMAGE</svg>')
  const source = await add(vault, 'public.md')
  await writeFile(
    join(vault, 'public.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg"><title>Selected image</title></svg>'
  )
  const image = await add(vault, 'public.svg', 'diagrams')
  await write_app(join(root, 'apps', 'test'), {
    id,
    type,
    vault: '../../vault',
    sources: [{ id: source.id, slug: 'public' }],
    assets: [{ id: image.id, path: 'media/public.svg' }]
  })
  await writeFile(
    join(root, 'apps/test/site.json'),
    JSON.stringify({
      name: 'Test',
      url: '',
      tagline: '',
      poster: 'example.svg'
    })
  )
  const storage = disk(join(root, 'storage'))
  const issuer = dev_issuer()
  const phone = '+15555550100'
  const server = sync_service({
    storage,
    rights: rights(storage),
    project: issuer.project,
    certs: issuer.certs,
    halo_pass_secret: 'publish-test-secret-at-least-thirty-two-bytes',
    log: () => {}
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const url = `http://127.0.0.1:${server.address().port}`
  return {
    root,
    vault,
    source,
    storage,
    issuer,
    phone,
    url,
    options: { url, get_token: async () => issuer.token(phone), example },
    async close() {
      server.closeAllConnections()
      await new Promise(done => server.close(done))
      await rm(root, { recursive: true, force: true })
    }
  }
}

for (const type of ['blog', 'plans'])
  it(`the public ${type} CLI publishes stable links and private dependencies`, async () => {
    const f = await fixture(type)
    try {
      await build_app(f.root, 'test', { example })
      assert.equal(
        (await fetch(`${f.url}/sites/${id}/`)).status,
        404,
        'build alone does not publish'
      )
      const result = await execute(
        process.execPath,
        [command, 'app', 'publish', 'test', '--url', f.url],
        {
          cwd: f.root,
          env: {
            ...process.env,
            APPS_EXAMPLE: example,
            TOKEN: f.issuer.token(f.phone)
          }
        }
      )
      assert.match(result.stdout, new RegExp(`/sites/${id}/`))
      const page_url = `${f.url}/sites/${id}/blog/public`
      const page = await fetch(page_url)
      assert.equal(page.status, 200)
      assert.match(await page.text(), /Selected content/)
      const index = await (await fetch(`${f.url}/sites/${id}/`)).text()
      assert.match(index, new RegExp(`href="/sites/${id}/blog/public"`))
      assert.equal(
        (await fetch(`${f.url}/sites/${id}/blog/public/`)).status,
        200,
        'old trailing-slash links still work'
      )
      assert.equal((await fetch(`${f.url}/sites/${id}/style.css`)).status, 200)
      assert.match(
        await (await fetch(`${f.url}/sites/${id}/media/public.svg`)).text(),
        /Selected image/
      )
      for (const name of [
        'private.md',
        'private.svg',
        'vault/private.md',
        'catalog.json',
        'app.json',
        '.env'
      ])
        assert.equal(
          (await fetch(`${f.url}/sites/${id}/${name}`)).status,
          404,
          name
        )
      await mkdir(join(f.vault, 'Archive'), { recursive: true })
      await rename(
        join(f.vault, 'public.md'),
        join(f.vault, 'Archive/moved.md')
      )
      const moved = await readFile(join(f.vault, 'Archive/moved.md'), 'utf8')
      await writeFile(
        join(f.vault, 'Archive/moved.md'),
        moved.replace(/# Public[\s\S]*$/, '# Public\n\nMoved source.\n')
      )
      const second = await publish_app(f.root, 'test', f.options)
      assert.equal(second.sources[0].url, page_url)
      const elsewhere = await publish_app(f.root, 'test', {
        ...f.options,
        site_url: 'https://sites.example/'
      })
      assert.equal(
        elsewhere.sources[0].url,
        `https://sites.example/sites/${id}/blog/public`,
        's1: links use the public site address'
      )
      assert.match(await (await fetch(page_url)).text(), /Moved source/)
      await assert.rejects(
        publish_app(f.root, 'test', {
          ...f.options,
          get_token: async () => f.issuer.token('+15555550101')
        }),
        /403/
      )
      assert.match(await (await fetch(page_url)).text(), /Moved source/)
      await unpublish_app(id, f.options)
      assert.equal((await fetch(page_url)).status, 404)
      assert.match(
        await readFile(join(f.vault, 'Archive/moved.md'), 'utf8'),
        /Moved source/
      )
    } finally {
      await f.close()
    }
  })

it('a failed upload preserves the public snapshot; a removed source disappears only after publish', async () => {
  const f = await fixture()
  try {
    const first = await publish_app(f.root, 'test', f.options)
    await edit_body(
      join(f.vault, 'public.md'),
      '# Public\n\nUnpublished edit.\n'
    )
    assert.doesNotMatch(
      await (await fetch(first.sources[0].url)).text(),
      /Unpublished edit/
    )
    await assert.rejects(
      publish_app(f.root, 'test', {
        ...f.options,
        fetcher: (url, options) =>
          options.method === 'PUT' && url.endsWith('/index.html')
            ? new Response('', { status: 503 })
            : fetch(url, options)
      }),
      /503/
    )
    assert.match(
      await (await fetch(first.sources[0].url)).text(),
      /Selected content/
    )
    await write_app(join(f.root, 'apps/test'), {
      id,
      type: 'blog',
      vault: '../../vault',
      sources: [],
      assets: []
    })
    await publish_app(f.root, 'test', f.options)
    assert.equal((await fetch(first.sources[0].url)).status, 404)
  } finally {
    await f.close()
  }
})

it('a plans publication keeps covers, script paths, and page navigation under its site', async () => {
  const f = await fixture('plans')
  try {
    await edit_body(
      join(f.vault, 'public.md'),
      '# Plan\n\n```mermaid\nflowchart LR\n  a["a"] --> b["b"]\n```\n'
    )
    const published = await publish_app(f.root, 'test', f.options)
    const vendor = await (
      await fetch(`${published.url}scripts/pele.global.js`)
    ).arrayBuffer()
    assert.deepEqual(
      Buffer.from(vendor),
      await readFile(
        join(f.root, 'artifacts/apps/test/dist/scripts/pele.global.js')
      ),
      'vendor code is not rewritten'
    )
    const index = await (await fetch(published.url)).text()
    assert.match(index, new RegExp(`src="/sites/${id}/scripts/plan-covers.js"`))
    assert.match(index, new RegExp(`href="/sites/${id}/plans.css"`))
    const script = await (
      await fetch(`${published.url}scripts/diagrams.js`)
    ).text()
    assert.match(
      script,
      new RegExp(`script.src = '/sites/${id}/scripts/pele.global.js'`)
    )
    assert.equal(
      (await fetch(`${published.url}scripts/plan-diagrams.js`)).status,
      200
    )
  } finally {
    await f.close()
  }
})

it('vault pages, fragments, and PWA URLs stay under the published site', async () => {
  const f = await fixture('plans')
  try {
    await writeFile(
      join(f.vault, 'map.html'),
      '<html itemscope itemtype="https://schema.org/WebPage"><head><link rel="manifest" href="/manifest.webmanifest"></head><body>Vault map</body></html>'
    )
    const page = await add(f.vault, 'map.html', 'pages')
    const app_dir = join(f.root, 'apps/test')
    await write_app(app_dir, {
      ...(await read_app(app_dir)),
      pages: [{ id: page.id, path: 'maps/map.html' }]
    })
    await mkdir(join(app_dir, 'static'), { recursive: true })
    await writeFile(
      join(app_dir, 'static/manifest.webmanifest'),
      JSON.stringify({ name: 'Map', scope: '/', start_url: '/' })
    )
    const result = await publish_app(f.root, 'test', f.options)
    const link = result.sources.find(source => source.id === page.id)
    assert.equal(link.url, `${result.url}maps/map.html`)
    assert.match(
      await (await fetch(link.url)).text(),
      new RegExp(`/sites/${id}/manifest.webmanifest`)
    )
    const fragment = await (
      await fetch(`${result.url}partials/header.fragment`)
    ).text()
    assert.match(fragment, new RegExp(`/sites/${id}/partials/nav.fragment`))
    const manifest = await (
      await fetch(`${result.url}manifest.webmanifest`)
    ).json()
    assert.equal(manifest.scope, `/sites/${id}/`)
    const registration = await (
      await fetch(`${result.url}scripts/pwa.js`)
    ).text()
    assert.match(registration, new RegExp(`/sites/${id}/service.worker.js`))
    assert.equal(
      (await fetch(`${result.url}${page.id.slice(1)}/index.html`)).status,
      200
    )
  } finally {
    await f.close()
  }
})

it('publish rejects secret files before uploading, and renews an expired site pass', async () => {
  const f = await fixture()
  try {
    await mkdir(join(f.root, 'apps/test/static'), { recursive: true })
    await writeFile(join(f.root, 'apps/test/static/.env'), 'DO NOT SHARE')
    await assert.rejects(
      publish_app(f.root, 'test', f.options),
      /not publishable: .env/
    )
    assert.equal((await fetch(`${f.url}/sites/${id}/`)).status, 404)
    await rm(join(f.root, 'apps/test/static/.env'))
    let refused = false
    let authorizations = 0
    const result = await publish_app(f.root, 'test', {
      ...f.options,
      fetcher: (url, options) => {
        if (url.endsWith('/v1/halo-pass')) authorizations++
        if (!refused && options.method === 'PUT') {
          refused = true
          return new Response('', { status: 401 })
        }
        return fetch(url, options)
      }
    })
    assert.equal(authorizations, 2)
    assert.equal((await fetch(result.url)).status, 200)
  } finally {
    await f.close()
  }
})

it('rooted URLs get a site prefix without changing external URLs or double-prefixing', () => {
  const prefix = `/sites/${id}/`
  const html =
    '<a href="/blog/note">Note</a><img src="https://example.com/img.svg"><link href="/style.css">'
  const result = site_links(html, prefix)
  assert.match(result, new RegExp(`href="${prefix}blog/note"`))
  assert.match(result, /https:\/\/example.com\/img.svg/)
  assert.equal(site_links(result, prefix), result)
  assert.match(
    site_links('url(/fonts/body.woff2)', prefix),
    new RegExp(`url\\(${prefix}fonts/`)
  )
})
