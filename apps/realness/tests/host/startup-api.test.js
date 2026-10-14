import assert from 'node:assert/strict'
import { test } from 'node:test'
import { makeServer as make_server } from '#root/src/host/server.js'
import { make_gate } from '#root/src/gate/gate.js'
import { create_startup_trace } from '#root/src/harness/startup.js'
import { records } from '#root/src/app/utils/stream-records.js'

const secret = 'startup-api-secret-at-least-thirty-two-bytes'
const alice = '+14155550123'
const bob = '+14155559999'
process.env.HOST_PASS_SECRET = secret

const deferred = () => {
  let resolve
  const promise = new Promise(done => {
    resolve = done
  })
  return { promise, resolve }
}

const fixture = async t => {
  const waiting = deferred()
  const calls = []
  const actors = []
  const store = {
    list: () => actors,
    async create(owner, { startup }) {
      calls.push('create')
      const trace = create_startup_trace({
        ...startup,
        report: event => startup.report({ ...event, actor_id: 'a-new' })
      })
      await trace.run('starting_actor', () => waiting.promise)
      const record = { id: 'a-new', owner }
      actors.push(record)
      return record
    },
    async ensureRunning(id, { startup }) {
      calls.push('reload')
      const trace = create_startup_trace({
        ...startup,
        report: event => startup.report({ ...event, actor_id: id })
      })
      await trace.run('waiting_guest', () => waiting.promise)
      return actors.find(record => record.id === id)
    }
  }
  const host = make_server(store)
  await new Promise(done => host.listen(0, '127.0.0.1', done))
  const gate = make_gate({
    secret,
    origins: [],
    log: () => {},
    identify: async token => {
      if (token === 'alice-token') return { phone: alice }
      if (token === 'bob-token') return { phone: bob }
      throw new Error('bad token')
    },
    host_for: () => ({ host: '127.0.0.1', api_port: host.address().port })
  })
  await new Promise(done => gate.listen(0, '127.0.0.1', done))
  t.after(async () => {
    waiting.resolve()
    host.closeAllConnections()
    gate.closeAllConnections()
    await Promise.all([
      new Promise(done => host.close(done)),
      new Promise(done => gate.close(done))
    ])
  })
  const request = (payload = {}, token = 'alice-token', options = {}) =>
    fetch(`http://127.0.0.1:${gate.address().port}/v1/startup`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload),
      ...options
    })
  return { waiting, calls, actors, request, host }
}

const collect = async iterator => {
  const result = []
  for await (const event of iterator) result.push(event)
  return result
}

test(
  'gate delivers stages before startup finishes and replay shares one owner operation',
  { timeout: 5000 },
  async t => {
    const { request, waiting, calls } = await fixture(t)
    const first = await request()
    assert.equal(first.status, 200)
    assert.match(first.headers.get('content-type'), /application\/x-ndjson/)
    assert.equal(first.headers.get('cache-control'), 'no-store')
    const stream = records(first.body)
    const started = (await stream.next()).value
    const stage = (await stream.next()).value
    assert.equal(started.type, 'startup')
    assert.equal(stage.type, 'startup-stage')
    assert.equal(stage.state, 'starting')
    assert.equal(stage.startup_id, started.startup_id)
    const joined = records((await request()).body)
    assert.deepEqual((await joined.next()).value, started)
    assert.deepEqual((await joined.next()).value, stage)
    assert.deepEqual(calls, ['create'])
    waiting.resolve()
    const tail = await collect(stream)
    assert.equal(tail.at(-1).type, 'actor-ready')
    assert.equal(tail.at(-1).created, true)
    assert.ok(tail.every(event => event.startup_id === started.startup_id))
    assert.deepEqual(await collect(joined), tail)
    const replay = await collect(
      records((await request({ startup_id: started.startup_id })).body)
    )
    assert.deepEqual(replay, [started, stage, ...tail])
    assert.deepEqual(calls, ['create'], 'replay never boots again')
  }
)

test(
  'unauthenticated and other-owner requests reveal no startup and perform no actor work',
  { timeout: 5000 },
  async t => {
    const { request, actors, calls, host, waiting } = await fixture(t)
    actors.push({ id: 'a-alice', owner: alice })
    assert.equal((await request({}, 'bad-token')).status, 401)
    const unauthenticated = await fetch(
      `http://127.0.0.1:${host.address().port}/v1/startup`,
      { method: 'POST', body: '{}' }
    )
    assert.equal(unauthenticated.status, 401)
    assert.equal((await request({ actor: 'a-alice' }, 'bob-token')).status, 404)
    assert.deepEqual(calls, [])
    const stream = records((await request({ actor: 'a-alice' })).body)
    const started = (await stream.next()).value
    assert.equal(
      (await request({ startup_id: started.startup_id }, 'bob-token')).status,
      404
    )
    assert.equal((await request({ startup_id: 'missing' })).status, 404)
    assert.equal(
      (
        await request({
          startup_id: started.startup_id,
          actor: 'another-actor'
        })
      ).status,
      404
    )
    assert.deepEqual(calls, ['reload'])
    waiting.resolve()
    assert.equal((await collect(stream)).at(-1).created, false)
  }
)

test(
  'disconnect only detaches the observer; reconnect preserves identity and stage sequence',
  { timeout: 5000 },
  async t => {
    const { request, waiting, calls } = await fixture(t)
    const controller = new AbortController()
    const stream = records(
      (await request({}, 'alice-token', { signal: controller.signal })).body
    )
    const started = (await stream.next()).value
    await stream.next()
    controller.abort()
    await stream.return()
    const rejoined = records(
      (await request({ startup_id: started.startup_id })).body
    )
    assert.equal((await rejoined.next()).value.startup_id, started.startup_id)
    waiting.resolve()
    const tail = await collect(rejoined)
    assert.deepEqual(
      tail.map(event => event.sequence),
      [1, 2, 3]
    )
    assert.deepEqual(calls, ['create'])
  }
)

test(
  'startup failures stream a terminal error without guest output or private host paths',
  { timeout: 5000 },
  async t => {
    const { request, waiting } = await fixture(t)
    const stream = records((await request()).body)
    const started = (await stream.next()).value
    waiting.resolve(
      Promise.reject(new Error('/private/host/path secret transcript'))
    )
    const tail = await collect(stream)
    assert.equal(tail[1].state, 'failed')
    assert.equal(tail.at(-1).type, 'error')
    assert.equal(tail.at(-1).startup_id, started.startup_id)
    assert.ok(!JSON.stringify(tail).includes('secret transcript'))
    assert.ok(!JSON.stringify(tail).includes('/private/host/path'))
  }
)

test('invalid startup requests are refused before any startup work', async t => {
  const { request, calls } = await fixture(t)
  for (const payload of [
    { actor: '' },
    { actor: 1 },
    { startup_id: '' },
    { startup_id: 1 }
  ]) {
    assert.equal((await request(payload)).status, 400)
  }
  assert.deepEqual(calls, [])
})
