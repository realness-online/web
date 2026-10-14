import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile as write_file } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { harness_exclude } from '../../src/harness/harness.js'

const artifacts = new URL(
  '../../../../artifacts/brayness/state-exclude/',
  import.meta.url
).pathname

test('persistent state is excluded even when the personal ignore file is empty', async t => {
  await mkdir(artifacts, { recursive: true })
  const root = await mkdtemp(join(artifacts, 'run-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await write_file(join(root, '.ignore'), '')
  const exclude = await harness_exclude(root)
  assert.equal(exclude('.pi/agent/state', true), true)
  assert.equal(exclude('.pi/agent/state/edits.db', false), true)
  assert.equal(exclude('vault/note.md', false), false)
})
