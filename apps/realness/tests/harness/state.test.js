import assert from 'node:assert/strict'
import {
  mkdir,
  mkdtemp,
  readFile as read_file,
  rm,
  writeFile as write_file
} from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { prepare_actor_state } from '../../src/harness/state.js'

const artifacts = new URL(
  '../../../../artifacts/brayness/state-tests/',
  import.meta.url
).pathname
const fixture = async t => {
  await mkdir(artifacts, { recursive: true })
  const root = await mkdtemp(join(artifacts, 'run-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

test('actor state survives removal of temporary artifacts, including legacy records', async t => {
  const root = await fixture(t)
  await mkdir(join(root, 'artifacts/sync-state'), { recursive: true })
  await mkdir(join(root, 'artifacts/sync-recovery'), { recursive: true })
  await write_file(
    join(root, 'artifacts/sync-state/edits.db'),
    'saved edit records'
  )
  await write_file(
    join(root, 'artifacts/sync-recovery/url'),
    'https://sync.example\n'
  )
  const state = join(root, '.pi/agent/state')
  assert.equal(await prepare_actor_state(root, { state }), state)
  await rm(join(root, 'artifacts'), { recursive: true })
  assert.equal(
    await read_file(join(state, 'edits.db'), 'utf8'),
    'saved edit records'
  )
  assert.equal(
    await read_file(join(state, 'recovery/url'), 'utf8'),
    'https://sync.example\n'
  )
})

test('state migration refuses to overwrite another history', async t => {
  const root = await fixture(t)
  const state = join(root, '.pi/agent/state')
  await mkdir(state, { recursive: true })
  await mkdir(join(root, 'artifacts/sync-state'), { recursive: true })
  await assert.rejects(
    prepare_actor_state(root, { state }),
    /both legacy and current/
  )
})
