import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { join } from 'node:path'
import { bridge, history_of, prints_only } from './index.js'

const scratch = new URL('../../../artifacts/', import.meta.url).pathname

const MODELS = [
  { provider: 'realness', id: 'fast', name: 'Fast' },
  { provider: 'realness', id: 'deep', name: 'Deep' }
]

/** A stand-in Pi: records handlers, messages, and session control calls; idles on demand. */
function fake_pi() {
  const handlers = {}
  const commands = {}
  const pi = {
    sent: [],
    options: [],
    calls: [],
    idle: true,
    thinking: 'medium',
    on: (name, handler) => (handlers[name] = handler),
    emit: (name, event = {}) => handlers[name]?.({ type: name, ...event }, pi.ctx),
    registerCommand: (name, options) => (commands[name] = options),
    sendUserMessage: (message, options) => {
      if (options?.expandPromptTemplates && message.startsWith('/')) {
        const [name, ...rest] = message.slice(1).split(' ')
        if (commands[name]) return void commands[name].handler(rest.join(' '), pi.command_ctx)
      }
      pi.sent.push(message)
      pi.options.push(options)
    },
    getThinkingLevel: () => pi.thinking,
    setThinkingLevel: level => {
      pi.calls.push(['thinking', level])
      pi.thinking = level
    },
    setModel: async model => {
      pi.calls.push(['model', model.id])
      pi.ctx.model = model
      return true
    }
  }
  pi.entries = []
  pi.ctx = {
    model: MODELS[0],
    isIdle: () => pi.idle,
    abort: () => pi.calls.push(['abort']),
    compact: options => {
      pi.calls.push(['compact', options?.customInstructions])
      options?.onComplete?.({})
    },
    modelRegistry: {
      getAvailable: () => MODELS,
      find: (provider, id) => MODELS.find(m => m.provider === provider && m.id === id)
    },
    sessionManager: {
      getBranch: () => pi.entries,
      appendMessage: message => pi.entries.push({ type: 'message', message }),
      appendCustomEntry: (customType, data) => pi.entries.push({ type: 'custom', customType, data })
    }
  }
  pi.command_ctx = {
    ...pi.ctx,
    newSession: async (options = {}) => {
      pi.calls.push(['new'])
      if (pi.cancel_new) return { cancelled: true }
      pi.entries = []
      await options.setup?.(pi.ctx.sessionManager)
      pi.emit('session_start')
      await options.withSession?.(pi.ctx)
      return { cancelled: false }
    }
  }
  return pi
}

const command = (path, name, args) =>
  ask(path, JSON.stringify({ command: name, ...(args === undefined ? {} : { args }) }))

/** Write one line, collect every reply line until the socket closes. */
function ask(path, line, during = () => {}) {
  return new Promise((resolve, reject) => {
    const replies = []
    let buffer = ''
    const socket = connect(path, () => socket.write(line + '\n'))
    socket.setEncoding('utf8')
    socket.on('error', reject)
    socket.on('data', chunk => {
      buffer += chunk
      replies.push(
        ...buffer
          .split('\n')
          .slice(0, -1)
          .map(text => JSON.parse(text))
      )
      buffer = buffer.slice(buffer.lastIndexOf('\n') + 1)
    })
    socket.on('close', () => resolve(replies))
    setTimeout(during, 50)
    setTimeout(() => socket.destroy(), 2000).unref()
  })
}

function setup() {
  mkdirSync(scratch, { recursive: true })
  const dir = mkdtempSync(join(scratch, 'chat-bridge-'))
  const path = join(dir, 'pi.sock')
  const pi = fake_pi()
  const handover_path = join(dir, 'handover.json')
  const server = bridge(pi, { socket_path: path, chat_prompt: 'CHAT', handover_path })
  pi.emit('session_start')
  const close = () => {
    server.close()
    rmSync(dir, { recursive: true, force: true })
  }
  return { pi, path, close, handover_path }
}

