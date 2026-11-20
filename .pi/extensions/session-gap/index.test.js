import { test } from 'node:test'
import assert from 'node:assert/strict'
import gap, { GAP_MS, gap_note, idle_ms } from './index.js'

test('the gap ends when the one-hour cache ends', () => {
  assert.equal(GAP_MS, 60 * 60 * 1000)
})

const at = minutes => new Date(Date.UTC(2026, 9, 7, 12, minutes)).toISOString()
const user = (text, minutes) => ({ type: 'message', timestamp: at(minutes), message: { role: 'user', content: text } })
const reply = (text, minutes) => ({
  type: 'message',
  timestamp: at(minutes),
  message: { role: 'assistant', content: [{ type: 'text', text }] }
})

test('idle time counts from the last entry, and only once someone has spoken', () => {
  assert.equal(idle_ms([{ type: 'model_change', timestamp: at(0) }], Date.parse(at(500))), null)
  assert.equal(idle_ms([user('hi', 0), reply('hello', 5)], Date.parse(at(65))), 60 * 60 * 1000)
  const opened = [
    user('hi', 0),
    reply('hello', 5),
    { type: 'thinking_level_change', timestamp: at(64) },
    { type: 'message', timestamp: at(64), message: { role: 'system', content: '' } }
  ]
  assert.equal(idle_ms(opened, Date.parse(at(65))), 60 * 60 * 1000)
})

test('the note points back to the old session and how it ended', () => {
  const note = gap_note([user('fix sync', 0), reply('Synced.', 1)], '/s/old.jsonl')
  assert.match(note, /continues \/s\/old\.jsonl/)
  assert.match(note, /remember tool/)
  assert.match(note, /Last request: fix sync/)
  assert.match(note, /Last reply: Synced\./)
})

const harness = entries => {
  const handlers = {},
    commands = {},
    sent = [],
    started = []
  const pi = {
    on: (name, fn) => {
      handlers[name] = fn
    },
    registerCommand: (name, spec) => {
      commands[name] = spec
    },
    sendUserMessage: (text, options) => sent.push([text, options])
  }
  gap(pi)
  const ctx = {
    mode: 'tui',
    sessionManager: { getBranch: () => entries, getSessionFile: () => '/s/old.jsonl' },
    newSession: async options => {
      const fresh = { messages: [], users: [] }
      await options.withSession({
        sendMessage: async m => fresh.messages.push(m),
        sendUserMessage: async m => fresh.users.push(m)
      })
      started.push({ options, fresh })
      return { cancelled: false }
    }
  }
  return { handlers, commands, sent, started, ctx }
}

test('a message after a long gap moves to a new session with the note first', async () => {
  const old = [user('a', 0), reply('b', 1)]
  old[1].timestamp = new Date(Date.now() - GAP_MS - 1000).toISOString()
  const { handlers, commands, sent, started, ctx } = harness(old)
  assert.deepEqual(await handlers.input({ text: 'next thing', source: 'interactive' }, ctx), { action: 'handled' })
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.deepEqual(sent, [['/gap-new', { expandPromptTemplates: true }]])
  await commands['gap-new'].handler('', ctx)
  assert.equal(started[0].options.parentSession, '/s/old.jsonl')
  assert.equal(started[0].fresh.messages[0].customType, 'session-gap')
  assert.deepEqual(started[0].fresh.users, ['next thing'])
})

test('recent sessions, commands, queued, and extension input stay put', async () => {
  const { handlers, ctx } = harness([user('a', 0), { ...reply('b', 1), timestamp: new Date().toISOString() }])
  const cont = { action: 'continue' }
  assert.deepEqual(await handlers.input({ text: 'more', source: 'interactive' }, ctx), cont)
  const stale = harness([user('a', 0)])
  assert.deepEqual(await stale.handlers.input({ text: '/model', source: 'interactive' }, stale.ctx), cont)
  assert.deepEqual(await stale.handlers.input({ text: 'x', source: 'extension' }, stale.ctx), cont)
  assert.deepEqual(
    await stale.handlers.input({ text: 'x', source: 'interactive', streamingBehavior: 'steer' }, stale.ctx),
    cont
  )
})

test('print mode never switches, since they cannot run the follow-up', async () => {
  const stale = harness([user('a', 0)])
  stale.ctx.mode = 'print'
  assert.deepEqual(await stale.handlers.input({ text: 'x', source: 'interactive' }, stale.ctx), { action: 'continue' })
})

test('session shutdown clears a pending switch', async () => {
  const cleared = []
  const real_set = globalThis.setTimeout
  const real_clear = globalThis.clearTimeout
  globalThis.setTimeout = () => 42
  globalThis.clearTimeout = id => cleared.push(id)
  try {
    const old = [user('a', 0), reply('b', 1)]
    old[1].timestamp = new Date(Date.now() - GAP_MS - 1000).toISOString()
    const { handlers, ctx } = harness(old)
    await handlers.input({ text: 'next', source: 'interactive' }, ctx)
    handlers.session_shutdown()
    assert.deepEqual(cleared, [42])
  } finally {
    globalThis.setTimeout = real_set
    globalThis.clearTimeout = real_clear
  }
})

test('a context that goes stale before the timer cannot crash pi', async () => {
  const scheduled = []
  const notified = []
  const real_set = globalThis.setTimeout
  globalThis.setTimeout = fn => {
    scheduled.push(fn)
    return 7
  }
  try {
    const old = [user('a', 0), reply('b', 1)]
    old[1].timestamp = new Date(Date.now() - GAP_MS - 1000).toISOString()
    const handlers = {}
    const pi = {
      on: (name, fn) => {
        handlers[name] = fn
      },
      registerCommand: () => {},
      sendUserMessage: () => {
        throw new Error('stale pi')
      }
    }
    let stale = false
    const ctx = {
      mode: 'tui',
      sessionManager: {
        getBranch: () => old,
        getSessionFile: () => '/s/old.jsonl'
      },
      get ui() {
        if (stale) throw new Error('stale ctx')
        return { notify: (...args) => notified.push(args) }
      }
    }
    gap(pi)
    await handlers.input({ text: 'next', source: 'interactive' }, ctx)
    stale = true
    assert.doesNotThrow(() => scheduled[0]())
    assert.equal(notified.length, 1)
  } finally {
    globalThis.setTimeout = real_set
  }
})
