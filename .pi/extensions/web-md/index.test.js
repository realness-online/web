import { test } from 'node:test'
import assert from 'node:assert/strict'
import web_md from './index.js'

const handler = () => {
  const handlers = {}
  web_md({ on: (name, fn) => (handlers[name] = fn) })
  return handlers.tool_call
}

test('a bash page read is blocked with the web-md command to run instead', () => {
  const result = handler()({ toolName: 'bash', input: { command: 'curl -sL https://example.com | grep title' } })
  assert.equal(result.block, true)
  assert.match(result.reason, /bin\/web-md\.js 'https:\/\/example\.com'/)
})

test('other tools and allowed commands pass', () => {
  const check = handler()
  assert.equal(check({ toolName: 'read', input: { path: 'x' } }), undefined)
  assert.equal(check({ toolName: 'bash', input: { command: 'ls -la' } }), undefined)
  assert.equal(check({ toolName: 'bash', input: {} }), undefined)
})
