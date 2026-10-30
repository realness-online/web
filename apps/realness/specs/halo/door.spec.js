import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync } from 'node:fs'
import { after, before, it } from 'node:test'
import { ask } from '../../server/halo/guest/realness-door.js'

const door = join(mkdtempSync(join(tmpdir(), 'door-')), 'door.sock')
process.env.REALNESS_DOOR = door
let server

/** A door that answers each request line with the reply under test. */
const answer_with = reply => socket => {
  socket.once('data', () => socket.write(`${JSON.stringify(reply)}\n`))
}

before(() => {
  server = createServer(answer_with({ ok: true, pass: 'p' }))
  server.listen(door)
})

after(() => {
  server.close()
  rmSync(join(door, '..'), { recursive: true, force: true })
})

it('one request line in, one reply line out', async () => {
  const reply = await ask({ op: 'model-pass' })
  assert.deepEqual(reply, { ok: true, pass: 'p' })
})

it('fails when the door is not there', async () => {
  const there = process.env.REALNESS_DOOR
  process.env.REALNESS_DOOR = join(there, 'none.sock')
  try {
    await assert.rejects(ask({ op: 'read' }), /the halo did not answer/)
  } finally {
    process.env.REALNESS_DOOR = there
  }
})

it('times out a door that never replies', async () => {
  const quiet = join(door, '..', 'quiet.sock')
  const silent = createServer(() => {})
  await new Promise(done => silent.listen(quiet, done))
  process.env.REALNESS_DOOR = quiet
  try {
    await assert.rejects(
      ask({ op: 'read' }, { timeout_ms: 100, timeout_error: 'took too long' }),
      /took too long/
    )
  } finally {
    silent.close()
    process.env.REALNESS_DOOR = door
  }
})
