import assert from 'node:assert/strict'
import { it } from 'node:test'
import { make_gate } from '#root/src/gate/gate.js'
import { makeServer as make_halo } from '#root/src/halo/server.js'

const secret = 'exec-relay-secret-at-least-thirty-two-bytes'
process.env.HALO_PASS_SECRET = secret
const phone = '+14155550123'
const stranger = '+14155559999'
const actor = 'a-111111111111'
const other_actor = 'a-222222222222'
const origin = 'https://realness.online'

const start = async (t, execute) => {
  const seen = []
  const placements = []
  const records = {
    [actor]: { id: actor, owner: phone },
    [other_actor]: { id: other_actor, owner: stranger }
  }
  const halo = make_halo({
    get: id => records[id],
    list: () => Object.values(records),
    execStream: async (id, argv, options) => {
      seen.push({ id, argv, options })
      return execute(options)
    }
  })
  await new Promise(done => halo.listen(0, '127.0.0.1', done))
  const gate = make_gate({
    identify: async token => {
      if (token !== 'person-token') throw new Error('invalid token')
      return { phone }
    },
    halo_for: who => {
      placements.push(who)
      return { host: '127.0.0.1', api_port: halo.address().port, port: 8081 }
    },
    secret,
    origins: [origin],
    log: () => {}
  })
  await new Promise(done => gate.listen(0, '127.0.0.1', done))
  t.after(() => {
    gate.closeAllConnections()
    halo.closeAllConnections()
    gate.close()
    halo.close()
  })
  const request = (id = actor, headers = {}) =>
    fetch(`http://127.0.0.1:${gate.address().port}/v1/actors/${id}/exec`, {
      method: 'POST',
      headers: {
        origin,
        authorization: 'Bearer person-token',
        'content-type': 'application/json',
        ...headers
      },
      body: JSON.stringify({ argv: ['ls', '/realness'], stream: true })
    })
  return { request, seen, placements }
}

const output = options => {
  options.on_output({ stream: 'stdout', data: Buffer.from('files\n') })
  return { exit_code: 0 }
}

it('the browser receives output before exec finishes, on its actor-selected halo', async t => {
  let finish
  const finished = new Promise(done => {
    finish = done
  })
  const { request, seen, placements } = await start(t, async options => {
    output(options)
    await finished
    return { exit_code: 7 }
  })
  const response = await request()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('access-control-allow-origin'), origin)
  const reader = response.body.getReader()
  const first = await reader.read()
  assert.deepEqual(JSON.parse(new TextDecoder().decode(first.value)), {
    type: 'output',
    stream: 'stdout',
    data_b64: Buffer.from('files\n').toString('base64')
  })
  assert.deepEqual(placements, [{ phone, actor }])
  assert.deepEqual(seen[0].argv, ['ls', '/realness'])
  finish()
  const last = await reader.read()
  assert.deepEqual(JSON.parse(new TextDecoder().decode(last.value)), {
    type: 'exit',
    exit_code: 7
  })
})

it('invalid identity, a different origin, and another owner never execute', async t => {
  const { request, seen } = await start(t, output)
  assert.equal(
    (await request(actor, { authorization: 'Bearer bad' })).status,
    401
  )
  assert.equal(
    (await request(actor, { origin: 'https://stranger.example' })).status,
    403
  )
  assert.equal((await request(other_actor)).status, 404)
  assert.equal(seen.length, 0)
})

it('closing the browser stream aborts only that exec through both services', async t => {
  let cancelled
  const stopped = new Promise(done => {
    cancelled = done
  })
  const { request } = await start(
    t,
    options =>
      new Promise(done => {
        output(options)
        options.signal.addEventListener(
          'abort',
          () => {
            cancelled()
            done({ exit_code: -9 })
          },
          { once: true }
        )
      })
  )
  const response = await request()
  const reader = response.body.getReader()
  await reader.read()
  await reader.cancel()
  await stopped
})
