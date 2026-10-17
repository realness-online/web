import { afterEach as after_each, test } from 'node:test'
import assert from 'node:assert/strict'
import { connect, createServer as create_server } from 'node:net'
import { createServer as create_http_server } from 'node:http'
import { make_gate, offered_token, one_halo } from '#root/src/gate/gate.js'
import { verify_halo_pass } from '#root/src/sign-on/node/halo-pass.js'
import { Lines } from '#root/lib/lines.js'
import { TEXT, frame, parse } from '#root/lib/websocket.js'

const secret = 'g'.repeat(32)
const origin = 'https://realness-development.web.app'
const phone = '+14155550123'

/** A stand-in for a halo's framed terminal: checks the hello, then echoes. */
const fake_halo = async () => {
  const hellos = []
  const server = create_server(async client => {
    const lines = new Lines(client)
    const hello = JSON.parse((await lines.read(5)).toString())
    hellos.push(hello)
    try {
      if (verify_halo_pass(hello.pass, secret).phone !== phone)
        throw new Error('wrong owner')
    } catch (error) {
      return client.end(`${JSON.stringify({ error: error.message })}\n`)
    }
    client.write('{"ok": true}\n')
    lines.rest()
    client.on('data', chunk => client.write(chunk))
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  return { server, hellos, address: `127.0.0.1:${server.address().port}` }
}

const start_gate = async (
  halo_address,
  identify = async token =>
    token === 'good.id.token'
      ? { phone }
      : Promise.reject(new Error('bad token'))
) => {
  const gate = make_gate({
    identify,
    halo_for: one_halo(halo_address),
    secret,
    origins: [origin],
    log: () => {}
  })
  await new Promise(done => gate.listen(0, '127.0.0.1', done))
  return gate
}

const opened = new Set()
after_each(() => {
  for (const socket of opened) socket.destroy()
  opened.clear()
})

/** A browser-shaped upgrade: origin and subprotocols, as a page would send. */
const open = (
  gate,
  {
    protocols = `realness, good.id.token`,
    from = origin,
    path = '/pty?actor=a-000000000001&cols=100&rows=30'
  } = {}
) =>
  new Promise((done, fail) => {
    const socket = connect(gate.address().port, '127.0.0.1')
    opened.add(socket)
    let head = Buffer.alloc(0)
    socket.on('error', fail)
    socket.on('data', function first(chunk) {
      head = Buffer.concat([head, chunk])
      const end = head.indexOf('\r\n\r\n')
      if (end === -1) return
      socket.off('data', first)
      done({
        socket,
        status: Number(head.toString().split(' ')[1]),
        head: head.subarray(0, end).toString(),
        rest: head.subarray(end + 4)
      })
    })
    socket.write(
      `GET ${path} HTTP/1.1\r\nHost: gate\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\nOrigin: ${from}\r\n${protocols ? `Sec-WebSocket-Protocol: ${protocols}\r\n` : ''}\r\n`
    )
  })

const next_text = (socket, rest) =>
  new Promise(done => {
    let buffer = rest
    const check = () => {
      const { frames } = parse(buffer)
      const text = frames.find(item => item.opcode === TEXT)
      if (text) {
        socket.off('data', grow)
        done(text.payload.toString())
      }
    }
    const grow = chunk => {
      buffer = Buffer.concat([buffer, chunk])
      check()
    }
    socket.on('data', grow)
    check()
  })

test("a signed-in browser reaches its halo's terminal through the gate", async () => {
  const host = await fake_halo()
  const gate = await start_gate(host.address)
  try {
    const { socket, status, head, rest } = await open(gate)
    assert.equal(status, 101)
    assert.match(head, /Sec-WebSocket-Protocol: realness\r?$/m)
    assert.deepEqual(
      { ...host.hellos[0], pass: undefined },
      { actor: 'a-000000000001', cols: 100, rows: 30, pass: undefined }
    )
    assert.equal(verify_halo_pass(host.hellos[0].pass, secret).phone, phone)
    socket.write(frame(TEXT, Buffer.from('{"op":"data","data_b64":"aGk="}')))
    assert.equal(
      await next_text(socket, rest),
      '{"op":"data","data_b64":"aGk="}'
    )
    socket.destroy()
  } finally {
    gate.close()
    host.server.close()
  }
})

test('the browser token never reaches the halo', async () => {
  const host = await fake_halo()
  const gate = await start_gate(host.address)
  try {
    const { socket } = await open(gate)
    assert.ok(!JSON.stringify(host.hellos).includes('good.id.token'))
    socket.destroy()
  } finally {
    gate.close()
    host.server.close()
  }
})

test('another origin, no token, or a bad token is refused before any halo', async () => {
  const host = await fake_halo()
  const gate = await start_gate(host.address)
  try {
    assert.equal(
      (await open(gate, { from: 'https://evil.example' })).status,
      403
    )
    assert.equal((await open(gate, { protocols: '' })).status, 401)
    assert.equal(
      (await open(gate, { protocols: 'realness, bad.id.token' })).status,
      401
    )
    assert.equal((await open(gate, { path: '/pty?cols=80' })).status, 400)
    assert.equal(host.hellos.length, 0)
  } finally {
    gate.close()
    host.server.close()
  }
})

test('a halo that refuses the pass is a 502, not a blank terminal', async () => {
  const host = await fake_halo()
  const gate = await start_gate(host.address, async () => ({
    phone: '+14155550199'
  }))
  try {
    const { status } = await open(gate)
    assert.equal(status, 502)
  } finally {
    gate.close()
    host.server.close()
  }
})

test('only a realness subprotocol carries a token', () => {
  assert.equal(offered_token('realness, a.b.c'), 'a.b.c')
  assert.equal(offered_token('other, a.b.c'), null)
  assert.equal(offered_token('realness'), null)
  assert.equal(offered_token('realness, a.b.c, extra'), null)
})

/** A stand-in halo API: records what arrives, answers JSON, or streams on /v1/stream. */
const fake_api = async () => {
  const seen = []
  const server = create_http_server((request, response) => {
    let body = ''
    request.on('data', chunk => (body += chunk))
    request.on('end', () => {
      seen.push({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body
      })
      if (request.url === '/v1/stream') {
        response.writeHead(200, { 'content-type': 'text/event-stream' })
        response.write('data: one\n\n')
        request.socket.on('close', () => seen.push({ closed: true }))
        return
      }
      response.writeHead(201, {
        'content-type': 'application/json',
        'access-control-allow-origin': '*'
      })
      response.end(
        JSON.stringify({
          owner: verify_halo_pass(
            request.headers.authorization.slice(7),
            secret
          ).phone
        })
      )
    })
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  return { server, seen, port: server.address().port }
}

const api_gate = async (api, wake) => {
  const identify = async token =>
    token === 'good.id.token'
      ? { phone }
      : Promise.reject(new Error('bad token'))
  const gate = make_gate({
    identify,
    halo_for: one_halo('127.0.0.1:1', api.port),
    secret,
    origins: [origin],
    wake,
    log: () => {}
  })
  await new Promise(done => gate.listen(0, '127.0.0.1', done))
  return { gate, at: `http://127.0.0.1:${gate.address().port}` }
}

test('r2a: a signed-in call reaches the halo API under a halo pass, not the token', async () => {
  const api = await fake_api()
  const { gate, at } = await api_gate(api)
  const reply = await fetch(`${at}/v1/actors?x=1`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer good.id.token',
      origin,
      cookie: 'c=1',
      'content-type': 'application/json'
    },
    body: '{"paths":null}'
  })
  assert.equal(reply.status, 201)
  assert.equal(reply.headers.get('access-control-allow-origin'), origin)
  assert.deepEqual(await reply.json(), { owner: phone })
  const [call] = api.seen
  assert.deepEqual(
    [call.method, call.url, call.body],
    ['POST', '/v1/actors?x=1', '{"paths":null}']
  )
  assert.equal(call.headers.cookie, undefined)
  assert.equal(call.headers.origin, undefined)
  assert.ok(!JSON.stringify(call.headers).includes('good.id.token'))
  gate.close()
  api.server.close()
})

test('r2a: other origins, no token, bad tokens, and other paths stop at the gate', async () => {
  const api = await fake_api()
  const { gate, at } = await api_gate(api)
  const auth = { authorization: 'Bearer good.id.token' }
  assert.equal(
    (
      await fetch(`${at}/v1/actors`, {
        headers: { ...auth, origin: 'https://evil.test' }
      })
    ).status,
    403
  )
  assert.equal(
    (await fetch(`${at}/v1/actors`, { headers: { origin } })).status,
    401
  )
  assert.equal(
    (
      await fetch(`${at}/v1/actors`, {
        headers: { authorization: 'Bearer bad', origin }
      })
    ).status,
    401
  )
  assert.equal(
    (await fetch(`${at}/actors`, { headers: { ...auth, origin } })).status,
    404
  )
  const preflight = await fetch(`${at}/v1/actors`, {
    method: 'OPTIONS',
    headers: { origin }
  })
  assert.equal(preflight.status, 204)
  assert.match(
    preflight.headers.get('access-control-allow-headers'),
    /authorization/
  )
  assert.equal(api.seen.length, 0)
  gate.close()
  api.server.close()
})

test('r2a: a stream passes through, and leaving closes the halo call', async () => {
  const api = await fake_api()
  const { gate, at } = await api_gate(api)
  const controller = new AbortController()
  const reply = await fetch(`${at}/v1/stream`, {
    headers: { authorization: 'Bearer good.id.token', origin },
    signal: controller.signal
  })
  const reader = reply.body.getReader()
  assert.equal(
    new TextDecoder().decode((await reader.read()).value),
    'data: one\n\n'
  )
  controller.abort()
  for (let i = 0; i < 50 && !api.seen.some(item => item.closed); i++)
    await new Promise(done => setTimeout(done, 20))
  assert.ok(api.seen.some(item => item.closed))
  gate.close()
  api.server.close()
})

test('r2a: an unreachable halo is a 502', async () => {
  const { gate, at } = await api_gate({ port: 1 })
  assert.equal(
    (
      await fetch(`${at}/v1/actors`, {
        headers: { authorization: 'Bearer good.id.token', origin }
      })
    ).status,
    502
  )
  gate.close()
})

test('z3: only a signed-in call wakes the halo, before it is forwarded', async () => {
  const api = await fake_api()
  const order = []
  const { gate, at } = await api_gate(api, async () => {
    order.push('wake')
  })
  assert.equal(
    (await fetch(`${at}/v1/actors`, { headers: { origin } })).status,
    401
  )
  assert.equal(
    (
      await fetch(`${at}/v1/actors`, {
        headers: { authorization: 'Bearer bad', origin }
      })
    ).status,
    401
  )
  assert.deepEqual(order, [])
  const reply = await fetch(`${at}/v1/actors`, {
    headers: { authorization: 'Bearer good.id.token', origin }
  })
  assert.equal(reply.status, 201)
  assert.deepEqual(order, ['wake'])
  assert.equal(api.seen.length, 1)
  gate.close()
  api.server.close()
})

test('z3: a failed wake is a 503 with a retry time, and nothing is forwarded', async () => {
  const api = await fake_api()
  const { gate, at } = await api_gate(api, async () => {
    throw new Error('the halo did not wake in time; try again')
  })
  const reply = await fetch(`${at}/v1/actors`, {
    headers: { authorization: 'Bearer good.id.token', origin }
  })
  assert.equal(reply.status, 503)
  assert.equal(reply.headers.get('retry-after'), '5')
  assert.match(await reply.text(), /try again/)
  assert.equal(api.seen.length, 0)
  gate.close()
  api.server.close()
})

const ndjson_api = async status => {
  const server = create_http_server((request, response) => {
    request.resume()
    response.writeHead(status, { 'content-type': 'application/x-ndjson' })
    response.end(
      status === 200
        ? '{"type":"startup","startup_id":"s1"}\n{"type":"actor-ready","startup_id":"s1","actor_id":"a-1"}\n'
        : 'parking'
    )
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  return { server, port: server.address().port, seen: [] }
}

const lines = async reply =>
  (await reply.text())
    .trim()
    .split('\n')
    .map(line => JSON.parse(line))

const wake_with =
  events =>
  async ({ watch } = {}) => {
    for (const event of events) watch?.(event)
  }

test('z5: startup progress begins with the gate wake, then the halo stages', async () => {
  const api = await ndjson_api(200)
  const { gate, at } = await api_gate(
    api,
    wake_with([
      { stage: 'starting_host', state: 'starting', elapsed_ms: 0 },
      { stage: 'starting_host', state: 'complete', elapsed_ms: 900 }
    ])
  )
  const reply = await fetch(`${at}/v1/startup`, {
    method: 'POST',
    headers: { authorization: 'Bearer good.id.token', origin },
    body: '{}'
  })
  assert.equal(reply.status, 200)
  assert.deepEqual(
    (await lines(reply)).map(event => [
      event.type,
      event.stage ?? event.state ?? '',
      event.source ?? ''
    ]),
    [
      ['startup-stage', 'starting_host', 'gate'],
      ['startup-stage', 'starting_host', 'gate'],
      ['startup', '', ''],
      ['actor-ready', '', '']
    ]
  )
  gate.close()
  api.server.close()
})

test('z5: a refusal after the wake streamed becomes an error record', async () => {
  const api = await ndjson_api(503)
  const { gate, at } = await api_gate(
    api,
    wake_with([{ stage: 'starting_host', state: 'complete', elapsed_ms: 1 }])
  )
  const reply = await fetch(`${at}/v1/startup`, {
    method: 'POST',
    headers: { authorization: 'Bearer good.id.token', origin },
    body: '{}'
  })
  const events = await lines(reply)
  assert.deepEqual(events.at(-1), { type: 'error', text: '503: parking' })
  gate.close()
  api.server.close()
})

test('z5: a wake that fails mid-stream ends with an error record', async () => {
  const api = await ndjson_api(200)
  const { gate, at } = await api_gate(api, async ({ watch } = {}) => {
    watch?.({ stage: 'starting_host', state: 'failed', elapsed_ms: 90_000 })
    throw new Error('the halo did not wake in time; try again')
  })
  const reply = await fetch(`${at}/v1/startup`, {
    method: 'POST',
    headers: { authorization: 'Bearer good.id.token', origin },
    body: '{}'
  })
  const events = await lines(reply)
  assert.equal(events[0].state, 'failed')
  assert.deepEqual(events.at(-1), {
    type: 'error',
    text: 'the halo did not wake in time; try again'
  })
  gate.close()
  api.server.close()
})
