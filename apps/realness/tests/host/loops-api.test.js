import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { test } from 'node:test'
import { makeServer } from '../../src/host/server.js'

const secret = 'loops-api-test-secret-at-least-thirty-two-bytes'
process.env.HOST_PASS_SECRET = secret
const alice = '+14155550123'
const bob = '+14155559999'
const pass = phone => {
  const body = Buffer.from(
    JSON.stringify({
      aud: 'brayness-host',
      phone,
      exp: Math.floor(Date.now() / 1000) + 240
    })
  ).toString('base64url')
  return `Bearer ${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}

const setup = async () => {
  const actors = {
    'a-00000000000a': { id: 'a-00000000000a', owner: alice },
    'a-00000000000b': { id: 'a-00000000000b', owner: bob }
  }
  const store = { get: id => actors[id] }
  const stops = []
  const loops = {
    loops: {
      'a-00000000000a': {
        parent: 'a-p',
        goal: 'faster',
        status: 'running',
        runs: 3,
        tokens: 900,
        started: '2026-09-28T00:00:00Z',
        tail: ['x']
      },
      'a-00000000000b': {
        parent: 'a-q',
        goal: "bob's",
        status: 'running',
        runs: 1,
        tokens: 10,
        started: '2026-09-28T00:00:00Z'
      }
    },
    all() {
      return Object.entries(this.loops).map(([id, { tail, ...loop }]) => ({
        id,
        owner: actors[id].owner,
        ...loop
      }))
    },
    of_owner(owner) {
      return this.all().filter(loop => loop.owner === owner)
    },
    async stop(id, reason) {
      stops.push([id, reason])
      Object.assign(this.loops[id], { status: 'stopped', reason })
    }
  }
  const server = makeServer(store, null, undefined, loops)
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const url = `http://127.0.0.1:${server.address().port}`
  const call = (method, path, who = alice) =>
    fetch(url + path, {
      method,
      headers: who ? { authorization: pass(who) } : {}
    })
  const close = () => new Promise(done => server.close(done))
  return { call, close, stops }
}

test('owners list and stop only their own loops', async () => {
  const { call, close, stops } = await setup()
  try {
    assert.equal((await call('GET', '/v1/loops', null)).status, 401)
    const listed = await (await call('GET', '/v1/loops')).json()
    assert.deepEqual(
      listed.loops.map(loop => [loop.id, loop.runs, loop.tokens]),
      [['a-00000000000a', 3, 900]]
    )
    assert.equal(
      (await call('POST', '/v1/loops/a-00000000000b/stop')).status,
      404
    )
    assert.equal(
      (await call('POST', '/v1/loops/a-00000000000a/stop')).status,
      200
    )
    assert.deepEqual(stops, [['a-00000000000a', 'owner']])
    assert.equal(
      (await call('POST', '/v1/loops/a-00000000000a/stop')).status,
      409
    )
  } finally {
    await close()
  }
})

test('no loops store: the route is 404', async () => {
  const server = makeServer({ get: () => null })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  try {
    const reply = await fetch(
      `http://127.0.0.1:${server.address().port}/v1/loops`,
      { headers: { authorization: pass(alice) } }
    )
    assert.equal(reply.status, 404)
  } finally {
    await new Promise(done => server.close(done))
  }
})
