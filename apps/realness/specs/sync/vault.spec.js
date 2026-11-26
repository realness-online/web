/**
 * The vault door resolves an itemid to one note, and gives the storage path
 * that `can` decides on. A stored key opens nothing. It reads the Mac's folder
 * and a person's cloud storage the same way.
 */
import { after, before, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID as random_uuid } from 'node:crypto'
import { mkdir, rm, utimes, writeFile as write_file } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { vault_door } from '#root/src/sync/vault.js'
import { disk_source, storage_source } from '#root/src/sync/vault-source.js'
import { disk } from '#root/src/can/disk.js'
import { store_of } from '#root/src/can/store.js'
import { out_path } from '#root/lib/output.js'

const root = out_path(`vault-find-test-${random_uuid()}/`)
const dir = join(root, 'vault')

const NOTES = [
  [
    'Projects/a.md',
    1,
    '---\nitemid: "/+1555/plans/1"\nkey: "abc_def"\n---\n\n# Body\n'
  ],
  [
    'Projects/b.md',
    3,
    '---\nitemid: "/+1555/plans/2"\nkey: "ghi_jkl"\nrelated:\n  - title: A Plan\n    href: a.md\n  - title: Away\n    href: ../../work/away.md\n  - title: Old\n    href: /vault#/+1555/plans/9\n---\n\n# B\n\nSee [A Plan](a.md) and [the archive](../Archived/c.md).\n\n```\n[A Plan](a.md)\n```\n'
  ],
  ['Projects/d.md', 2, '---\nitemid: "/+1555/plans/4"\n---\n\n# D\n'],
  [
    'Projects/broken.md',
    3,
    '---\nitemid:\n  - not-an-itemid\n---\n\n# Broken\n'
  ],
  ['Archived/c.md', 4, '---\nitemid: "/+1555/plans/3"\n---\n\n# C\n'],
  ['Sessions/old.md', 5, '---\nitemid: "/+1555/plans/8"\n---\n\n# Old\n'],
  ['.obsidian/x.md', 5, '---\nitemid: "/+1555/plans/7"\n---\n\n# X\n']
]

before(async () => {
  for (const [path, seconds, text] of NOTES) {
    await mkdir(dirname(join(dir, path)), { recursive: true })
    await write_file(join(dir, path), text)
    await utimes(join(dir, path), seconds, seconds)
  }
})

after(async () => rm(root, { recursive: true, force: true }))

const door = vault_door({ source: disk_source(dir), owner: '+1555' })

it('finds a note by itemid, hides the frontmatter, and names its storage path', async () => {
  const found = await door.shared({ itemid: '/+1555/plans/1' })
  assert.equal(found?.path, 'Projects/a.md')
  assert.equal(found?.text, '\n# Body\n')
  assert.equal(found?.itemid, '/+1555/plans/1')
  assert.equal(found?.storage, 'people/+1555/vault/Projects/a.md')
})

it('opens nothing by a stored key', async () => {
  assert.equal(await door.shared({ key: 'abc_def' }), null)
  assert.equal(await door.shared({ itemid: '' }), null)
  assert.equal(
    await (
      await door.shared({ itemid: '/+1555/plans/2' })
    )?.path,
    'Projects/b.md'
  )
  assert.equal(await door.shared({ itemid: '/+1555/plans/9' }), null)
})

it('serves an image beside a note, and nothing outside its folder', async () => {
  const pixel = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
  await write_file(join(dir, 'Projects/pic.png'), pixel)
  await write_file(join(dir, 'Archived/away.png'), pixel)
  const found = await door.attachment({
    itemid: '/+1555/plans/1',
    name: 'pic.png'
  })
  assert.deepEqual(found?.body, pixel)
  assert.equal(found?.type, 'image/png')
  assert.equal(found?.storage, 'people/+1555/vault/Projects/pic.png')
  assert.equal(
    await door.attachment({
      itemid: '/+1555/plans/1',
      name: '../Archived/away.png'
    }),
    null
  )
  assert.equal(
    await door.attachment({ itemid: '/+1555/plans/1', name: 'b.md' }),
    null
  )
  assert.equal(
    await door.attachment({ itemid: '/+1555/plans/9', name: 'pic.png' }),
    null
  )
})

