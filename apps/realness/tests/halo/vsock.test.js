/**
 * The guest channel, answered by a stand-in agent on a real unix socket.
 *
 * The protocol is two lines: `CONNECT <port>` and an `OK` ack, then one JSON
 * request line and one JSON reply line. A server that speaks those four
 * covers `connect`, `execInGuest`, `runOk`, and `waitForAgent` without a VM.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { out_path } from '#root/lib/output.js'
import {
  VSOCK_PORT,
  connect,
  execInGuest,
  execInGuestStream,
  runOk,
  waitForAgent
} from '../../src/halo/vsock.js'

/**
 * An agent that acks the handshake and answers each request.
 * `ack: null` stays silent; `respond` returning null drops the connection.
 */
const fake_agent = async (t, { ack = 'OK 52', respond } = {}) => {
  mkdirSync(out_path(), { recursive: true })
  const where = mkdtempSync(out_path('vsock-'))
  const path = join(where, 'agent.sock')
  const seen = []
  const open = new Set()

  const server = createServer(socket => {
    open.add(socket)
    socket.on('close', () => open.delete(socket))
    let buffer = ''
    let handshaked = false
    socket.on('data', chunk => {
      buffer += chunk.toString()
      for (;;) {
        const at = buffer.indexOf('\n')
        if (at === -1) break
        const line = buffer.slice(0, at)
        buffer = buffer.slice(at + 1)
        if (!handshaked) {
          seen.push({ kind: 'handshake', line })
          handshaked = true
          if (ack !== null) socket.write(`${ack}\n`)
          continue
        }
        const request = JSON.parse(line)
        seen.push({ kind: 'request', request })
        const reply = respond ? respond(request, seen) : undefined
        if (reply === null) socket.destroy()
        else if (Array.isArray(reply))
          for (const line of reply) socket.write(`${JSON.stringify(line)}\n`)
        else if (reply !== undefined) socket.write(`${JSON.stringify(reply)}\n`)
      }
    })
  })

  await new Promise(done => server.listen(path, done))
  t.after(async () => {
    for (const socket of open) socket.destroy()
    await new Promise(done => server.close(done))
    rmSync(where, { recursive: true, force: true })
  })
  return { path, seen, port: VSOCK_PORT }
}

const answer = ({ code = 0, out = '', err = '' } = {}) => ({
  exit_code: code,
  stdout_b64: Buffer.from(out).toString('base64'),
  stderr_b64: Buffer.from(err).toString('base64')
})

test('connect shakes hands, and execInGuest carries argv across', async t => {
  const agent = await fake_agent(t, { respond: () => answer({ out: 'hello' }) })

  const { socket, lines } = await connect(agent.path)
  assert.equal(agent.seen[0].line, `CONNECT ${VSOCK_PORT}`)
  assert.equal(typeof lines.read, 'function')
  socket.destroy()

  const result = await execInGuest(agent.path, ['/bin/echo', 'hi'], {
    cwd: '/app/code',
    stdin: 'typed in'
  })
  assert.equal(result.code, 0)
  assert.equal(result.out.toString(), 'hello')

  const request = agent.seen.find(entry => entry.kind === 'request').request
  assert.deepEqual(request, {
    argv: ['/bin/echo', 'hi'],
    cwd: '/app/code',
    stdin_b64: Buffer.from('typed in').toString('base64')
  })
})

test('an empty cwd and no stdin travel as null and empty', async t => {
  const agent = await fake_agent(t, { respond: () => answer() })
  await execInGuest(agent.path, ['/bin/true'])
  assert.deepEqual(agent.seen.find(entry => entry.kind === 'request').request, {
    argv: ['/bin/true'],
    cwd: null,
    stdin_b64: ''
  })
})

