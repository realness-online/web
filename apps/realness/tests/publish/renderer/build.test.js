import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  rm,
  utimes
} from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { test } from 'node:test'
import sharp from 'sharp'

const execute = promisify(execFile)
const engine = new URL(
  '../../../tools/publish/renderer/build.js',
  import.meta.url
).pathname
const scratch = new URL(
  '../../../../../artifacts/realness/renderer/',
  import.meta.url
).pathname
const svg = color =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${color}"/></svg>`

async function fixture(type = 'blog') {
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, 'build-'))
  await mkdir(join(root, 'content/articles'), { recursive: true })
  await mkdir(join(root, 'static/posters'), { recursive: true })
  const site = {
    type,
    name: 'A & B',
    tagline: 'Notes',
    description: 'A "quoted" site',
    url: 'https://example.com',
    poster: 'portrait.svg'
  }
  await writeFile(join(root, 'site.json'), JSON.stringify(site))
  await writeFile(join(root, 'static/posters/portrait.svg'), svg('red'))
  return {
    root,
    site,
    build: () => execute(process.execPath, [engine], { cwd: root })
  }
}

test('a real rebuild removes stale pages and rereads settings and images', async () => {
  const f = await fixture()
  try {
    await writeFile(
      join(f.root, 'content/articles/note.md'),
      '# A "quoted" title\n\nBody.\n'
    )
    await f.build()
    const page = await readFile(
      join(f.root, 'dist/blog/note/index.html'),
      'utf8'
    )
    assert.match(
      await readFile(join(f.root, 'dist/index.html'), 'utf8'),
      /content="A &quot;quoted&quot; site"/
    )
    assert.match(page, /<title>A &quot;quoted&quot; title.*A &amp; B<\/title>/)
    const before = await readFile(join(f.root, 'dist/og/portrait.jpg'))
    await rm(join(f.root, 'content/articles/note.md'))
    await writeFile(join(f.root, 'static/posters/portrait.svg'), svg('blue'))
    await writeFile(
      join(f.root, 'site.json'),
      JSON.stringify({ ...f.site, name: 'Changed' })
    )
    await f.build()
    assert.equal(existsSync(join(f.root, 'dist/blog/note/index.html')), false)
    assert.notDeepEqual(
      await readFile(join(f.root, 'dist/og/portrait.jpg')),
      before
    )
    assert.match(
      await readFile(join(f.root, 'dist/index.html'), 'utf8'),
      /<title>Changed/
    )
  } finally {
    await rm(f.root, { recursive: true, force: true })
  }
})

test('plans mode sorts by modification time and copies the installed Mermaid bundle', async () => {
  const f = await fixture('plans')
  try {
    for (const [name, time] of [
      ['older', 1000],
      ['newer', 2000]
    ]) {
      const path = join(f.root, `content/articles/${name}.md`)
      await writeFile(
        path,
        `# ${name}\n\n\`\`\`mermaid\nflowchart LR\n  a["A"] --> b["B"]\n\`\`\`\n`
      )
      await utimes(path, time, time)
    }
    await f.build()
    const index = await readFile(join(f.root, 'dist/index.html'), 'utf8')
    assert.ok(
      index.indexOf('href="/blog/newer"') < index.indexOf('href="/blog/older"')
    )
    assert.doesNotMatch(index, /<details>/)
    assert.match(index, /href="\/plans.css"/)
    assert.deepEqual(
      await readFile(join(f.root, 'dist/scripts/mermaid.min.js')),
      await readFile(
        new URL(import.meta.resolve('mermaid/dist/mermaid.min.js'))
      )
    )
  } finally {
    await rm(f.root, { recursive: true, force: true })
  }
})

test('a snapshot keeps only the renderer files its type and mode use', async () => {
  const blog = await fixture('blog')
  const plans = await fixture('plans')
  try {
    for (const f of [blog, plans])
      await writeFile(
        join(f.root, 'content/articles/note.md'),
        '# Note\n\nBody.\n'
      )
    await blog.build()
    await plans.build()
    const has = (f, file) => existsSync(join(f.root, 'dist', file))
    for (const file of [
      'plans.css',
      'scripts/plan-covers.js',
      'scripts/live-reload.js',
      'posters/example.svg'
    ])
      assert.equal(has(blog, file), false, file)
    for (const file of ['plans.css', 'scripts/plan-covers.js'])
      assert.equal(has(plans, file), true, file)
    assert.equal(has(plans, 'scripts/live-reload.js'), false)
    assert.equal(has(blog, 'posters/portrait.svg'), true)
    assert.equal(has(blog, 'style.css'), true)
  } finally {
    await rm(blog.root, { recursive: true, force: true })
    await rm(plans.root, { recursive: true, force: true })
  }
})

test('an enabled PWA caches the selected snapshot, fragments, and diagrams', async () => {
  const f = await fixture('plans')
  try {
    await writeFile(
      join(f.root, 'site.json'),
      JSON.stringify({ ...f.site, pwa: true })
    )
    await sharp(Buffer.from(svg('red')))
      .resize(512, 512)
      .png()
      .toFile(join(f.root, 'static/512.png'))
    await writeFile(
      join(f.root, 'content/articles/note.md'),
      '---\nitemid: "/+15550001111/plans/1791571682897"\n---\n# Note\n\n```mermaid\nflowchart LR\n a --> b\n```\n'
    )
    await f.build()
    const manifest = JSON.parse(
      await readFile(join(f.root, 'dist/manifest.webmanifest'), 'utf8')
    )
    assert.equal(manifest.scope, '/')
    assert.equal(manifest.display, 'standalone')
    assert.deepEqual(
      manifest.icons.map(icon => icon.sizes),
      ['192x192', '512x512']
    )
    const worker = await readFile(
      join(f.root, 'dist/service.worker.js'),
      'utf8'
    )
    for (const path of [
      'blog/note/index.html',
      'partials/header.fragment',
      'scripts/mermaid.min.js'
    ])
      assert.ok(worker.includes(path), path)
    assert.match(
      worker,
      /event\.data\.type === ['"]SKIP_WAITING['"]/,
      'activation is guarded by an explicit message'
    )
    assert.match(
      await readFile(join(f.root, 'dist/scripts/pwa.js'), 'utf8'),
      /from '\/scripts\/watch-for-updates\.js'/,
      'the page leaves updates to the shared update rule'
    )
    assert.match(
      await readFile(join(f.root, 'dist/scripts/watch-for-updates.js'), 'utf8'),
      /export const watch_for_updates/,
      'the build ships the update rule the page imports'
    )
    const index = await readFile(join(f.root, 'dist/index.html'), 'utf8')
    assert.match(index, /itemid="\/\+15550001111\/plans\/1791571682897"/)
    assert.match(index, /href="\/manifest.webmanifest"/)
  } finally {
    await rm(f.root, { recursive: true, force: true })
  }
})

test('the renderer header carries the site name and tagline, escaped', async () => {
  const f = await fixture('plans')
  try {
    await writeFile(
      join(f.root, 'content/articles/note.md'),
      '# Note\n\nBody.\n'
    )
    await f.build()
    const header = await readFile(
      join(f.root, 'dist/partials/header.fragment'),
      'utf8'
    )
    assert.match(header, />A &amp; B</)
    assert.match(header, />Notes</)
    assert.doesNotMatch(header, /Your Name|What you do/)
  } finally {
    await rm(f.root, { recursive: true, force: true })
  }
})