test('handover imports exact browser messages before issuing a receipt and is retry-safe', async () => {
  const { pi, path, close, handover_path } = setup()
  const message = { role: 'user', content: 'Remember cedar', timestamp: 1 }
  writeFileSync(
    handover_path,
    JSON.stringify({
      version: 1,
      handover_id: 'handover-1',
      conversation_id: 1,
      stores: { entries: [{ value: { id: 7, commitSeq: 2, entry: { id: 7, conversationId: 1, model: [message] } } }] }
    })
  )
  try {
    assert.deepEqual(await command(path, 'handover'), [{ type: 'done', resumed: true, handover_id: 'handover-1' }])
    assert.deepEqual(pi.entries[0].message, message)
    assert.deepEqual(await command(path, 'handover'), [{ type: 'done', resumed: true, handover_id: 'handover-1' }])
    assert.deepEqual(pi.calls, [['new']])
    assert.deepEqual(pi.sent, [])
  } finally {
    close()
  }
})

test('cancelled handover never returns a resumed receipt', async () => {
  const { pi, path, close, handover_path } = setup()
  pi.cancel_new = true
  writeFileSync(
    handover_path,
    JSON.stringify({
      version: 1,
      handover_id: 'handover-2',
      conversation_id: 1,
      stores: {
        entries: [
          {
            value: {
              id: 7,
              commitSeq: 2,
              entry: { id: 7, conversationId: 1, model: [{ role: 'user', content: 'pwd', timestamp: 1 }] }
            }
          }
        ]
      }
    })
  )
  try {
    assert.deepEqual(await command(path, 'handover'), [{ type: 'error', text: 'Session handover cancelled' }])
  } finally {
    close()
  }
})

test('a chat message runs in the same Pi and streams back', async () => {
  const { pi, path, close } = setup()
  const replies = await ask(path, JSON.stringify({ message: 'hi' }), () => {
    assert.deepEqual(pi.sent, ['hi'])
    assert.deepEqual(pi.emit('before_agent_start', { systemPrompt: 'BASE' }), { systemPrompt: 'BASE\n\nCHAT' })
    pi.emit('agent_start')
    pi.emit('message_update', { assistantMessageEvent: { type: 'thinking_delta', delta: 'hmm' } })
    pi.emit('message_update', { assistantMessageEvent: { type: 'text_delta', delta: 'Hel' } })
    pi.emit('message_update', { assistantMessageEvent: { type: 'text_delta', delta: 'lo' } })
    pi.emit('agent_settled')
  })
  assert.deepEqual(replies, [{ type: 'delta', text: 'Hel' }, { type: 'delta', text: 'lo' }, { type: 'done' }])
  close()
})

test('a skill typed in the chat box runs as the skill; other slashes stay text', async () => {
  const { pi, path, close } = setup()
  pi.getCommands = () => [{ name: 'skill:planning', source: 'skill' }]
  const turn = () => {
    pi.emit('agent_start')
    pi.emit('agent_settled')
  }
  await ask(path, JSON.stringify({ message: '/planning a garden' }), turn)
  await ask(path, JSON.stringify({ message: '/etc is a folder' }), turn)
  assert.deepEqual(pi.sent, ['/skill:planning a garden', '/etc is a folder'])
  assert.deepEqual(pi.options, [{ expandPromptTemplates: true }, {}])
  close()
})

test('terminal turns neither stream to chat nor get the chat prompt', async () => {
  const { pi, close } = setup()
  assert.equal(pi.emit('before_agent_start', { systemPrompt: 'BASE' }), undefined)
  close()
})

test('a message sent while Pi works queues as a follow-up', async () => {
  const { pi, path, close } = setup()
  pi.idle = false
  assert.deepEqual(await ask(path, JSON.stringify({ message: 'next' })), [{ type: 'queued' }])
  assert.deepEqual(pi.sent, ['next'])
  assert.deepEqual(pi.options, [{ deliverAs: 'followUp' }])
  close()
})

