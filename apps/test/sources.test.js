import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { add_source, app_sources, classify_source, move_source, read_catalog, read_app, remove_source, write_app } from '../src/sources.js'

const scratch = new URL('../../../../artifacts/brayness/apps/', import.meta.url).pathname

const vault_at = async (name, entries) => {
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, `vault-${name}-`))
  for (const [path, body] of Object.entries(entries)) {
    await mkdir(join(root, path, '..'), { recursive: true })
    await writeFile(join(root, path), body)
  }
  return root
}

test('identity outlives a move, so an app route keeps pointing at the same file', async () => {
  const vault = await vault_at('move', { 'Areas/Blog/draft.md': '# Draft\n' })
  try {
    const { id } = await add_source(vault, 'Areas/Blog/draft.md', { kind: 'article', tags: ['writing', 'personal'] })
    const app_dir = join(vault, 'apps', 'blog')
    await write_app(app_dir, { id: 'a-0123456789ab', type: 'blog', vault: '../..', sources: [{ id, slug: 'draft' }] })
    const before = await app_sources(app_dir)
    assert.equal(before.sources[0].route, '/blog/draft')
    assert.equal(await readFile(before.sources[0].file, 'utf8'), '# Draft\n')

    await move_source(vault, id, 'Projects/draft.md')
    const after = await app_sources(app_dir)
    assert.equal(after.sources[0].id, id)
    assert.equal(after.sources[0].route, '/blog/draft')
    assert.equal(await readFile(after.sources[0].file, 'utf8'), '# Draft\n')
    assert.equal(existsSync(join(vault, 'Areas/Blog/draft.md')), false)
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
})

test('one file carries several classifications at once', async () => {
  const vault = await vault_at('classify', { 'note.md': 'note\n' })
  try {
    const { id } = await add_source(vault, 'note.md')
    await classify_source(vault, id, { kind: 'plan', tags: ['software', 'software', 'plan'] })
    const saved = (await read_catalog(vault)).sources[id]
    assert.deepEqual(saved, { path: 'note.md', kind: 'plan', tags: ['plan', 'software'] })
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
})

test('a source cannot leave the vault, through a path or through a link', async () => {
  const vault = await vault_at('boundary', { 'note.md': 'note\n' })
  const outside = join(vault, '..', 'outside.md')
  try {
    await writeFile(outside, 'private\n')
    await assert.rejects(add_source(vault, '../outside.md'), /unsafe path/)
    await symlink(outside, join(vault, 'link.md'))
    await assert.rejects(add_source(vault, 'link.md'), /outside the vault/)
    await assert.rejects(add_source(vault, 'catalog.json'), /not a source/)
    await assert.rejects(add_source(vault, 'missing.md'), { code: 'ENOENT' })
  } finally {
    await rm(vault, { recursive: true, force: true })
    await rm(outside, { force: true })
  }
})

test('an app rejects a route it has twice, a missing source, and a bad recipe', async () => {
  const vault = await vault_at('recipe', { 'a.md': 'a\n', 'b.md': 'b\n' })
  const app_dir = join(vault, 'apps', 'plans')
  try {
    const a = await add_source(vault, 'a.md')
    const b = await add_source(vault, 'b.md')
    await write_app(app_dir, { id: 'a-0123456789ab', type: 'plans', vault: '../..', sources: [{ id: a.id, slug: 'one' }, { id: b.id, slug: 'one' }] })
    await assert.rejects(app_sources(app_dir), /route already used/)
    await write_app(app_dir, { id: 'a-0123456789ab', type: 'plans', vault: '../..', sources: [{ id: 'missing', slug: 'one' }] })
    await assert.rejects(app_sources(app_dir), /does not have/)
    await write_app(app_dir, { id: 'nope', type: 'plans', sources: [] })
    await assert.rejects(read_app(app_dir), /id like/)
    await write_app(app_dir, { id: 'a-0123456789ab', type: 'photo', vault: '../..', sources: [] })
    await assert.rejects(read_app(app_dir), /blog or plans/)
    await write_app(app_dir, { id: 'a-0123456789ab', type: 'blog', vault: '../..', sources: [{ id: a.id, slug: 'Bad Slug' }] })
    await assert.rejects(app_sources(app_dir), /bad selection/)
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
})

test('removing a source from the vault stops an app that named it', async () => {
  const vault = await vault_at('remove', { 'note.md': 'note\n' })
  const app_dir = join(vault, 'apps', 'blog')
  try {
    const { id } = await add_source(vault, 'note.md')
    await write_app(app_dir, { id: 'a-0123456789ab', type: 'blog', vault: '../..', sources: [{ id, slug: 'note' }] })
    await remove_source(vault, id)
    await assert.rejects(app_sources(app_dir), /does not have/)
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
})

test('a move that cannot be recorded puts the file back', async () => {
  const vault = await vault_at('rollback', { 'note.md': 'note\n', 'taken.md': 'taken\n' })
  try {
    const { id } = await add_source(vault, 'note.md')
    await assert.rejects(move_source(vault, id, 'taken.md'), /destination exists/)
    assert.equal(await readFile(join(vault, 'note.md'), 'utf8'), 'note\n')
    assert.equal((await read_catalog(vault)).sources[id].path, 'note.md')
  } finally {
    await rm(vault, { recursive: true, force: true })
  }
})
