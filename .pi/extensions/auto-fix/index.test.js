import assert from 'node:assert/strict'
import { test } from 'node:test'
import auto_fix, { inside } from './index.js'

test('only files inside the working folder are collected', () => {
  assert.equal(inside('src/a.js', '/repo'), '/repo/src/a.js')
  assert.equal(inside('/repo/b.md', '/repo'), '/repo/b.md')
  assert.equal(inside('/elsewhere/c.js', '/repo'), null)
  assert.equal(inside(undefined, '/repo'), null)
})

test('a run that edits nothing fixes nothing and says nothing', async () => {
  const handlers = {}
  const notes = []
  auto_fix({
    on: (name, fn) => {
      handlers[name] = fn
    }
  })
  const ctx = { cwd: '/repo', ui: { notify: (...args) => notes.push(args) } }
  handlers.agent_start()
  await handlers.tool_result({ toolName: 'bash', input: { command: 'ls' } }, ctx)
  await handlers.tool_result({ toolName: 'edit', isError: true, input: { path: 'a.js' } }, ctx)
  await handlers.agent_end({}, ctx)
  assert.deepEqual(notes, [])
})
