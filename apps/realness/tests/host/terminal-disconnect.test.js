import assert from 'node:assert/strict'
import { createHmac as create_hmac } from 'node:crypto'
import { connect, createServer as create_server } from 'node:net'
import { test } from 'node:test'
import { makeServer as make_server } from '../../src/host/pty.js'
import { Lines } from '../../src/host/vsock.js'

const secret = 'terminal-disconnect-secret-at-least-thirty-two-bytes'
process.env.HOST_PASS_SECRET = secret
const phone = '+14155550123'
const body = Buffer.from(
  JSON.stringify({
    aud: 'realness-host',
    phone,
    exp: Math.floor(Date.now() / 1000) + 240
  })
).toString('base64url')
const pass = `${body}.${create_hmac('sha256', secret).update(body).digest('base64url')}`
const listen = server =>
  new Promise(done => server.listen(0, '127.0.0.1', done))
const close = server => new Promise(done => server.close(done))
const wait_for = async predicate => {
  for (let i = 0; i < 100 && !predicate(); i++)
    await new Promise(done => setTimeout(done, 5))
  assert.ok(predicate(), 'disconnect completed')
}

test('last terminal disconnect stops once, retains disk, and permits repeated reconnects', async t => {
  const sockets = new Set()
  const guest = create_server(socket => {
    sockets.add(socket)
    socket.on('error', () => {})
    socket.once('data', () => socket.write('OK 53\n'))
  })
  await listen(guest)
  const stops = []
  let work = 0
  const server = make_server({
    get: () => ({
      owner: phone,
      vsockPath: { port: guest.address().port, host: '127.0.0.1' }
    }),
    ensureRunning: async () => {},
    beginWork: () => {
      work++
    },
    endWork: () => {
      work--
    },
    idle: async (id, tier) => {
      stops.push({ id, tier })
    }
  })
  await listen(server)
  t.after(async () => {
    for (const socket of sockets) socket.destroy()
    await Promise.all([close(server), close(guest)])
  })
  const attach = async () => {
    const socket = connect(server.address().port, '127.0.0.1')
    sockets.add(socket)
    const lines = new Lines(socket)
    await new Promise(done => socket.once('connect', done))
    socket.write(`${JSON.stringify({ actor: 'a-one', pass })}\n`)
    assert.deepEqual(JSON.parse(await lines.read(1)), { ok: true })
    return socket
  }
  const first = await attach()
  const second = await attach()
  first.destroy()
  await wait_for(() => work === 1)
  assert.equal(stops.length, 0, 'another terminal keeps the actor running')
  second.destroy()
  await wait_for(() => stops.length === 1)
  assert.equal(work, 0)
  for (let i = 0; i < 20; i++) {
    const socket = await attach()
    socket.destroy()
    await wait_for(() => stops.length === i + 2)
    assert.equal(work, 0)
  }
  assert.ok(stops.every(stop => stop.id === 'a-one' && stop.tier === 'disk'))
})
