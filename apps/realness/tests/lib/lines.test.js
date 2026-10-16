import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { Lines } from '../../lib/lines.js'

test('a line split across chunks arrives whole, past 24 KB', async () => {
  const socket = new EventEmitter()
  const lines = new Lines(socket)
  const body = JSON.stringify({ stdout_b64: 'x'.repeat(100_000) })
  const reading = lines.read(1)
  for (let at = 0; at < body.length; at += 24_576) {
    socket.emit('data', Buffer.from(body.slice(at, at + 24_576)))
    await new Promise(done => setImmediate(done))
  }
  socket.emit('data', Buffer.from('\n'))
  assert.deepEqual(JSON.parse(await reading), JSON.parse(body))
})

test('a line that outgrows its limit is returned as it stands', async () => {
  const socket = new EventEmitter()
  const lines = new Lines(socket, 8)
  socket.emit('data', Buffer.from('0123456789'))
  assert.equal((await lines.read(1)).length, 10)
})
