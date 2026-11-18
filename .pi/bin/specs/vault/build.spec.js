import { it } from 'node:test'
import assert from 'node:assert/strict'

it('b1: the blog finds its articles, keeps known slugs, adds new ones, and drops deleted ones', async () => {
  const { mkdir, mkdtemp, readFile, rm, writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const { select_blog } = await import('../../vault/build.js')
  const scratch = new URL('../../../../artifacts/realness/plans-test/', import.meta.url).pathname
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, 'blog-select-'))
  try {
    await mkdir(join(root, 'vault/Areas/Blog/2026'), { recursive: true })
    await mkdir(join(root, 'apps/blog'), { recursive: true })
    const kept = '/+15550001111/articles/1'
    const added = '/+15550001111/articles/2'
    const note = id => `---\nitemid: '${id}'\n---\n# post\n`
    await writeFile(join(root, 'vault/Areas/Blog/old.md'), note(kept))
    await writeFile(join(root, 'vault/Areas/Blog/2026/Neck and Neck.md'), note(added))
    await writeFile(join(root, 'vault/Areas/Blog/plan.md'), note('/+15550001111/plans/3'))
    await writeFile(
      join(root, 'apps/blog/app.json'),
      JSON.stringify({
        id: 'a-0123456789ab',
        type: 'blog',
        vault: '../../vault',
        sources: [
          { id: kept, slug: 'chosen' },
          { id: '/+15550001111/articles/9', slug: 'deleted' }
        ]
      })
    )
    const expected = [
      { id: kept, slug: 'chosen' },
      { id: added, slug: 'neck-and-neck' }
    ]
    assert.deepEqual(await select_blog(root), expected)
    assert.deepEqual(JSON.parse(await readFile(join(root, 'apps/blog/app.json'), 'utf8')).sources, expected)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
