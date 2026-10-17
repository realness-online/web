/**
 * The halo API as control sees it.
 *
 * `waitForHealth` shells out to curl, so a real HTTP server on a loopback port
 * answers it without a halo. `remoteApi` is only read for its argv and for the
 * `json` wrapper: its `call` runs `gcloud compute ssh`, so that one is left
 * alone and `json` is driven through its own `this.call` seam.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { remoteApi, waitForHealth } from '../../src/control/api.js'

/** A real server on a free loopback port, answering from `handler`. */
const serve = async (t, handler) => {
  const server = createServer(handler)
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  t.after(() => new Promise(done => server.close(done)))
  return `http://127.0.0.1:${server.address().port}`
}

const health = body => (request, response) => {
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

const asked = []
const count = (request, response) => {
  asked.push(request.url)
  response.writeHead(500)
  response.end('not yet')
}

test('health returns the body once the seed is built', async t => {
  asked.length = 0
  let calls = 0
  const url = await serve(t, (request, response) => {
    calls += 1
    if (calls === 1) return count(request, response)
    health({ ok: true, seed: { built: true }, actors: { running: 2 } })(
      request,
      response
    )
  })

  const found = await waitForHealth(url, { tries: 5, delayMs: 1 })
  assert.equal(found.seed.built, true)
  assert.equal(found.actors.running, 2)
  assert.equal(calls, 2, 'the first 500 is retried rather than fatal')
})

test('a server that is listening but has no seed yet is not healthy', async t => {
  const url = await serve(t, health({ ok: true, seed: {} }))
  await assert.rejects(
    waitForHealth(url, { tries: 2, delayMs: 1 }),
    /no health after 0s: listening, seed not built yet/
  )
})

test('requireSeed true is the default, and false accepts a bare ok', async t => {
  const url = await serve(t, health({ ok: true }))
  await assert.rejects(
    waitForHealth(url, { tries: 1, delayMs: 1 }),
    /seed not built yet/
  )
  assert.deepEqual(
    await waitForHealth(url, { tries: 1, delayMs: 1, requireSeed: false }),
    { ok: true }
  )
})

test('nothing answering keeps the last thing it knew', async () => {
  await assert.rejects(
    waitForHealth('http://127.0.0.1:1', { tries: 1, delayMs: 1 }),
    /^Error: no health after 0s: /
  )
})

test('sshArgs carries the zone when there is one, and one quoted command', () => {
  const zoned = remoteApi('realness-1', { zone: 'us-central1-a' })
  assert.deepEqual(zoned.sshArgs('curl http://127.0.0.1:8080/v1/health'), [
    'compute',
    'ssh',
    'realness-1',
    '--zone=us-central1-a',
    '--quiet',
    '--command=curl http://127.0.0.1:8080/v1/health'
  ])

  const bare = remoteApi('realness-1', {})
  assert.deepEqual(bare.sshArgs('true'), [
    'compute',
    'ssh',
    'realness-1',
    '--quiet',
    '--command=true'
  ])
})

test('json parses what the halo answered', async () => {
  const api = remoteApi('realness-1', {})
  const seen = []
  api.call = async (path, options) => {
    seen.push([path, options])
    return '{"actors":[{"id":"a-1"}]}'
  }
  assert.deepEqual(await api.json('/v1/actors', { timeout: 5 }), {
    actors: [{ id: 'a-1' }]
  })
  assert.deepEqual(seen[0], ['/v1/actors', { timeout: 5 }])
})

test('json names the path when the answer is not JSON', async () => {
  const api = remoteApi('realness-1', {})
  api.call = async () => 'not json at all'
  await assert.rejects(
    api.json('/v1/actors'),
    /\/v1\/actors did not answer JSON: not json at all/
  )
})
