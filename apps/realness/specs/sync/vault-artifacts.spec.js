/**
 * v5: scratch files list and open from the app, inside their folder only.
 */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, it } from 'node:test'
import {
  artifact_file,
  artifact_list,
  inside
} from '#root/src/sync/vault-artifacts.js'

let base
let above

before(async () => {
  const made = await mkdtemp(join(tmpdir(), 'artifacts-'))
  base = join(made, 'artifacts')
  above = join(made, 'secret.txt')
  await mkdir(join(base, 'plans'), { recursive: true })
  await writeFile(join(base, 'plans', 'note.md'), '# A note\n')
  await writeFile(join(base, 'screen.png'), 'not really a png')
  await writeFile(join(base, '.hidden'), 'hidden')
  await writeFile(above, 'secret')
})

after(async () => {
  await rm(base, { recursive: true, force: true })
  await rm(above, { force: true })
})

it('lists folders first, then files, and leaves hidden entries out', async () => {
  const listed = await artifact_list(base)
  assert.deepEqual(
    listed.map(entry => [entry.name, entry.kind]),
    [
      ['plans', 'folder'],
      ['screen.png', 'file']
    ]
  )
  assert.equal(listed[0].path, 'plans')
  assert.ok(listed[1].size > 0)
})

it('lists one folder by its path', async () => {
  const listed = await artifact_list(base, 'plans')
  assert.deepEqual(
    listed.map(entry => entry.path),
    ['plans/note.md']
  )
})

it('opens a text file, and refuses a picture', async () => {
  assert.deepEqual(await artifact_file(base, 'plans/note.md'), {
    path: 'plans/note.md',
    text: '# A note\n'
  })
  assert.equal(await artifact_file(base, 'screen.png'), null)
  assert.equal(await artifact_file(base, 'plans'), null)
  assert.equal(await artifact_file(base, 'plans/missing.md'), null)
})

it('refuses any path that reaches above the folder', async () => {
  assert.equal(inside(base, '../secret.txt'), null)
  assert.equal(inside(base, 'plans/../../secret.txt'), null)
  assert.equal(inside(base, '/etc/passwd'), null)
  assert.deepEqual(await artifact_list(base, '..'), [])
  assert.equal(await artifact_file(base, '../secret.txt'), null)
  assert.equal(inside('', 'anything'), null)
})

it('keeps a path inside the folder when it belongs there', () => {
  assert.equal(inside(base, 'plans/note.md'), join(base, 'plans', 'note.md'))
  assert.equal(inside(base, ''), base)
})
