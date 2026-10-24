import assert from 'node:assert/strict'
import { it } from 'node:test'
import { mkdir, mkdtemp, rm, writeFile as write_file } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  run_harness,
  SYNC_LOCAL_ONLY,
  SYNC_PAUSED
} from '../../src/command/harness-command.js'

const scratch = resolve(
  import.meta.dirname,
  '../../../../artifacts/realness/turn-sync-tests'
)

const harness = async t => {
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, 'h-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await write_file(
    join(root, 'package.json'),
    JSON.stringify({ realness: { plans: 'vault/plans' } })
  )
  const state = join(root, '.pi/agent/state')
  await mkdir(state, { recursive: true })
  const output = []
  const io = {
    stdout: { write: text => output.push(text) },
    stderr: { write: text => output.push(text) }
  }
  return { root, state, output, io }
}

it('desktop turn-end logs the turn but does not sync without the local stack', async t => {
  const { root, state, output, io } = await harness(t)
  const session = join(root, 's.jsonl')
  const target = async () => ({
    local: false,
    url: 'http://cloud.test',
    get_token: async () => {
      throw new Error('sync must not be reached')
    }
  })
  assert.equal(
    await run_harness(['turn-start', '--session', session], {
      root,
      state,
      target,
      ...io
    }),
    0
  )
  assert.equal(
    await run_harness(
      ['turn-end', '--session', session, '--turn', '1', '--json'],
      { root, state, target, ...io }
    ),
    0
  )
  assert.deepEqual(JSON.parse(output.at(-1)), {
    ok: true,
    command: 'turn-end',
    result: { logged: 0, synced: false }
  })
})

it('a sync-paused file stops turn-end and sync from uploading', async t => {
  const { root, state, output, io } = await harness(t)
  await write_file(join(state, SYNC_PAUSED), '')
  const session = join(root, 's.jsonl')
  const target = async () => ({
    local: true,
    url: 'http://127.0.0.1:8787',
    get_token: async () => {
      throw new Error('sync must not be reached')
    }
  })
  await run_harness(['turn-start', '--session', session], {
    root,
    state,
    target,
    ...io
  })
  for (const args of [
    ['turn-end', '--session', session, '--turn', '1', '--json'],
    ['sync', '--json']
  ]) {
    assert.equal(await run_harness(args, { root, state, target, ...io }), 0)
    assert.deepEqual(JSON.parse(output.at(-1)).result, { paused: true })
  }
})

it('sync-local-only never falls back to production', async t => {
  const { root, state, output, io } = await harness(t)
  await write_file(join(state, SYNC_LOCAL_ONLY), '')
  const target = async () => ({
    local: false,
    url: 'https://sync.realness.online',
    get_token: async () => {
      throw new Error('production must not be reached')
    }
  })
  assert.equal(
    await run_harness(['sync', '--json'], { root, state, target, ...io }),
    0
  )
  assert.deepEqual(JSON.parse(output.at(-1)).result, { local_only: true })
})

it('desktop turn-end syncs while the local stack is up', async t => {
  const { root, state, io } = await harness(t)
  const session = join(root, 's.jsonl')
  let asked = false
  const target = async () => ({
    local: true,
    url: 'http://127.0.0.1:8787',
    get_token: async () => {
      asked = true
      return null
    }
  })
  await run_harness(['turn-start', '--session', session], {
    root,
    state,
    target,
    ...io
  })
  await assert.rejects(
    run_harness(['turn-end', '--session', session, '--turn', '1'], {
      root,
      state,
      target,
      ...io
    }),
    /not signed in/
  )
  assert.equal(asked, true)
})
