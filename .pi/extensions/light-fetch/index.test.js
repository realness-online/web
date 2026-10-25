import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import light, { harness_path } from './index.js'

mkdirSync(new URL('../../../artifacts/realness/', import.meta.url), { recursive: true })

const setup = (options, { lands = true } = {}) => {
  const handlers = {},
    fetched = []
  const fetch_file = async path => {
    fetched.push(path)
    if (lands) writeFileSync(join(options.root, path), 'bytes')
  }
  light(
    {
      on: (name, fn) => {
        handlers[name] = fn
      }
    },
    { ...options, fetch_file }
  )
  return { handlers, fetched }
}

test('paths resolve inside the harness only', () => {
  assert.equal(harness_path('/realness', '/realness/work', '../vault/a.md'), 'vault/a.md')
  assert.equal(
    harness_path('/realness', '/realness', '@/realness/.pi/agent/sessions/x.jsonl'),
    '.pi/agent/sessions/x.jsonl'
  )
  assert.equal(harness_path('/realness', '/realness', '/etc/passwd'), null)
})

test('outside a VM it registers nothing', () => {
  assert.deepEqual(setup({ actor: false }).handlers, {})
})

test('reading a skipped file fetches it first; other reads pass', async () => {
  const root = mkdtempSync(join(new URL('../../../artifacts/realness/', import.meta.url).pathname, 'light-fetch-'))
  const state = join(root, 'state')
  mkdirSync(state)
  mkdirSync(join(root, 'work'))
  writeFileSync(join(state, 'light.json'), JSON.stringify({ skipped: ['work/big.bin'] }))
  const { handlers, fetched } = setup({ actor: true, root, state })
  assert.equal(
    await handlers.tool_call({ toolName: 'read', input: { path: 'work/big.bin' } }, { cwd: root }),
    undefined
  )
  await handlers.tool_call({ toolName: 'read', input: { path: 'work/small.md' } }, { cwd: root })
  await handlers.tool_call({ toolName: 'bash', input: { command: 'cat work/big.bin' } }, { cwd: root })
  assert.deepEqual(fetched, ['work/big.bin'])
  rmSync(root, { recursive: true, force: true })
})

test('a fetch that exits cleanly but brings nothing blocks the read', async () => {
  const root = mkdtempSync(join(new URL('../../../artifacts/realness/', import.meta.url).pathname, 'light-fetch-'))
  const state = join(root, 'state')
  mkdirSync(state)
  writeFileSync(join(state, 'light.json'), JSON.stringify({ skipped: ['old.jsonl'] }))
  const { handlers } = setup({ actor: true, root, state }, { lands: false })
  const result = await handlers.tool_call({ toolName: 'read', input: { path: 'old.jsonl' } }, { cwd: root })
  assert.equal(result.block, true)
  assert.match(result.reason, /did not bring it here/)
  rmSync(root, { recursive: true, force: true })
})
