import assert from 'node:assert/strict'
import { test } from 'node:test'
import lag_probe, { tree_memory } from './index.js'

test('stops its timers when the session shuts down', () => {
  const handlers = new Map()
  const pi = { on: (name, handler) => handlers.set(name, handler) }
  const intervals = []
  const cleared = []
  const real_set = globalThis.setInterval
  const real_clear = globalThis.clearInterval
  globalThis.setInterval = () => {
    const id = { unref() {} }
    intervals.push(id)
    return id
  }
  globalThis.clearInterval = id => cleared.push(id)
  try {
    lag_probe(pi)
    handlers.get('session_shutdown')()
    assert.deepEqual(cleared, intervals)
  } finally {
    globalThis.setInterval = real_set
    globalThis.clearInterval = real_clear
  }
})

test('tree_memory sums pi and every process under it', () => {
  const ps = [
    '  1     0  1024 /sbin/launchd',
    ' 10     1 204800 /usr/local/bin/node',
    ' 11    10 1048576 /usr/bin/vitest',
    ' 12    11  10240 esbuild',
    ' 20     1 999999 /Applications/Brave'
  ].join('\n')
  assert.deepEqual(tree_memory(ps, 10), {
    total_mb: 1234,
    count: 3,
    top: [
      { pid: 11, mb: 1024, name: 'vitest' },
      { pid: 10, mb: 200, name: 'node' },
      { pid: 12, mb: 10, name: 'esbuild' }
    ]
  })
})
