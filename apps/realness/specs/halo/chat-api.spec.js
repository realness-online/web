import assert from 'node:assert/strict'
import { Duplex } from 'node:stream'
import { it } from 'node:test'
import { issue_halo_pass } from '#root/src/sign-on/node/halo-pass.js'
import { make_server } from '../../src/halo/server.js'
import { Lines } from '../../src/halo/vsock.js'

const secret = 'chat-api-test-secret-at-least-thirty-two-bytes'
process.env.HALO_PASS_SECRET = secret
const alice = '+14155550123'
const bob = '+14155559999'
const auth = phone => ({
  authorization: `Bearer ${issue_halo_pass({ phone }, secret)}`
})

const start = async ({
  limits = async record => ({ warn: null, owner: record.owner }),
  receipt = { type: 'done', resumed: true, handover_id: 'handover-1' }
} = {}) => {
  const seen = {
    hellos: [],
    wakes: 0,
    work: [],
    closed: 0,
    turns: [],
    logs: []
  }
  const records = {
    'a-alice0000000': { id: 'a-alice0000000', owner: alice },
    'a-bob000000000': { id: 'a-bob000000000', owner: bob }
  }
  const store = {
    get: id =>
      records[id] ??
      (() => {
        throw new Error('no actor')
      })(),
    list: () => Object.values(records),
    ensure_running: id => (seen.wakes++, records[id]),
    begin_work: id => seen.work.push(`begin ${id}`),
    end_work: id => seen.work.push(`end ${id}`),
    first_turn: id => seen.turns.push(id),
    receive_log: async (id, log) => {
      seen.logs.push({ id, log })
    }
  }
  const connect_chat = async () => {
    const socket = new Duplex({
      read() {},
      write(chunk, encoding, done) {
        const hello = JSON.parse(chunk.toString())
        seen.hellos.push(hello)
        if (hello.message) {
          this.push('{"type":"delta","text":"Hello"}\n{"type":"done"}\n')
          this.push(null)
        } else if (hello.command === 'handover') {
          this.push(`${JSON.stringify(receipt)}\n`)
          this.push(null)
        } else if (hello.command) {
          this.push(
            `${JSON.stringify({ type: 'done', text: `ran ${hello.command}` })}\n`
          )
          this.push(null)
        } else this.push('{"type":"history","turns":[]}\n')
        done()
      },
      destroy(error, done) {
        seen.closed++
        done(error)
      }
    })
    return { socket, lines: new Lines(socket) }
  }
  const server = make_server(store, null, undefined, null, {
    connect_chat,
    limits
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  return {
    server,
    seen,
    at: `http://127.0.0.1:${server.address().port}/v1/actors`
  }
}

it('handover responds only after terminal Pi confirms this exact session', async () => {
  const { server, seen, at } = await start()
  const log = { version: 1, handover_id: 'handover-1', stores: { entries: [] } }
  try {
    const response = await fetch(`${at}/a-alice0000000/session/log`, {
      method: 'POST',
      headers: { ...auth(alice), 'content-type': 'application/json' },
      body: JSON.stringify(log)
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      type: 'done',
      resumed: true,
      handover_id: 'handover-1'
    })
    assert.deepEqual(seen.logs, [{ id: 'a-alice0000000', log }])
    assert.deepEqual(seen.hellos, [{ command: 'handover' }])
  } finally {
    server.closeAllConnections()
    server.close()
  }
})

it('a receipt for another session does not release the browser log', async () => {
  const { server, at } = await start({
    receipt: { type: 'done', resumed: true, handover_id: 'another-session' }
  })
  try {
    const response = await fetch(`${at}/a-alice0000000/session/log`, {
      method: 'POST',
      headers: { ...auth(alice), 'content-type': 'application/json' },
      body: JSON.stringify({ handover_id: 'handover-1', stores: {} })
    })
    assert.equal(response.status, 502)
  } finally {
    server.closeAllConnections()
    server.close()
  }
})

it('an owner sends a message and reads the streamed turn', async () => {
  const { server, seen, at } = await start()
  try {
    const reply = await fetch(`${at}/a-alice0000000/chat/message`, {
      method: 'POST',
      headers: { ...auth(alice), 'content-type': 'application/json' },
      body: '{"message":"Hi"}'
    })
    assert.equal(reply.status, 200)
    assert.match(reply.headers.get('content-type'), /ndjson/)
    assert.deepEqual((await reply.text()).trim().split('\n').map(JSON.parse), [
      { type: 'delta', text: 'Hello' },
      { type: 'done' }
    ])
    assert.deepEqual(seen.hellos, [{ message: 'Hi' }])
    assert.deepEqual(seen.work, ['begin a-alice0000000', 'end a-alice0000000'])
  } finally {
    server.closeAllConnections()
    server.close()
  }
})

it('events stream until the reader leaves; limit answers JSON', async () => {
  const { server, seen, at } = await start()
  try {
    const controller = new AbortController()
    const events = await fetch(`${at}/a-alice0000000/chat/events`, {
      headers: auth(alice),
      signal: controller.signal
    })
    const reader = events.body.getReader()
    assert.deepEqual(
      JSON.parse(new TextDecoder().decode((await reader.read()).value)),
      { type: 'history', turns: [] }
    )
    assert.deepEqual(seen.hellos, [{ watch: true }])
    controller.abort()
    for (let i = 0; i < 50 && !seen.closed; i++)
      await new Promise(done => setTimeout(done, 10))
    assert.equal(seen.closed, 1)
    assert.deepEqual(seen.work, [], 'watching is not work')
    const limit = await fetch(`${at}/a-alice0000000/chat/limit`, {
      headers: auth(alice)
    })
    assert.deepEqual(await limit.json(), { warn: null, owner: alice })
  } finally {
    server.closeAllConnections()
    server.close()
  }
})

it('each accepted message records a turn; a refused one does not', async () => {
  const { server, seen, at } = await start()
  try {
    const post = body =>
      fetch(`${at}/a-alice0000000/chat/message`, {
        method: 'POST',
        headers: { ...auth(alice), 'content-type': 'application/json' },
        body
      })
    assert.equal((await post('{"message":null}')).status, 400)
    assert.deepEqual(seen.turns, [])
    await (await post('{"message":"Hi"}')).text()
    await (await post('{"message":"Again"}')).text()
    assert.deepEqual(seen.turns, ['a-alice0000000', 'a-alice0000000'])
  } finally {
    server.closeAllConnections()
    server.close()
  }
})

it('an owner runs a chat command; it is work, not a turn', async () => {
  const { server, seen, at } = await start()
  try {
    const post = (body, headers = auth(alice)) =>
      fetch(`${at}/a-alice0000000/chat/command`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body
      })
    const reply = await post('{"command":"compact","args":"keep the plan"}')
    assert.equal(reply.status, 200)
    assert.deepEqual((await reply.text()).trim().split('\n').map(JSON.parse), [
      { type: 'done', text: 'ran compact' }
    ])
    assert.deepEqual(seen.hellos, [
      { command: 'compact', args: 'keep the plan' }
    ])
    assert.deepEqual(seen.work, ['begin a-alice0000000', 'end a-alice0000000'])
    assert.deepEqual(seen.turns, [], 'a command is not a first turn')
    for (const body of [
      '{"command":"login"}',
      '{"command":"stop","args":4}',
      '{"command":""}',
      'nope'
    ])
      assert.equal((await post(body)).status, 400, body)
    assert.equal(
      (
        await fetch(`${at}/a-bob000000000/chat/command`, {
          method: 'POST',
          headers: auth(alice),
          body: '{"command":"stop"}'
        })
      ).status,
      404
    )
    assert.equal(seen.hellos.length, 1)
  } finally {
    server.closeAllConnections()
    server.close()
  }
})

it('b1c: limit is quiet when the proxy cannot answer', async () => {
  const { server, at } = await start({
    limits: async () => {
      throw new Error('down')
    }
  })
  try {
    assert.deepEqual(
      await (
        await fetch(`${at}/a-alice0000000/chat/limit`, { headers: auth(alice) })
      ).json(),
      { warn: null }
    )
  } finally {
    server.closeAllConnections()
    server.close()
  }
})

it('no pass, another owner, a bad message, or a wrong method never reach the guest', async () => {
  const { server, seen, at } = await start()
  try {
    const post = (id, headers, body = '{"message":"Hi"}') =>
      fetch(`${at}/${id}/chat/message`, { method: 'POST', headers, body })
    assert.equal((await post('a-alice0000000', {})).status, 401)
    assert.equal((await post('a-bob000000000', auth(alice))).status, 404)
    assert.equal(
      (
        await fetch(`${at}/a-bob000000000/chat/events`, {
          headers: auth(alice)
        })
      ).status,
      404
    )
    assert.equal(
      (await post('a-alice0000000', auth(alice), '{"message":"  "}')).status,
      400
    )
    assert.equal(
      (
        await post(
          'a-alice0000000',
          auth(alice),
          JSON.stringify({ message: 'x'.repeat(20_000) })
        )
      ).status,
      413
    )
    assert.equal(
      (
        await fetch(`${at}/a-alice0000000/chat/message`, {
          headers: auth(alice)
        })
      ).status,
      404
    )
    assert.equal(
      (await fetch(`${at}/a-alice0000000/chat/other`, { headers: auth(alice) }))
        .status,
      404
    )
    assert.equal(seen.hellos.length, 0)
  } finally {
    server.closeAllConnections()
    server.close()
  }
})
