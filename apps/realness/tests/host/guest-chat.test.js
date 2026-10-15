import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { test } from 'node:test'
import { out_path } from '#root/src/settings/output.js'

const program = new URL(
  '../../server/host/guest/realness-chat',
  import.meta.url
).pathname

/** A stand-in chat bridge that records each request and answers with `reply`. */
const bridge = async reply => {
  mkdirSync(out_path('tests'), { recursive: true })
  const dir = mkdtempSync(join(out_path('tests'), 'guest-chat-'))
  const path = join(dir, 'pi.sock')
  const seen = []
  const server = createServer(socket => {
    socket.setEncoding('utf8')
    socket.once('data', line => {
      seen.push(JSON.parse(line))
      socket.end(reply.map(value => JSON.stringify(value) + '\n').join(''))
    })
  })
  await new Promise(done => server.listen(path, done))
  return {
    path,
    seen,
    close: () => (server.close(), rmSync(dir, { recursive: true, force: true }))
  }
}

const run = (path, line) =>
  new Promise((resolve, reject) => {
    const child = spawn('python3', [program, path])
    let out = ''
    child.stdout.on('data', chunk => (out += chunk))
    child.on('error', reject)
    child.on('close', () =>
      resolve(
        out
          .trim()
          .split('\n')
          .filter(Boolean)
          .map(text => JSON.parse(text))
      )
    )
    child.stdin.end(line + '\n')
  })

test('a chat command reaches the bridge and its reply comes back', async () => {
  const pi = await bridge([
    { type: 'done', text: 'Thinking: high', level: 'high' }
  ])
  try {
    assert.deepEqual(
      await run(pi.path, JSON.stringify({ command: 'thinking', args: 'high' })),
      [{ type: 'done', text: 'Thinking: high', level: 'high' }]
    )
    assert.deepEqual(await run(pi.path, JSON.stringify({ command: 'stop' })), [
      { type: 'done', text: 'Thinking: high', level: 'high' }
    ])
    assert.deepEqual(pi.seen, [
      { command: 'thinking', args: 'high' },
      { command: 'stop', args: '' }
    ])
  } finally {
    pi.close()
  }
})

test('messages still relay, and bad lines never reach the bridge', async () => {
  const pi = await bridge([{ type: 'delta', text: 'Hi' }, { type: 'done' }])
  try {
    assert.deepEqual(await run(pi.path, JSON.stringify({ message: 'hello' })), [
      { type: 'delta', text: 'Hi' },
      { type: 'done' }
    ])
    assert.deepEqual(await run(pi.path, JSON.stringify({ command: 4 })), [
      { type: 'error', text: 'invalid command' }
    ])
    assert.deepEqual(
      await run(pi.path, JSON.stringify({ command: 'stop', args: 4 })),
      [{ type: 'error', text: 'invalid command' }]
    )
    assert.deepEqual(await run(pi.path, JSON.stringify({ message: ' ' })), [
      { type: 'error', text: 'invalid message' }
    ])
    assert.deepEqual(await run(pi.path, 'nope'), [
      { type: 'error', text: 'invalid message' }
    ])
    assert.deepEqual(pi.seen, [{ message: 'hello' }])
  } finally {
    pi.close()
  }
})
