import { test } from 'node:test'
import assert from 'node:assert/strict'
import sync_check from './index.js'
import { sync_check as wire } from './index.js'

const harness = turn => {
  const handlers = {}
  wire({ on: (name, handler) => (handlers[name] = handler) }, { turn })
  return handlers
}

test('a change starts the turn with one line', async () => {
  const handlers = harness(async () => 'Sync: 2 arrived, 0 wait')
  const out = await handlers.before_agent_start({ messageType: 'user' })
  assert.deepEqual(out.message, {
    customType: 'sync-check',
    content: 'Sync: 2 arrived, 0 wait',
    display: true
  })
})

test('no change adds nothing to the turn', async () => {
  const handlers = harness(async () => null)
  assert.equal(await handlers.before_agent_start({ messageType: 'user' }), undefined)
})

test('the check runs before every turn', async () => {
  let calls = 0
  const handlers = harness(async () => ((calls += 1), null))
  await handlers.before_agent_start({ messageType: 'user' })
  await handlers.before_agent_start({ messageType: 'user' })
  assert.equal(calls, 2)
})
