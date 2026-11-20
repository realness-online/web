import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import watch, { digest, shape_of } from './index.js'

const payload = (overrides = {}) => ({
  system: 'rules',
  tools: [{ name: 'read' }, { name: 'bash' }],
  messages: [{ role: 'user', content: 'hi' }],
  ...overrides
})

test('a later message does not change the shape', () => {
  const more = [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: 'x' }
  ]
  assert.equal(shape_of(payload()), shape_of(payload({ messages: more })))
})

test('a changed system prompt or tool list changes the shape', () => {
  assert.notEqual(shape_of(payload()), shape_of(payload({ system: 'other rules' })))
  assert.notEqual(shape_of(payload()), shape_of(payload({ tools: [{ name: 'read' }] })))
})

test('the tool order does not change the shape', () => {
  assert.equal(shape_of(payload()), shape_of(payload({ tools: [{ name: 'bash' }, { name: 'read' }] })))
})

test('a digest is short and follows the text', () => {
  assert.equal(digest('a').length, 12)
  assert.equal(digest('a'), digest('a'))
  assert.notEqual(digest('a'), digest('b'))
})

const scratch = mkdtempSync(join('artifacts', 'cold-watch-'))
process.on('exit', () => rmSync(scratch, { recursive: true, force: true }))

const harness = () => {
  const handlers = {}
  const file = join(scratch, 'cold.html')
  watch({ on: (name, fn) => (handlers[name] = fn) }, { file })
  const usage = (one = {}) => ({
    cacheRead: one.read ?? 0,
    cacheWrite: one.write ?? 50_000,
    input: one.input ?? 4_000,
    output: 200
  })
  const turn = one =>
    handlers.message_end({ message: { role: 'assistant', provider: 'anthropic', model: 'opus', usage: usage(one) } })
  return {
    handlers,
    file,
    turn,
    html: () => {
      try {
        return readFileSync(file, 'utf8')
      } catch {
        return ''
      }
    }
  }
}

test('a warm turn with the same shape writes nothing', async () => {
  const { handlers, turn, html } = harness()
  handlers.before_provider_request({ payload: payload() })
  await turn({ read: 40_000, write: 0 })
  assert.equal(html(), '')
})

test('a cold turn after the same shape is the provider dropping the cache', async () => {
  const { handlers, turn, html } = harness()
  handlers.before_provider_request({ payload: payload() })
  await turn({ read: 40_000, write: 0 })
  handlers.before_provider_request({ payload: payload() })
  await turn({})
  assert.match(html(), /itemprop="cold">yes</)
  assert.match(html(), /itemprop="shape">same</)
})

test('a cold turn after a shape change is ours', async () => {
  const { handlers, turn, html } = harness()
  handlers.before_provider_request({ payload: payload() })
  await turn({ read: 40_000, write: 0 })
  handlers.before_provider_request({ payload: payload({ tools: [{ name: 'read' }] }) })
  await turn({})
  assert.match(html(), /itemprop="shape">changed</)
})