test('stop aborts a working Pi and says so when idle', async () => {
  const { pi, path, close } = setup()
  assert.deepEqual(await command(path, 'stop'), [{ type: 'done', text: 'Nothing to stop' }])
  pi.idle = false
  assert.deepEqual(await command(path, 'stop'), [{ type: 'done', text: 'Stopped' }])
  assert.deepEqual(pi.calls, [['abort']])
  close()
})

test('new starts a fresh session and clears every watcher', async () => {
  const { pi, path, close } = setup()
  pi.entries = [{ type: 'message', message: { role: 'user', content: 'old' } }]
  const watcher = []
  const socket = connect(path, () => socket.write(JSON.stringify({ watch: true }) + '\n'))
  socket.setEncoding('utf8')
  socket.on('data', chunk =>
    watcher.push(
      ...chunk
        .trim()
        .split('\n')
        .map(line => JSON.parse(line))
    )
  )
  try {
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(await command(path, 'new'), [{ type: 'done', text: 'New session' }])
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(pi.calls, [['new']])
    assert.deepEqual(watcher.at(-1), { type: 'history', messages: [] })
    pi.idle = false
    assert.deepEqual(await command(path, 'new'), [{ type: 'error', text: 'Stop Pi first' }])
  } finally {
    socket.destroy()
    close()
  }
})

test('compact passes instructions and reports completion', async () => {
  const { pi, path, close } = setup()
  assert.deepEqual(await command(path, 'compact', 'keep the plan'), [{ type: 'done', text: 'Compacted' }])
  assert.deepEqual(pi.calls, [['compact', 'keep the plan']])
  pi.idle = false
  assert.deepEqual(await command(path, 'compact'), [{ type: 'error', text: 'Stop Pi first' }])
  close()
})

test('model lists available models and switches by name', async () => {
  const { pi, path, close } = setup()
  assert.deepEqual(await command(path, 'model'), [
    { type: 'done', text: 'Model: realness/fast', model: 'realness/fast', models: ['realness/fast', 'realness/deep'] }
  ])
  assert.deepEqual(await command(path, 'model', 'deep'), [
    { type: 'done', text: 'Model: realness/deep', model: 'realness/deep' }
  ])
  assert.deepEqual(await command(path, 'model', 'realness/fast'), [
    { type: 'done', text: 'Model: realness/fast', model: 'realness/fast' }
  ])
  assert.deepEqual(await command(path, 'model', 'nope'), [{ type: 'error', text: 'No model named nope' }])
  assert.deepEqual(pi.calls, [
    ['model', 'deep'],
    ['model', 'fast']
  ])
  close()
})

test('thinking reports and sets the level', async () => {
  const { pi, path, close } = setup()
  assert.deepEqual(await command(path, 'thinking'), [{ type: 'done', text: 'Thinking: medium', level: 'medium' }])
  assert.deepEqual(await command(path, 'thinking', 'high'), [{ type: 'done', text: 'Thinking: high', level: 'high' }])
  assert.deepEqual(await command(path, 'thinking', 'loud'), [
    { type: 'error', text: 'Thinking is one of off, minimal, low, medium, high, xhigh, max' }
  ])
  assert.deepEqual(pi.calls, [['thinking', 'high']])
  close()
})

test('unknown commands are refused', async () => {
  const { path, close } = setup()
  assert.deepEqual(await command(path, 'login'), [{ type: 'error', text: 'Unknown command: login' }])
  close()
})

test('bad input is refused', async () => {
  const { pi, path, close } = setup()
  for (const line of ['nope', JSON.stringify({ message: ' ' }), JSON.stringify({ message: 4 })]) {
    assert.deepEqual(await ask(path, line), [{ type: 'error', text: 'invalid message' }])
  }
  assert.deepEqual(pi.sent, [])
  close()
})

