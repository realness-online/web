import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, connect } from 'node:net'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { after, before, it } from 'node:test'
import {
  AGENTS,
  port_of,
  serve
} from '../../server/halo/guest/realness-responder.js'

const box = mkdtempSync(join(tmpdir(), 'responder-'))
const agents = []
let servers = []

/** A stand-in agent that answers every byte with `who:` in front of it. */
const agent = who =>
  new Promise(done => {
    const path = join(box, AGENTS.get(who))
    const server = createServer(socket => {
      socket.on('data', data => socket.write(`${who}:${data}`))
    })
    server.listen(path, () => done(server))
  })

before(async () => {
  for (const who of AGENTS.keys()) agents.push(await agent(who))
  servers = await serve({ box })
})

after(() => {
  for (const server of [...servers, ...agents]) server.close()
  rmSync(box, { recursive: true, force: true })
})

/**
 * One exchange through the responder.
 * @param {string} port the listener's own port
 * @param {string} line the CONNECT line the halo sends
 * @param {string} body
 */
const call = (port, line, body) =>
  new Promise((done, fail) => {
    const chunks = []
    let quiet = null
    const socket = connect(join(box, `sock-${port}`))
    socket.on('error', fail)
    socket.on('connect', () => socket.write(`${line}\n${body}`))
    socket.on('data', chunk => {
      chunks.push(chunk)
      clearTimeout(quiet)
      quiet = setTimeout(() => {
        socket.destroy()
        done(Buffer.concat(chunks).toString())
      }, 40)
    })
  })

it('a CONNECT names the port, and OK echoes it', async () => {
  assert.equal(await call('52', 'CONNECT 52', 'hi'), 'OK 52\n52:hi')
})

it('any socket reaches any agent', async () => {
  assert.equal(await call('52', 'CONNECT 53', 'rows'), 'OK 53\n53:rows')
  assert.equal(await call('55', 'CONNECT 52', 'x'), 'OK 52\n52:x')
})

it('an unknown or missing port falls back to the listener', async () => {
  assert.equal(await call('55', 'CONNECT 99', 'y'), 'OK 55\n55:y')
  assert.equal(await call('53', 'CONNECT', 'z'), 'OK 53\n53:z')
  assert.equal(port_of('', '52'), '52')
})

it('closing the client closes the agent connection', async () => {
  let closed = false
  const spy = createServer(socket => {
    socket.on('close', () => (closed = true))
  })
  const path = join(box, 'agent.sock')
  rmSync(path, { force: true })
  await new Promise(done => spy.listen(path, done))
  try {
    await new Promise((done, fail) => {
      const client = connect(join(box, 'sock-52'))
      client.on('error', fail)
      client.on('connect', () => client.write('CONNECT 52\n'))
      client.on('data', () => client.destroy())
      client.on('close', done)
    })
    await new Promise(done => setTimeout(done, 50))
    assert.equal(closed, true)
  } finally {
    spy.close()
  }
})
