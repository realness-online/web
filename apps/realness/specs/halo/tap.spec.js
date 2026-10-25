import assert from 'node:assert/strict'
import { it } from 'node:test'
import { ensure_tap } from '../../src/halo/syscalls.js'

const recorder = ready => {
  const calls = []
  const options = {
    ready: () => ready,
    remove: name => calls.push(['remove', name]),
    create: name => calls.push(['create', name])
  }
  return { calls, options }
}

it("a woken actor's bare TAP is rebuilt with its gateway", () => {
  const { calls, options } = recorder(false)
  assert.equal(ensure_tap('fc-tap1', options), true)
  assert.deepEqual(calls, [
    ['remove', 'fc-tap1'],
    ['create', 'fc-tap1']
  ])
})

it('a ready TAP is left alone', () => {
  const { calls, options } = recorder(true)
  assert.equal(ensure_tap('fc-tap1', options), false)
  assert.deepEqual(calls, [])
})