test('a model error reaches chat instead of an empty reply', async () => {
  const { pi, path, close } = setup()
  const replies = await ask(path, JSON.stringify({ message: 'hi' }), () => {
    pi.emit('agent_start')
    pi.emit('message_end', { message: { role: 'assistant', stopReason: 'error', errorMessage: '429: quota' } })
    pi.emit('agent_settled')
  })
  assert.deepEqual(replies, [{ type: 'error', text: '429: quota' }])
  close()
})

test('history keeps user and assistant text only', () => {
  const entries = [
    { type: 'model_change' },
    { type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'hi' }] } },
    {
      type: 'message',
      message: { role: 'assistant', content: [{ type: 'thinking', thinking: 'hm' }, { type: 'toolCall' }] }
    },
    { type: 'message', message: { role: 'toolResult', content: [{ type: 'text', text: 'ok' }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] } }
  ]
  assert.deepEqual(history_of(entries), [
    { role: 'user', text: 'hi' },
    { role: 'assistant', text: 'Hello' }
  ])
})

test('a watcher sees history, then a turn typed in the TUI', async () => {
  const { pi, path, close } = setup()
  pi.entries = [{ type: 'message', message: { role: 'user', content: 'earlier' } }]
  const replies = await new Promise(resolve => {
    const got = []
    let buffer = ''
    const socket = connect(path, () => socket.write(JSON.stringify({ watch: true }) + '\n'))
    socket.setEncoding('utf8')
    socket.on('data', chunk => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop()
      got.push(...lines.map(line => JSON.parse(line)))
      if (got.length === 1) {
        pi.emit('agent_start')
        pi.emit('message_start', { message: { role: 'user', content: [{ type: 'text', text: 'typed' }] } })
        pi.emit('message_start', { message: { role: 'assistant', content: [] } })
        pi.emit('message_update', { assistantMessageEvent: { type: 'text_delta', delta: 'ok' } })
        pi.emit('message_end', { message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] } })
        pi.emit('agent_settled')
      }
      if (got.at(-1)?.type === 'working' && got.at(-1).on === false) {
        socket.destroy()
        resolve(got)
      }
    })
  })
  assert.deepEqual(replies, [
    { type: 'history', messages: [{ role: 'user', text: 'earlier' }] },
    { type: 'working', on: true },
    { type: 'user', text: 'typed' },
    { type: 'assistant' },
    { type: 'delta', text: 'ok' },
    { type: 'assistant_end', text: 'ok' },
    { type: 'working', on: false }
  ])
  close()
})

test('printing-only commands are recognized, real work is not', () => {
  for (const command of [
    "cat << 'EOF'\n| a | b |\nEOF",
    'cat <<EOF\nhi\nEOF',
    "echo 'Table delivered'",
    'printf "%s\\n" "a | b"'
  ])
    assert.equal(prints_only(command), true, command)
  for (const command of [
    "cat << 'EOF' > notes.md\nhi\nEOF",
    'echo hi > file',
    'echo $(date)',
    'ls && echo done',
    'cat notes.md',
    'date',
    null
  ])
    assert.equal(prints_only(command), false, String(command))
})

test('a chat turn blocks answers printed through bash; the terminal does not', async () => {
  const { pi, path, close } = setup()
  const print = { toolName: 'bash', input: { command: "cat << 'EOF'\n| a | b |\nEOF" } }
  assert.equal(pi.emit('tool_call', print), undefined)
  let blocked
  let allowed
  await ask(path, JSON.stringify({ message: 'compare' }), () => {
    pi.emit('agent_start')
    blocked = pi.emit('tool_call', print)
    allowed = pi.emit('tool_call', { toolName: 'bash', input: { command: 'ls' } })
    pi.emit('agent_settled')
  })
  assert.equal(blocked.block, true)
  assert.match(blocked.reason, /write this text in your reply/)
  assert.equal(allowed, undefined)
  close()
})
