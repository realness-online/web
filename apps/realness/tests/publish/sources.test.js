import assert from 'node:assert/strict'
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  utimes,
  writeFile
} from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  app_sources,
  carried_itemid,
  mint_item,
  read_app,
  scan_vault,
  write_app
} from '../../src/publish/sources.js'

const author = '/+15550001111'
const scratch = new URL('../../../../artifacts/realness/apps/', import.meta.url)
  .pathname

const vault_at = async (name, entries) => {
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, `vault-${name}-`))
  for (const [path, body] of Object.entries(entries)) {
    await mkdir(join(root, path, '..'), { recursive: true })
    await writeFile(join(root, path), body)
  }
  return root
}

const blog_at = (vault, sources, assets = []) =>
  write_app(join(vault, 'apps', 'blog'), {
    id: 'a-0123456789ab',
    type: 'blog',
    vault: '../..',
    sources,
    assets
  })

test('h5: a move made anywhere keeps the app route on the same item', async () => {
  const vault = await vault_at('move', { 'Areas/Blog/draft.md': '# Draft\n' })
  try {
    const id = await mint_item(vault, 'Areas/Blog/draft.md', {
      author,
      type: 'articles'
    })
    await blog_at(vault, [{ id, slug: 'draft' }])
    await mkdir(join(vault, 'Projects'), { recursive: true })
    await rename(
      join(vault, 'Areas/Blog/draft.md'),
      join(vault, 'Projects/draft.md')
    )
    await writeFile(
      join(vault, 'Projects/draft.md'),
      `${await readFile(join(vault, 'Projects/draft.md'), 'utf8')}edited after the move\n`
    )
    const { sources } = await app_sources(join(vault, 'apps', 'blog'))
    assert.equal(sources[0].path, 'Projects/draft.md')
    assert.equal(sources[0].route, '/blog/draft')
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
})

test('h5: the vault is the catalog; no catalog file is written', async () => {
  const vault = await vault_at('no-catalog', {
    'a.md': '# A\n',
    'b.svg': '<svg viewBox="0 0 1 1"></svg>\n'
  })
  try {
    const a = await mint_item(vault, 'a.md', { author, type: 'articles' })
    const b = await mint_item(vault, 'b.svg', { author, type: 'diagrams' })
    const { items } = await scan_vault(vault)
    assert.deepEqual(
      [...items],
      [
        [a, 'a.md'],
        [b, 'b.svg']
      ]
    )
    await assert.rejects(stat(join(vault, 'catalog.json')), { code: 'ENOENT' })
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
})

test('h4: a new note carries its minted itemid, and its text is kept below', async () => {
  const vault = await vault_at('carry', { 'plan.md': '# Plan\n' })
  try {
    const id = await mint_item(vault, 'plan.md', {
      author,
      type: 'plans',
      created: 1791571682897
    })
    assert.equal(id, '/+15550001111/plans/1791571682897')
    const text = await readFile(join(vault, 'plan.md'), 'utf8')
    assert.equal(carried_itemid(text), id)
    assert.match(
      text,
      /^---\nitemid: "\/\+15550001111\/plans\/1791571682897"\ncreated: 2026-10-09T/
    )
    assert.match(text, /\n---\n# Plan\n$/)
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
})

test('h4: a file that already carries an itemid keeps it, unchanged', async () => {
  const poster =
    '<svg itemid="/+14155550142/posters/1772229663708" viewBox="0 0 1 1"></svg>\n'
  const vault = await vault_at('keeps', { 'poster.svg': poster })
  try {
    assert.equal(
      await mint_item(vault, 'poster.svg', { author, type: 'diagrams' }),
      '/+14155550142/posters/1772229663708'
    )
    assert.equal(await readFile(join(vault, 'poster.svg'), 'utf8'), poster)
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
})

test('h5: a copy carries its original itemid until minted; then it gets its own', async () => {
  const vault = await vault_at('copy', { 'a.md': '# A\n' })
  try {
    const id = await mint_item(vault, 'a.md', {
      author,
      type: 'articles',
      created: 1791571682897
    })
    await new Promise(done => setTimeout(done, 20))
    await copyFile(join(vault, 'a.md'), join(vault, 'b.md'))
    const scan = await scan_vault(vault)
    assert.deepEqual(scan.copies, [{ id, path: 'b.md' }])
    const own = await mint_item(vault, 'b.md', {
      author,
      created: 1791571699999,
      scan
    })
    assert.equal(own, '/+15550001111/articles/1791571699999')
    assert.equal(
      carried_itemid(await readFile(join(vault, 'a.md'), 'utf8')),
      id
    )
    assert.equal(
      carried_itemid(await readFile(join(vault, 'b.md'), 'utf8')),
      own
    )
    assert.deepEqual((await scan_vault(vault)).copies, [])
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
})

test('h5: a Realness poster may sit in several files; none is a copy, and from pins one', async () => {
  const id = '/+14155550142/posters/1772229663708'
  const vault = await vault_at('views', {
    'thoughts/poster.svg': `<svg itemid="${id}" viewBox="0 0 1 1"><g/></svg>\n`,
    'Areas/Blog/poster.svg': `<svg itemid="${id}" viewBox="0 0 1 1"></svg>\n`
  })
  try {
    const scan = await scan_vault(vault)
    assert.deepEqual(scan.copies, [])
    assert.deepEqual([...scan.views.get(id)].sort(), [
      'Areas/Blog/poster.svg',
      'thoughts/poster.svg'
    ])
    assert.equal(
      await mint_item(vault, 'Areas/Blog/poster.svg', { author, scan }),
      id
    )
    await blog_at(
      vault,
      [],
      [{ id, from: 'Areas/Blog/poster.svg', path: 'posters/a.svg' }]
    )
    const { assets } = await app_sources(join(vault, 'apps', 'blog'))
    assert.equal(assets[0].file.endsWith('Areas/Blog/poster.svg'), true)
    await blog_at(
      vault,
      [],
      [{ id, from: 'Areas/other.svg', path: 'posters/a.svg' }]
    )
    await assert.rejects(
      app_sources(join(vault, 'apps', 'blog')),
      /does not have/
    )
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
})

test('h4: a --- rule in a note without frontmatter is body, not frontmatter', async () => {
  const body =
    '# Plan\n\nIntro.\n\n---\n\nExploratory branch: `refactor`\n\n---\n\n## Approach\n'
  const vault = await vault_at('rule', { 'plan.md': body })
  try {
    assert.equal(carried_itemid(body), null)
    const id = await mint_item(vault, 'plan.md', {
      author,
      type: 'plans',
      created: 1791571682897
    })
    assert.equal(
      await readFile(join(vault, 'plan.md'), 'utf8'),
      `---\nitemid: "${id}"\ncreated: 2026-10-09T11:48:02-07:00\n---\n${body}`
    )
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
})

test("h4: gaining an itemid keeps the file's modification time", async () => {
  const vault = await vault_at('mtime', { 'plan.md': '# Plan\n' })
  try {
    const then = new Date('2026-09-17T23:32:37Z')
    await utimes(join(vault, 'plan.md'), then, then)
    await mint_item(vault, 'plan.md', { author, type: 'plans' })
    assert.equal(
      (await stat(join(vault, 'plan.md'))).mtime.getTime(),
      then.getTime()
    )
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
})

test('h4: two items minted in the same millisecond get different itemids', async () => {
  const vault = await vault_at('same-ms', { 'a.md': 'a\n', 'b.md': 'b\n' })
  try {
    const scan = await scan_vault(vault)
    const a = await mint_item(vault, 'a.md', {
      author,
      type: 'articles',
      created: 1791571682897,
      scan
    })
    const b = await mint_item(vault, 'b.md', {
      author,
      type: 'articles',
      created: 1791571682897,
      scan
    })
    assert.notEqual(a, b)
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
})

test('h5: a file that cannot carry an itemid is refused, with the way in named', async () => {
  const vault = await vault_at('binary', { 'art.png': 'png' })
  try {
    await assert.rejects(
      mint_item(vault, 'art.png', { author, type: 'posters' }),
      /wrap it in a page or poster/
    )
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
})

test('a source cannot leave the vault, through a path or through a link', async () => {
  const vault = await vault_at('escape', { 'inside.md': 'in\n' })
  const outside = await vault_at('outside', { 'secret.md': 'secret\n' })
  try {
    await symlink(join(outside, 'secret.md'), join(vault, 'link.md'))
    await assert.rejects(
      mint_item(vault, '../outside.md', { author, type: 'articles' }),
      /unsafe path/
    )
    await assert.rejects(
      mint_item(vault, 'link.md', { author, type: 'articles' }),
      /outside the vault/
    )
    await assert.rejects(
      mint_item(vault, 'missing.md', { author, type: 'articles' }),
      { code: 'ENOENT' }
    )
  } finally {
    await rm(vault, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  }
})

test('an app rejects a route it has twice, a missing item, and a bad recipe', async () => {
  const vault = await vault_at('recipe', { 'a.md': 'a\n', 'b.md': 'b\n' })
  const app_dir = join(vault, 'apps', 'plans')
  try {
    const scan = await scan_vault(vault)
    const a = await mint_item(vault, 'a.md', { author, type: 'plans', scan })
    const b = await mint_item(vault, 'b.md', { author, type: 'plans', scan })
    await write_app(app_dir, {
      id: 'a-0123456789ab',
      type: 'plans',
      vault: '../..',
      sources: [
        { id: a, slug: 'one' },
        { id: b, slug: 'one' }
      ]
    })
    await assert.rejects(app_sources(app_dir), /route already used/)
    await write_app(app_dir, {
      id: 'a-0123456789ab',
      type: 'plans',
      vault: '../..',
      sources: [{ id: '/+15550001111/plans/1', slug: 'one' }]
    })
    await assert.rejects(app_sources(app_dir), /does not have/)
    await write_app(app_dir, { id: 'nope', type: 'plans', sources: [] })
    await assert.rejects(read_app(app_dir), /id like/)
    await write_app(app_dir, {
      id: 'a-0123456789ab',
      type: 'photo',
      vault: '../..',
      sources: []
    })
    await assert.rejects(read_app(app_dir), /blog or plans/)
    await write_app(app_dir, {
      id: 'a-0123456789ab',
      type: 'blog',
      vault: '../..',
      sources: [{ id: a, slug: 'Bad Slug' }]
    })
    await assert.rejects(app_sources(app_dir), /bad selection/)
    await write_app(app_dir, {
      id: 'a-0123456789ab',
      type: 'blog',
      vault: '../..',
      sources: [{ id: a, slug: '../a' }]
    })
    await assert.rejects(app_sources(app_dir), /bad selection/)
    await write_app(app_dir, {
      id: 'a-0123456789ab',
      type: 'blog',
      vault: '../..',
      sources: [{ id: a, slug: 'DOM-the-ORM' }]
    })
    assert.equal(
      (await app_sources(app_dir)).sources[0].route,
      '/blog/DOM-the-ORM'
    )
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
})
