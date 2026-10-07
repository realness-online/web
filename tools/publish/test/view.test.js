import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile, utimes } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { add_source } from '../src/sources.js'
import { write_app, read_app } from '../src/sources.js'
import { build_app, engine, renderer_path as example } from '../src/view.js'

const scratch = new URL('../../../../../artifacts/brayness/apps/', import.meta.url).pathname

/** A harness root: a vault of one note, one app, and the example checkout. */
async function harness(name, note, app) {
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, `view-${name}-`))
  const vault = join(root, 'vault')
  await mkdir(vault, { recursive: true })
  await writeFile(join(vault, 'note.md'), note)
  const source = await add_source(vault, 'note.md', { kind: 'article' })
  await write_app(join(root, 'apps', app.type), { id: 'a-0123456789ab', ...app, vault: '../../vault', sources: [{ id: source.id, slug: 'note' }] })
  await writeFile(join(root, 'apps', app.type, 'site.json'), `${JSON.stringify({ name: 'Test', tagline: '', url: '', description: '', poster: 'example.svg' }, null, 2)}\n`)
  // The reference renderer reuses the product's root install.
  await mkdir(join(root, 'node_modules'), { recursive: true })
  return root
}

test('an outdated renderer is refused instead of silently rendering plans as a blog', async () => {
  const root = await harness('old-engine', '# Hello\n', { type: 'plans' })
  try {
    const old = join(root, 'old-engine')
    await mkdir(old)
    await writeFile(join(old, 'build.js'), '')
    await assert.rejects(engine(root, old), /outdated renderer/)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('a blog app renders a selected vault note with its own microdata', async () => {
  const root = await harness('blog', '# Hello\n\nBody text.\n', { type: 'blog' })
  try {
    const built = await build_app(root, 'blog', { example })
    const page = await readFile(join(built.dist, 'blog/note/index.html'), 'utf8')
    assert.match(page, /<article itemscope/)
    assert.match(page, /Body text\./)
    assert.doesNotMatch(page, /data-diagrams/, 'a page without a diagram is never held back')
    assert.ok(existsSync(join(built.dist, 'sitemap.xml')))
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('a blog builds with a custom poster supplied by its static overlay', async () => {
  const root = await harness('poster', '# Hello\n', { type: 'blog' })
  try {
    const app = join(root, 'apps/blog')
    await mkdir(join(app, 'static/posters'), { recursive: true })
    const poster = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><title>Custom portrait</title><rect width="100" height="100" fill="red"/></svg>'
    await writeFile(join(app, 'static/posters/custom.svg'), poster)
    await writeFile(join(app, 'site.json'), JSON.stringify({ name: 'Test', url: '', poster: 'custom.svg' }))
    const built = await build_app(root, 'blog', { example })
    assert.equal(await readFile(join(built.dist, 'posters/custom.svg'), 'utf8'), poster)
    assert.match(await readFile(join(built.dist, 'index.html'), 'utf8'), /\/og\/custom\.jpg/)
    assert.ok(existsSync(join(built.dist, 'og/custom.jpg')))
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('an explicitly selected asset overrides an example asset with the same path', async () => {
  const root = await harness('asset-overlay', '# Hello\n', { type: 'blog' })
  try {
    const poster = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="blue"/></svg>'
    await writeFile(join(root, 'vault/portrait.svg'), poster)
    const asset = await add_source(join(root, 'vault'), 'portrait.svg', { kind: 'image' })
    const app_dir = join(root, 'apps/blog')
    const app = await read_app(app_dir)
    await write_app(app_dir, { ...app, assets: [{ id: asset.id, path: 'posters/example.svg' }] })
    const built = await build_app(root, 'blog', { example })
    assert.equal(await readFile(join(built.dist, 'posters/example.svg'), 'utf8'), poster)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('an Obsidian cardlink fences renders as one link card, not source text', async () => {
  const note = [
    '# Card',
    '',
    '```cardlink',
    'url: https://example.com/a-post',
    'title: "A Post & More"',
    'description: "What it says"',
    'host: example.com',
    'favicon: https://example.com/favicon.svg',
    'image: https://example.com/og.png',
    '```',
    '',
    'After the card.',
    '',
  ].join('\n')
  const root = await harness('card', note, { type: 'blog' })
  try {
    const built = await build_app(root, 'blog', { example })
    const page = await readFile(join(built.dist, 'blog/note/index.html'), 'utf8')
    assert.match(page, /<a itemprop="url" href="https:\/\/example\.com\/a-post">/)
    assert.match(page, /<strong itemprop="name">A Post &amp; More<\/strong>/)
    assert.match(page, /<span itemprop="provider">example\.com<\/span>/)
    assert.match(page, /itemprop="image" src="https:\/\/example\.com\/og\.png"/)
    assert.doesNotMatch(page, /cardlink/, 'the fence itself never reaches the page')
    assert.match(page, /After the card\./)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('a plans app renders a plan with its diagram rules and covers', async () => {
  const plan = '# P\n\n```mermaid\nflowchart LR\n  a["a"] --> b["b"]\n```\n\n## Notes\n'
  const root = await harness('plans', plan, { type: 'plans' })
  try {
    const built = await build_app(root, 'plans', { example })
    const page = await readFile(join(built.dist, 'blog/note/index.html'), 'utf8')
    const css = await readFile(join(built.dist, 'plans.css'), 'utf8')
    const covers = await readFile(join(built.dist, 'scripts/plan-covers.js'), 'utf8')
    assert.match(page, /<pre class="mermaid">/)
    assert.match(page, /\/scripts\/plan-covers\.js/)
    assert.match(css, /plans: covers/)
    assert.match(css, /tr:has\(del\)/)
    assert.match(covers, /cloneNode\(true\)/)
    assert.match(page, /data-site="plans"/)
    assert.match(page, /href="\/plans\.css"/)
    assert.match(page, /<html lang="en" data-site="plans" data-diagrams="pending">/, 'the body hides until the diagram is drawn')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('plans index orders sources by modification time, not selection order', async () => {
  const root = await harness('sort', '# Older\n', { type: 'plans' })
  try {
    const vault = join(root, 'vault')
    const older = (await read_app(join(root, 'apps/plans'))).sources[0]
    await writeFile(join(vault, 'new.md'), '# Newer\n')
    const newer = await add_source(vault, 'new.md')
    await utimes(join(vault, 'note.md'), 1000, 1000)
    await utimes(join(vault, 'new.md'), 2000, 2000)
    await write_app(join(root, 'apps/plans'), {
      id: 'a-0123456789ab', type: 'plans', vault: '../../vault',
      sources: [{ id: older.id, slug: 'older' }, { id: newer.id, slug: 'newer' }],
    })
    const built = await build_app(root, 'plans', { example })
    const index = await readFile(join(built.dist, 'index.html'), 'utf8')
    assert.ok(index.indexOf('href="/blog/newer"') < index.indexOf('href="/blog/older"'))
    assert.doesNotMatch(index, /<details>/)
    assert.match(index, /<template>/)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('a build starts from an empty tree, so a dropped source leaves no page', async () => {
  const root = await harness('empty', '# Hello\n', { type: 'blog' })
  try {
    const first = await build_app(root, 'blog', { example })
    assert.ok(existsSync(join(first.dist, 'blog/note/index.html')))
    await write_app(join(root, 'apps', 'blog'), { id: 'a-0123456789ab', type: 'blog', vault: '../../vault', sources: [] })
    const second = await build_app(root, 'blog', { example })
    assert.equal(existsSync(join(second.dist, 'blog/note/index.html')), false)
  } finally { await rm(root, { recursive: true, force: true }) }
})
