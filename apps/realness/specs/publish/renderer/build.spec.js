import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  rm,
  symlink,
  utimes
} from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { it } from 'node:test'
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

it('a real rebuild removes stale pages and rereads settings and images', async () => {
  const f = await fixture()
  try {
    await writeFile(
      join(f.root, 'content/articles/note.md'),
      '# A "quoted" title\n\nBody.\n'
    )
    await f.build()
    const page = await readFile(join(f.root, 'dist/blog/note.html'), 'utf8')
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
    assert.equal(existsSync(join(f.root, 'dist/blog/note.html')), false)
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

it('plans mode sorts by modification time and copies the installed Mermaid bundle', async () => {
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
      await readFile(join(f.root, 'dist/scripts/pele.global.js')),
      await readFile(new URL(import.meta.resolve('pele/global')))
    )
  } finally {
    await rm(f.root, { recursive: true, force: true })
  }
})

it('a plan renders the notes it links under its itemid, and no note outside its folder', async () => {
  const f = await fixture('plans')
  const vault = join(f.root, 'vault')
  try {
    await mkdir(join(vault, 'Scouts/Realness/Leads'), { recursive: true })
    await writeFile(join(vault, 'secret.md'), '# Secret\n')
    await writeFile(
      join(vault, 'Scouts/Realness/Leads/2026-11-05.md'),
      '# Realness leads\n\n- [Antithesis](https://antithesis.com)\n'
    )
    await writeFile(
      join(vault, 'Scouts/index.md'),
      '---\nitemid: "/+1/plans/3"\n---\n# Scouts\n\n[Leads](Realness/Leads/2026-11-05.md) [Out](../secret.md) [Gone](Realness/none.md)\n'
    )
    await symlink(
      join(vault, 'Scouts/index.md'),
      join(f.root, 'content/articles/scouts.md')
    )
    await f.build()
    const plan = await readFile(join(f.root, 'dist/blog/scouts.html'), 'utf8')
    assert.ok(plan.includes('href="/+1/plans/3/Realness/Leads/2026-11-05"'))
    const page = await readFile(
      join(f.root, 'dist/+1/plans/3/Realness/Leads/2026-11-05.html'),
      'utf8'
    )
    assert.match(page, /<title>Realness leads/)
    assert.match(page, /href="https:\/\/antithesis.com"/)
    assert.equal(
      existsSync(join(f.root, 'dist/+1/plans/secret.md.html')),
      false
    )
    assert.equal(
      existsSync(join(f.root, 'dist/+1/plans/3/Realness/none.md.html')),
      false
    )
  } finally {
    await rm(f.root, { recursive: true, force: true })
  }
})

it('a snapshot keeps only the renderer files its type and mode use', async () => {
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

it('an enabled PWA caches the selected snapshot, fragments, and diagrams', async () => {
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
    for (const path of ['partials/header.fragment', 'scripts/pele.global.js'])
      assert.ok(worker.includes(path), path)
    assert.ok(
      !worker.includes('blog/note.html'),
      'pages are not precached; a reader gets the current page'
    )
    assert.match(worker, /NetworkFirst/, 'pages come from the network first')
    assert.match(
      worker,
      /event\.data\.type === ['"]SKIP_WAITING['"]/,
      'activation is guarded by an explicit message'
    )
    assert.match(
      await readFile(join(f.root, 'dist/scripts/pwa.js'), 'utf8'),
      /from '\/scripts\/register\.js'/,
      'the page registers through the PWA kit'
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

it('the renderer header carries the site name and tagline, escaped', async () => {
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

it('--only rewrites the named plan and leaves the other pages as built', async () => {
  const f = await fixture('plans')
  try {
    for (const [name, itemid] of [
      ['older', '/+1/plans/1'],
      ['newer', '/+1/plans/2']
    ])
      await writeFile(
        join(f.root, `content/articles/${name}.md`),
        `---\nitemid: "${itemid}"\n---\n# ${name}\n\nBody ${name}.\n`
      )
    await f.build()
    const kept = join(f.root, 'dist/blog/newer.html')
    const before = await readFile(kept, 'utf8')
    const built = await readFile(
      join(f.root, 'dist/+1/plans/2/index.html'),
      'utf8'
    )
    await writeFile(
      join(f.root, 'content/articles/older.md'),
      '---\nitemid: "/+1/plans/1"\n---\n# Older changed\n\nA new body.\n'
    )
    const { stdout } = await execute(
      process.execPath,
      [engine, '--only=older'],
      { cwd: f.root }
    )
    assert.match(stdout, /rebuilt 1 of 2 articles/)
    assert.match(
      await readFile(join(f.root, 'dist/blog/older.html'), 'utf8'),
      /Older changed/
    )
    assert.equal(await readFile(kept, 'utf8'), before)
    assert.equal(
      await readFile(join(f.root, 'dist/+1/plans/2/index.html'), 'utf8'),
      built
    )
    const index = await readFile(join(f.root, 'dist/index.html'), 'utf8')
    const page = await readFile(join(f.root, 'dist/blog/older.html'), 'utf8')
    assert.match(index, /href="\/blog\/older">Older changed</)
    assert.match(index, /<p>Body newer\.<\/p>/)
    await f.build()
    assert.equal(
      await readFile(join(f.root, 'dist/index.html'), 'utf8'),
      index,
      'a partial build leaves the same index a full one writes'
    )
    assert.equal(
      await readFile(join(f.root, 'dist/blog/older.html'), 'utf8'),
      page,
      'a partial build writes the same page a full one writes'
    )
  } finally {
    await rm(f.root, { recursive: true, force: true })
  }
})

it('--only refuses a tree it cannot rebuild into', async () => {
  const f = await fixture('plans')
  try {
    await writeFile(join(f.root, 'content/articles/note.md'), '# Note\n')
    await assert.rejects(
      execute(process.execPath, [engine, '--only=note'], { cwd: f.root }),
      /no dist to rebuild into/
    )
    await f.build()
    await writeFile(
      join(f.root, 'content/articles/later.md'),
      '---\nitemid: "/+1/plans/9"\n---\n# Later\n'
    )
    await assert.rejects(
      execute(process.execPath, [engine, '--only=later'], { cwd: f.root }),
      /no previous page to keep/
    )
  } finally {
    await rm(f.root, { recursive: true, force: true })
  }
})
