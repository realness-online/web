import { test } from 'node:test'
import assert from 'node:assert/strict'
import read_command from './index.js'

const handler = () => {
  const handlers = {}
  read_command({ on: (name, fn) => (handlers[name] = fn) })
  return handlers.tool_call
}

test('a bash page read is blocked with the realness-read command to run instead', () => {
  const result = handler()({ toolName: 'bash', input: { command: 'curl -sL https://example.com | grep title' } })
  assert.equal(result.block, true)
  assert.match(result.reason, /bin\/web\/realness-read 'https:\/\/example\.com'/)
})

test('other tools and allowed commands pass', () => {
  const check = handler()
  assert.equal(check({ toolName: 'read', input: { path: 'x' } }), undefined)
  assert.equal(check({ toolName: 'bash', input: { command: 'ls -la' } }), undefined)
  assert.equal(check({ toolName: 'bash', input: {} }), undefined)
})
