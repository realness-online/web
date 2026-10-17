import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ensureTap } from '../../src/halo/syscalls.js'

const recorder = ready => {
  const calls = []
  const options = {
    ready: () => ready,
    remove: name => calls.push(['remove', name]),
    create: name => calls.push(['create', name])
  }
  return { calls, options }
}

test("a woken actor's bare TAP is rebuilt with its gateway", () => {
  const { calls, options } = recorder(false)
  assert.equal(ensureTap('fc-tap1', options), true)
  assert.deepEqual(calls, [
    ['remove', 'fc-tap1'],
    ['create', 'fc-tap1']
  ])
})

test('a ready TAP is left alone', () => {
  const { calls, options } = recorder(true)
  assert.equal(ensureTap('fc-tap1', options), false)
  assert.deepEqual(calls, [])
})
