/**
 * The vault door resolves an itemid to one note, and gives the storage path
 * that `can` decides on. A stored key opens nothing.
 */
import { after, before, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID as random_uuid } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { vault_door } from '#root/src/sync/vault.js'
import { out_path } from '#root/lib/output.js'

const root = out_path(`vault-find-test-${random_uuid()}/`)
const index = join(root, 'memory.db')
const dir = join(root, 'vault')

before(async () => {
  await mkdir(dir, { recursive: true })
  const db = new DatabaseSync(index)
  db.exec(
    'CREATE TABLE note (path TEXT PRIMARY KEY, mtime_ms REAL, title TEXT, text TEXT)'
  )
  const insert = db.prepare(
    'INSERT INTO note(path, mtime_ms, title, text) VALUES (?, ?, ?, ?)'
  )
  insert.run(
    'Projects/a.md',
    1,
    'a',
    '---\nitemid: "/+1555/plans/1"\nkey: "abc_def"\n---\n\n# Body\n'
  )
  insert.run(
    'Projects/b.md',
    3,
    'b',
    '---\nitemid: "/+1555/plans/2"\nkey: "ghi_jkl"\nrelated:\n  - title: A Plan\n    href: a.md\n  - title: Away\n    href: ../../work/away.md\n  - title: Old\n    href: /vault#/+1555/plans/9\n---\n\n# B\n\nSee [A Plan](a.md) and [the archive](../Archived/c.md).\n\n```\n[A Plan](a.md)\n```\n'
  )
  insert.run(
    'Projects/d.md',
    2,
    'd',
    '---\nitemid: "/+1555/plans/4"\n---\n\n# D\n'
  )
  insert.run(
    'Projects/broken.md',
    3,
    'broken',
    '---\nitemid:\n  - not-an-itemid\n---\n\n# Broken\n'
  )
  insert.run(
    'Archived/c.md',
    4,
    'c',
    '---\nitemid: "/+1555/plans/3"\n---\n\n# C\n'
  )
  db.close()
})

after(async () => rm(root, { recursive: true, force: true }))

const door = vault_door({ dir, index, owner: '+1555' })

it('finds a note by itemid, hides the frontmatter, and names its storage path', () => {
  const found = door.shared({ itemid: '/+1555/plans/1' })
  assert.equal(found?.path, 'Projects/a.md')
  assert.equal(found?.text, '\n# Body\n')
  assert.equal(found?.itemid, '/+1555/plans/1')
  assert.equal(found?.storage, 'people/+1555/harness/vault/Projects/a.md')
})

it('opens nothing by a stored key', () => {
  assert.equal(door.shared({ key: 'abc_def' }), null)
  assert.equal(door.shared({ itemid: '' }), null)
  assert.equal(door.shared({ itemid: '/+1555/plans/2' })?.path, 'Projects/b.md')
  assert.equal(door.shared({ itemid: '/+1555/plans/9' }), null)
})

it('reads a tool page from disk, which the note index does not hold', async () => {
  const { mkdir, writeFile } = await import('node:fs/promises')
  await mkdir(join(dir, 'Areas/Realness/pages/maps'), { recursive: true })
  await writeFile(
    join(dir, 'Areas/Realness/pages/architecture.html'),
    '<html><body><article><h1 itemprop="headline">Architecture</h1><section itemprop="articleBody"><p>Body</p></section></article></body></html>'
  )
  await writeFile(
    join(dir, 'Areas/Realness/pages/maps/ways-in.html'),
    '<html><body><article><h1 itemprop="headline">Ways in</h1></article></body></html>'
  )
  assert.deepEqual(await door.pages(), [
    { title: 'Architecture', path: 'Areas/Realness/pages/architecture.html' },
    { title: 'Ways in', path: 'Areas/Realness/pages/maps/ways-in.html' }
  ])
  assert.match(
    (await door.note('Areas/Realness/pages/architecture.html')) ?? '',
    /Architecture/
  )
})

it('plans list last updated first, and one unreadable note is left out', () => {
  const plans = door.plans()
  assert.deepEqual(
    plans.map(plan => [plan.path, plan.title]),
    [
      ['Projects/b.md', 'B'],
      ['Projects/d.md', 'D'],
      ['Projects/a.md', 'Body']
    ]
  )
})

it('a body link answers with the note it names, and a code example stays as written', () => {
  assert.deepEqual(door.shared({ itemid: '/+1555/plans/2' })?.links, {
    'a.md': '/vault/+1555/plans/1',
    '../Archived/c.md': '/vault/+1555/plans/3'
  })
  assert.deepEqual(door.shared({ itemid: '/+1555/plans/1' })?.links, {})
})

it('a related href answers with the note it names, and keeps one it cannot reach', () => {
  assert.deepEqual(door.shared({ itemid: '/+1555/plans/2' })?.related, [
    { title: 'A Plan', href: '/vault/+1555/plans/1' },
    { title: 'Away', href: '../../work/away.md' },
    { title: 'Old', href: '/vault/+1555/plans/9' }
  ])
  assert.deepEqual(door.shared({ itemid: '/+1555/plans/1' })?.related, [])
})