it('reads a tool page, which the note index does not hold', async () => {
  await mkdir(join(dir, 'Areas/Realness/pages/maps'), { recursive: true })
  await write_file(
    join(dir, 'Areas/Realness/pages/architecture.html'),
    '<html><body><article><h1 itemprop="headline">Architecture</h1><section itemprop="articleBody"><p>Body</p></section></article></body></html>'
  )
  await write_file(
    join(dir, 'Areas/Realness/pages/maps/ways-in.html'),
    '<html><body><article><h1 itemprop="headline">Ways in</h1></article></body></html>'
  )
  door.changed()
  assert.deepEqual(await door.pages(), [
    { title: 'Architecture', path: 'Areas/Realness/pages/architecture.html' },
    { title: 'Ways in', path: 'Areas/Realness/pages/maps/ways-in.html' }
  ])
  assert.match(
    (await door.note('Areas/Realness/pages/architecture.html')) ?? '',
    /Architecture/
  )
})

it('plans list last updated first, and one unreadable note is left out', async () => {
  const plans = await door.plans()
  assert.deepEqual(
    plans.map(plan => [plan.path, plan.title]),
    [
      ['Projects/b.md', 'B'],
      ['Projects/d.md', 'D'],
      ['Projects/a.md', 'Body']
    ]
  )
})

it('a body link answers with the note it names, and a code example stays as written', async () => {
  assert.deepEqual((await door.shared({ itemid: '/+1555/plans/2' }))?.links, {
    'a.md': '/vault/+1555/plans/1',
    '../Archived/c.md': '/vault/+1555/plans/3'
  })
  assert.deepEqual((await door.shared({ itemid: '/+1555/plans/1' }))?.links, {})
})

it('a related href answers with the note it names, and keeps one it cannot reach', async () => {
  assert.deepEqual((await door.shared({ itemid: '/+1555/plans/2' }))?.related, [
    { title: 'A Plan', href: '/vault/+1555/plans/1' },
    { title: 'Away', href: '../../work/away.md' },
    { title: 'Old', href: '/vault/+1555/plans/9' }
  ])
  assert.deepEqual(
    (await door.shared({ itemid: '/+1555/plans/1' }))?.related,
    []
  )
})

it('leaves the session archive and dot folders out of the index', async () => {
  assert.equal(await door.shared({ itemid: '/+1555/plans/8' }), null)
  assert.equal(await door.shared({ itemid: '/+1555/plans/7' }), null)
  assert.equal(await door.note('Sessions/old.md'), null)
})

it('a note saved after a read is found once the door hears the change', async () => {
  assert.equal(await door.shared({ itemid: '/+1555/plans/5' }), null)
  await write_file(
    join(dir, 'Projects/e.md'),
    '---\nitemid: "/+1555/plans/5"\n---\n\n# E\n'
  )
  door.changed()
  assert.equal(
    (await door.shared({ itemid: '/+1555/plans/5' }))?.path,
    'Projects/e.md'
  )
})

it("reads one person's vault in storage the same way, and no one else's", async () => {
  const storage = store_of(disk(join(root, 'storage')))
  await storage.put(
    'people/+1555/vault/Projects/a.md',
    '---\nitemid: "/+1555/plans/1"\n---\n\n# Cloud\n'
  )
  await storage.put(
    'people/+1666/vault/Projects/z.md',
    '---\nitemid: "/+1666/plans/1"\n---\n\n# Theirs\n'
  )
  const cloud = vault_door({
    source: storage_source(storage, '+1555'),
    owner: '+1555'
  })
  assert.deepEqual(
    (await cloud.plans()).map(plan => plan.title),
    ['Cloud']
  )
  assert.equal(await cloud.shared({ itemid: '/+1666/plans/1' }), null)
  assert.match((await cloud.note('Projects/a.md')) ?? '', /# Cloud/)
  assert.equal((await cloud.search('cloud'))[0]?.path, 'Projects/a.md')
})