test('a non-zero exit comes back as code, out, and err', async t => {
  const agent = await fake_agent(t, {
    respond: () => answer({ code: 2, err: 'no such file' })
  })
  const result = await execInGuest(agent.path, ['/bin/cat', '/missing'])
  assert.equal(result.code, 2)
  assert.equal(result.err.toString().trim(), 'no such file')
})

test('runOk returns stdout and refuses a failed command by name', async t => {
  const ok = await fake_agent(t, { respond: () => answer({ out: 'fine\n' }) })
  assert.equal(await runOk(ok.path, ['/bin/true']), 'fine\n')

  const bad = await fake_agent(t, {
    respond: () => answer({ code: 127, err: 'not found' })
  })
  await assert.rejects(
    runOk(bad.path, ['/bin/nope']),
    /\["\/bin\/nope"\] exited 127: not found/
  )
})

test('a refusal instead of an ack says which port had no agent', async t => {
  const agent = await fake_agent(t, { ack: 'FAIL no listener' })
  await assert.rejects(
    connect(agent.path),
    /no agent on port 52 \(firecracker said 'FAIL no listener'\)/
  )
})

test('a socket that is not there is named with its code', async t => {
  const where = mkdtempSync(out_path('vsock-gone-'))
  t.after(() => rmSync(where, { recursive: true, force: true }))
  await assert.rejects(
    connect(join(where, 'nothing.sock')),
    /cannot reach .*nothing\.sock \((ENOENT|ECONNREFUSED)\)/
  )
})

test('a silent agent times out as a VsockError', async t => {
  const agent = await fake_agent(t, { respond: () => undefined })
  await assert.rejects(
    execInGuest(agent.path, ['/bin/true'], { timeout: 1 }),
    /timed out after 1s/
  )
})

test('a closed channel is named rather than parsed', async t => {
  const agent = await fake_agent(t, { respond: () => null })
  await assert.rejects(
    execInGuest(agent.path, ['/bin/true']),
    /agent closed the channel \(argv=\["\/bin\/true"\]\)/
  )
})

test('waitForAgent returns once the agent answers', async t => {
  const agent = await fake_agent(t, { respond: () => answer() })
  await waitForAgent(agent.path, 5)
  assert.deepEqual(
    agent.seen.find(entry => entry.kind === 'request').request.argv,
    ['/bin/true']
  )
})

test('a reused port reaches the same agent', async t => {
  const agent = await fake_agent(t, { respond: () => answer({ out: 'on 52' }) })
  assert.equal(
    (await execInGuest(agent.path, ['/bin/true'], { port: 52 })).out.toString(),
    'on 52'
  )
  assert.equal(agent.seen[0].line, 'CONNECT 52')
})

test('execInGuestStream reports each frame, then the exit', async t => {
  const agent = await fake_agent(t, {
    respond: () => [
      { type: 'stdout', data_b64: Buffer.from('one\n').toString('base64') },
      { type: 'stderr', data_b64: Buffer.from('bad\n').toString('base64') },
      { type: 'stdout', data_b64: Buffer.from('two\n').toString('base64') },
      { type: 'exit', exit_code: 3 }
    ]
  })
  const chunks = []
  const result = await execInGuestStream(
    agent.path,
    ['/bin/sh', '-c', 'true'],
    {
      on_output: chunk => chunks.push([chunk.stream, chunk.data.toString()])
    }
  )
  assert.equal(result.code, 3)
  assert.deepEqual(chunks, [
    ['stdout', 'one\n'],
    ['stderr', 'bad\n'],
    ['stdout', 'two\n']
  ])
  assert.equal(agent.seen.at(-1).request.stream, true)
})

test('cancelling the call closes the channel', async t => {
  const agent = await fake_agent(t, { respond: () => null })
  const stopping = new AbortController()
  const pending = execInGuestStream(agent.path, ['/bin/sh', '-c', 'sleep 9'], {
    timeout: 5,
    signal: stopping.signal
  })
  setTimeout(() => stopping.abort(), 20)
  await assert.rejects(pending, /agent closed the channel/)
})
