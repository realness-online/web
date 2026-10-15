import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdir, mkdtemp, rm, writeFile as write_file } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { run_harness } from '../../src/command/harness-command.js'

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

test('desktop turn-end logs the turn but does not sync unless opted in', async t => {
  const { root, state, output, io } = await harness(t)
  const session = join(root, 's.jsonl')
  const get_token = async () => {
    throw new Error('sync must not be reached')
  }
  assert.equal(
    await run_harness(['turn-start', '--session', session], {
      root,
      state,
      get_token,
      env: {},
      ...io
    }),
    0
  )
  assert.equal(
    await run_harness(
      ['turn-end', '--session', session, '--turn', '1', '--json'],
      { root, state, get_token, env: {}, ...io }
    ),
    0
  )
  assert.deepEqual(JSON.parse(output.at(-1)), {
    ok: true,
    command: 'turn-end',
    result: { logged: 0, synced: false }
  })
})

test('REALNESS_TURN_SYNC=1 restores the per-turn sync', async t => {
  const { root, state, io } = await harness(t)
  const session = join(root, 's.jsonl')
  let asked = false
  const get_token = async () => {
    asked = true
    return null
  }
  await run_harness(['turn-start', '--session', session], {
    root,
    state,
    get_token,
    env: {},
    ...io
  })
  await assert.rejects(
    run_harness(['turn-end', '--session', session, '--turn', '1'], {
      root,
      state,
      get_token,
      env: { REALNESS_TURN_SYNC: '1' },
      ...io
    }),
    /not signed in/
  )
  assert.equal(asked, true)
})
