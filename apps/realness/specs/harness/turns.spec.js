import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { after, it } from 'node:test'
import { edit_log } from '#root/src/files/edits.js'
import { turn_end, turn_start } from '#root/src/harness/turns.js'

const root = new URL(
  `../../../../artifacts/realness/turns-test-${randomUUID()}/`,
  import.meta.url
).pathname
after(() => rm(root, { recursive: true, force: true }))

const files = async (dir, entries) => {
  for (const [path, body] of Object.entries(entries)) {
    await mkdir(join(dir, path, '..'), { recursive: true })
    await writeFile(join(dir, path), body)
  }
}

it('a turn owns what changed during it, bash deletes included; outside edits stay unexplained', async () => {
  const harness = join(root, 'harness')
  const state = join(root, 'state')
  await files(harness, {
    'vault/plans/p.md': '## Syncs\n\n- notes\n',
    'notes/gone.md': 'g',
    'notes/edited.md': 'e',
    'notes/outside.md': 'o',
    'notes/node_modules/x.js': 'x'
  })
  await writeFile(join(harness, 'notes/outside.md'), 'edited between turns')

  await turn_start({ root: harness, state, session: 's.jsonl' })
  await rm(join(harness, 'notes/gone.md'))
  await writeFile(join(harness, 'notes/edited.md'), 'edited by a script')
  await files(harness, { 'notes/new.md': 'n', 'notes/node_modules/y.js': 'y' })
  const logged = await turn_end({
    root: harness,
    state,
    session: 's.jsonl',
    turn: 3
  })

  assert.deepEqual(
    logged.map(path => path.slice(harness.length + 1)),
    ['notes/edited.md', 'notes/gone.md', 'notes/new.md']
  )
  const log = edit_log(join(state, 'edits.db'))
  assert.ok(log.explained(join(harness, 'notes/gone.md'), null))
  assert.equal(log.last(join(harness, 'notes/edited.md')).turn, 3)
  assert.equal(log.last(join(harness, 'notes/outside.md')), undefined)
  log.close()
})

it('a turn logs a selected single file', async () => {
  const harness = join(root, 'single')
  const state = join(root, 'single-state')
  await files(harness, {
    'vault/plans/p.md': '## Syncs\n\n- AGENTS.md\n',
    'AGENTS.md': 'a'
  })
  await turn_start({ root: harness, state, session: 's.jsonl' })
  await writeFile(join(harness, 'AGENTS.md'), 'changed')
  const logged = await turn_end({
    root: harness,
    state,
    session: 's.jsonl',
    turn: 1
  })
  assert.deepEqual(logged, [join(harness, 'AGENTS.md')])
})

it('a turn ignores trees sync never carries', async () => {
  const harness = join(root, 'own')
  const state = join(root, 'own-state')
  await files(harness, {
    '.ignore': '',
    'vault/plans/p.md': 'p',
    'AGENTS.md': 'a',
    'apps/npm-bin/cmd.js': 'v1',
    '.pi/agent/npm/pkg.js': 'v1'
  })
  await turn_start({ root: harness, state, session: 's.jsonl' })
  await writeFile(join(harness, 'apps/npm-bin/cmd.js'), 'v2')
  await writeFile(join(harness, '.pi/agent/npm/pkg.js'), 'v2')
  await writeFile(join(harness, 'AGENTS.md'), 'a2')
  const logged = await turn_end({
    root: harness,
    state,
    session: 's.jsonl',
    turn: 1
  })
  assert.deepEqual(
    logged.map(path => path.slice(harness.length + 1)),
    ['AGENTS.md']
  )
})

it('turn_end without a turn_start logs nothing', async () => {
  assert.deepEqual(
    await turn_end({
      root,
      state: join(root, 'empty'),
      session: 'none',
      turn: 0
    }),
    []
  )
})
