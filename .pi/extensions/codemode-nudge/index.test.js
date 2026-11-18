import { test } from 'node:test'
import assert from 'node:assert/strict'
import nudge, { NUDGE } from './index.js'

const harness = () => {
  const handlers = {}
  nudge({ on: (name, fn) => (handlers[name] = fn) })
  const result = (toolName, extra = {}) =>
    handlers.tool_result({ toolName, content: [{ type: 'text', text: 'ok' }], ...extra })
  return { handlers, result }
}

test('the third direct call in a reply gets the nudge, once', async () => {
  const { result } = harness()
  assert.equal(await result('bash'), undefined)
  assert.equal(await result('read'), undefined)
  const third = await result('bash')
  assert.equal(third.content.at(-1).text, NUDGE)
  assert.equal(third.content[0].text, 'ok')
  assert.equal(await result('bash'), undefined)
})

test('codemode and its inner calls never count', async () => {
  const { result } = harness()
  await result('codemode')
  await result('bash', { parentToolCallId: 'x' })
  await result('bash', { parentToolCallId: 'x' })
  await result('bash')
  assert.equal(await result('read'), undefined)
})

test('a new turn resets the count', async () => {
  const { handlers, result } = harness()
  await result('bash')
  await result('bash')
  await handlers.turn_start({})
  assert.equal(await result('bash'), undefined)
})
