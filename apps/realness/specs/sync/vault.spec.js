/**
 * The vault door resolves a stored key or itemid to one note.
 */
import { after, before, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { vault_door } from '#root/src/sync/vault.js'
import { out_path } from '#root/lib/output.js'

const root = out_path(`vault-find-test-${randomUUID()}/`)
const index = join(root, 'memory.db')
const dir = join(root, 'vault')

before(async () => {
  await mkdir(dir, { recursive: true })
  const db = new DatabaseSync(index)
  db.exec('CREATE TABLE note (path TEXT PRIMARY KEY, title TEXT, text TEXT)')
  db.prepare('INSERT INTO note(path, title, text) VALUES (?, ?, ?)').run(
    'Projects/a.md',
    'a',
    '---\nitemid: "/+1555/plans/1"\nkey: "abc_def"\n---\n\n# Body\n'
  )
  db.close()
})

after(async () => rm(root, { recursive: true, force: true }))

const door = vault_door({ dir, index, owner: '+1555' })

it('finds a note by its stored key and hides the frontmatter', () => {
  const found = door.find({ key: 'abc_def' })
  assert.equal(found?.path, 'Projects/a.md')
  assert.equal(found?.text, '\n# Body\n')
  assert.equal(found?.itemid, '/+1555/plans/1')
})

it('finds a note by itemid', () => {
  const found = door.find({ itemid: '/+1555/plans/1' })
  assert.equal(found?.path, 'Projects/a.md')
  assert.equal(found?.text, '\n# Body\n')
})

it('returns null for an unknown value', () => {
  assert.equal(door.find({ key: 'nope' }), null)
  assert.equal(door.find({ itemid: '/+1555/plans/2' }), null)
})
