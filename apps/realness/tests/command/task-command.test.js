import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { out_path } from '#root/lib/output.js'
import { run_task } from '../../src/command/task-command.js'

const sink = () => {
  let text = ''
  return {
    write: chunk => {
      text += chunk
    },
    written: () => text
  }
}

/** A harness root with one plan that names two Syncs folders. */
const make_root = () => {
  mkdirSync(out_path(), { recursive: true })
  const root = mkdtempSync(out_path('task-command-'))
  mkdirSync(join(root, 'vault/plans'), { recursive: true })
  writeFileSync(
    join(root, 'vault/plans/ship.md'),
    '# Ship\n\n## Syncs\n\n- `apps/realness`\n- `work/pi`\n'
  )
  return root
}

const gate_reply = (status, payload) => async () => ({
  status,
  json: async () => payload,
  text: async () => JSON.stringify(payload)
})

test('a task without a plan prints usage and exits 2', async () => {
  const stderr = sink()
  const code = await run_task(['--start'], { stderr })
  assert.equal(code, 2)
  assert.match(stderr.written(), /usage: realness task <plan>/)
})

test('a task lists the plan paths it may touch', async () => {
  const root = make_root()
  const stdout = sink()
  try {
    const code = await run_task(['ship'], { root, stdout })
    assert.equal(code, 0)
    assert.match(stdout.written(), /^ship: \d+ paths\n/)
    assert.match(stdout.written(), /apps\/realness/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('--json reports the plan, its paths, and no actor without --start', async () => {
  const root = make_root()
  const stdout = sink()
  try {
    const code = await run_task(['ship', '--json'], { root, stdout })
    assert.equal(code, 0)
    const answer = JSON.parse(stdout.written())
    assert.equal(answer.ok, true)
    assert.equal(answer.command, 'task')
    assert.equal(answer.result.plan, 'ship')
    assert.ok(answer.result.paths.length > 0)
    assert.equal(answer.result.actor, null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('an unknown plan is refused by name', async () => {
  const root = make_root()
  try {
    await assert.rejects(run_task(['missing'], { root }), /no plan missing\.md/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('--start needs a token', async () => {
  const root = make_root()
  try {
    await assert.rejects(
      run_task(['ship', '--start'], { root, get_token: async () => null }),
      /not signed in/
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('--start asks the gate for a VM and names it', async () => {
  const root = make_root()
  const stdout = sink()
  try {
    const asked = []
    const code = await run_task(['ship', '--start'], {
      root,
      stdout,
      get_token: async () => 'token',
      gate_url: 'https://gate',
      fetcher: async (url, init) => {
        asked.push([url, init])
        return gate_reply(201, { id: 'a-abcdef123456' })()
      }
    })
    assert.equal(code, 0)
    assert.equal(asked[0][0], 'https://gate/v1/actors')
    const sent = JSON.parse(asked[0][1].body)
    assert.ok(Array.isArray(sent.paths))
    assert.match(stdout.written(), /started a-abcdef123456/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('--start reports a gate refusal with its status and body', async () => {
  const root = make_root()
  try {
    await assert.rejects(
      run_task(['ship', '--start'], {
        root,
        get_token: async () => 'token',
        gate_url: 'https://gate',
        fetcher: gate_reply(403, { error: 'no capacity' })
      }),
      /the gate refused the task: 403/
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
