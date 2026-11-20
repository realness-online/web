import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import audit, { SETTLE_MS, tree_memory } from './index.js'

test('stops both checks after the agent settles and starts them on the next event', () => {
  const handlers = new Map()
  const pi = { on: (name, handler) => handlers.set(name, [...(handlers.get(name) ?? []), handler]) }
  const fire = (name, ...args) => handlers.get(name).forEach(handler => handler(...args))
  const live = new Set()
  const real_set = globalThis.setInterval
  const real_clear = globalThis.clearInterval
  const real_now = performance.now
  let clock = 0
  performance.now = () => clock
  globalThis.setInterval = (fn, ms) => {
    const id = { fn, ms, unref() {} }
    live.add(id)
    return id
  }
  globalThis.clearInterval = id => live.delete(id)
  const lag_timers = () => [...live].filter(id => id.ms === 100)
  try {
    audit(pi)
    fire('input', {}, { hasUI: false })
    clock = SETTLE_MS + 1
    lag_timers()[0].fn()
    assert.equal(live.size, 2)
    fire('agent_settled', {}, { hasUI: false })
    clock = 2 * SETTLE_MS + 2
    lag_timers()[0].fn()
    assert.equal(live.size, 0)
    fire('input', {}, { hasUI: false })
    assert.equal(live.size, 2)
  } finally {
    globalThis.setInterval = real_set
    globalThis.clearInterval = real_clear
    performance.now = real_now
  }
})

test('warns of a freeze only while the person waits', () => {
  const handlers = new Map()
  const pi = { on: (name, handler) => handlers.set(name, [...(handlers.get(name) ?? []), handler]) }
  const fire = (name, ...args) => handlers.get(name).forEach(handler => handler(...args))
  const dir = mkdtempSync(join(tmpdir(), 'audit-'))
  const warned = []
  const ctx = { hasUI: true, ui: { notify: text => warned.push(text), onTerminalInput: () => () => {} } }
  const live = []
  const real_set = globalThis.setInterval
  const real_now = performance.now
  let clock = 0
  performance.now = () => clock
  globalThis.setInterval = (fn, ms) => {
    const id = { fn, ms, unref() {} }
    live.push(id)
    return id
  }
  const freeze = () => {
    clock += 2000
    live
      .filter(id => id.ms === 100)
      .at(-1)
      .fn()
  }
  try {
    audit(pi, dir)
    fire('agent_settled', {}, ctx)
    freeze()
    assert.equal(warned.length, 0)
    fire('turn_start', {}, ctx)
    freeze()
    assert.equal(warned.length, 1)
    fire('session_shutdown')
  } finally {
    globalThis.setInterval = real_set
    performance.now = real_now
    rmSync(dir, { recursive: true, force: true })
  }
})

test('profiles the next turn after a freeze over 2 s, once', async () => {
  const handlers = new Map()
  const pi = { on: (name, handler) => handlers.set(name, [...(handlers.get(name) ?? []), handler]) }
  const fire = (name, ...args) => Promise.all(handlers.get(name).map(handler => handler(...args)))
  const dir = mkdtempSync(join(tmpdir(), 'audit-'))
  const ctx = { hasUI: false }
  const live = []
  const real_set = globalThis.setInterval
  const real_now = performance.now
  let clock = 0
  performance.now = () => clock
  globalThis.setInterval = (fn, ms) => {
    const id = { fn, ms, unref() {} }
    live.push(id)
    return id
  }
  const freeze = ms => {
    clock += ms
    live
      .filter(id => id.ms === 100)
      .at(-1)
      .fn()
  }
  const profiles = () => (readdirSync(dir).includes('profiles') ? readdirSync(join(dir, 'profiles')) : [])
  try {
    audit(pi, dir)
    await fire('turn_start', {}, ctx)
    freeze(1500)
    await fire('turn_end', {}, ctx)
    assert.equal(profiles().length, 0)
    freeze(2500)
    await fire('turn_start', {}, ctx)
    await fire('turn_end', {}, ctx)
    assert.equal(profiles().length, 1)
    freeze(2500)
    await fire('turn_start', {}, ctx)
    await fire('turn_end', {}, ctx)
    assert.equal(profiles().length, 1)
    await fire('session_shutdown')
  } finally {
    globalThis.setInterval = real_set
    performance.now = real_now
    rmSync(dir, { recursive: true, force: true })
  }
})

test('stops its timers when the session shuts down', () => {
  const handlers = new Map()
  const pi = { on: (name, handler) => handlers.set(name, [...(handlers.get(name) ?? []), handler]) }
  const fire = (name, ...args) => handlers.get(name).forEach(handler => handler(...args))
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
    audit(pi)
    fire('session_shutdown')
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

test('logs the last raw keys before each typed submit', () => {
  const handlers = new Map()
  const pi = { on: (name, handler) => handlers.set(name, [...(handlers.get(name) ?? []), handler]) }
  const fire = (name, ...args) => handlers.get(name).forEach(handler => handler(...args))
  const dir = mkdtempSync(join(tmpdir(), 'audit-'))
  /** @type {(data: string) => void} */
  let feed = () => {}
  let unsubscribed = false
  const ui = {
    notify() {},
    onTerminalInput: listener => {
      feed = listener
      return () => (unsubscribed = true)
    }
  }
  const real_now = performance.now
  let clock = 0
  performance.now = () => clock
  try {
    audit(pi, dir)
    fire('session_start', {}, { hasUI: true, ui })
    for (let n = 0; n < 25; n++) {
      clock += 100
      feed(String(n % 10))
    }
    feed('x'.repeat(40))
    clock += 5
    feed('\r')
    fire('input', { text: 'hello', source: 'interactive' }, { hasUI: true, ui })
    fire('input', { text: 'from code', source: 'extension' }, { hasUI: true, ui })
    clock += 30
    feed('\u001b[13;1:3u')
    fire('session_shutdown')
  } finally {
    performance.now = real_now
  }
  const lines = readFileSync(join(dir, 'keys.log'), 'utf8').trim().split('\n')
  assert.equal(lines.length, 2)
  assert.match(
    lines[0],
    /submit text="hello" keys=\["7","8","9","0","1","2","3","4","5","6","7","8","9","0","1","2","3","4","<40 chars>","\\r"\] gaps=\[0(,100){17},0,5\]$/
  )
  assert.match(lines[1], /after text="hello" keys=\["\\u001b\[13;1:3u"\] gaps=\[30\]$/)
  assert.equal(unsubscribed, true)
  rmSync(dir, { recursive: true })
})
