import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer as create_server } from 'node:net'
import {
  WakeTimeout,
  gce_start,
  make_waker,
  tcp_probe
} from '#root/src/gate/wake.js'

/** A fake clock and host: `up_after` probes fail before the host answers. */
const world = ({ up_after = 2, intent = null } = {}) => {
  const seen = { starts: 0, writes: [], probes: 0, stages: [] }
  let clock = Date.parse('2026-10-15T12:00:00Z')
  let stored = intent
  return {
    seen,
    options: {
      probe: async () => ++seen.probes > up_after,
      start: async () => {
        seen.starts += 1
      },
      read_intent: async () => stored,
      write_intent: async record => {
        stored = record
        seen.writes.push(record.intent)
      },
      now: () => clock,
      pause: async ms => {
        clock += ms
      },
      stage: stage => seen.stages.push(stage)
    }
  }
}

test('an awake host costs one probe and no writes', async () => {
  const { seen, options } = world({ up_after: 0 })
  await make_waker(options)()
  assert.deepEqual([seen.probes, seen.starts, seen.writes], [1, 0, []])
})

test('a parked host is started once, then recorded running', async () => {
  const { seen, options } = world()
  await make_waker(options)()
  assert.equal(seen.starts, 1)
  assert.deepEqual(seen.writes, ['starting', 'running'])
  assert.deepEqual(seen.stages, ['starting host', 'host ready'])
})

test('concurrent requests share one wake', async () => {
  const { seen, options } = world({ up_after: 4 })
  const wake = make_waker(options)
  await Promise.all([wake(), wake(), wake()])
  assert.equal(seen.starts, 1)
})

test("another instance's wake in progress is joined, not repeated", async () => {
  const until = new Date(Date.parse('2026-10-15T12:01:00Z')).toISOString()
  const { seen, options } = world({
    intent: { intent: 'starting', until }
  })
  await make_waker(options)()
  assert.equal(seen.starts, 0)
  assert.deepEqual(seen.writes, ['running'])
})

test('a stale starting intent past its deadline starts again', async () => {
  const { seen, options } = world({
    intent: { intent: 'starting', until: '2026-10-15T11:00:00.000Z' }
  })
  await make_waker(options)()
  assert.equal(seen.starts, 1)
})

test('a host that never answers fails at the deadline, and the next call retries', async () => {
  const { seen, options } = world({ up_after: Infinity })
  const wake = make_waker({ ...options, deadline_ms: 10_000, poll_ms: 2000 })
  await assert.rejects(wake(), WakeTimeout)
  assert.deepEqual(seen.writes, ['starting'])
  await assert.rejects(wake(), WakeTimeout)
  assert.equal(seen.starts, 2)
})

test('a start lost to a host still stopping is repeated until the host answers', async () => {
  const { seen, options } = world({ up_after: Infinity })
  let stopped = false
  // The first start lands while the host is stopping and is dropped; a later one boots it.
  options.start = async () => {
    seen.starts += 1
    if (seen.starts === 1) return
    stopped = true
  }
  let booted_at = null
  options.probe = async () => {
    seen.probes += 1
    if (stopped && booted_at === null) booted_at = seen.probes
    return booted_at !== null && seen.probes > booted_at + 2
  }
  await make_waker({ ...options, poll_ms: 2000, restart_ms: 15_000 })()
  assert.equal(seen.starts, 2)
  assert.deepEqual(seen.writes, ['starting', 'running'])
})

test('a waiter joining another instance never sends its own starts', async () => {
  const until = new Date(Date.parse('2026-10-15T12:01:00Z')).toISOString()
  const { seen, options } = world({
    up_after: 20,
    intent: { intent: 'starting', until }
  })
  await make_waker({ ...options, restart_ms: 1000 })()
  assert.equal(seen.starts, 0)
})

test('the start call names one instance and carries the token', async () => {
  const calls = []
  await gce_start({
    project: 'p',
    zone: 'us-east1-b',
    name: 'h1',
    token: async () => 't',
    fetcher: async (url, init) => {
      calls.push([url, init.method, init.headers.authorization])
      return { ok: true }
    }
  })()
  assert.deepEqual(calls, [
    [
      'https://compute.googleapis.com/compute/v1/projects/p/zones/us-east1-b/instances/h1/start',
      'POST',
      'Bearer t'
    ]
  ])
  await assert.rejects(
    gce_start({
      project: 'p',
      zone: 'z',
      name: 'h1',
      token: async () => 't',
      fetcher: async () => ({ ok: false, status: 403 })
    })(),
    /403/
  )
})

test('the probe tells an open port from a closed one', async () => {
  const server = create_server(socket => socket.end())
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const { port } = server.address()
  assert.equal(await tcp_probe({ host: '127.0.0.1', api_port: port }), true)
  server.close()
  await new Promise(done => server.once('close', done))
  assert.equal(await tcp_probe({ host: '127.0.0.1', api_port: port }), false)
})

test('every waiting caller sees the shared stages; a late one starts from the latest', async () => {
  const { options } = world({ up_after: 3 })
  const wake = make_waker(options)
  const first = []
  const late = []
  const one = wake({ watch: event => first.push(event.state) })
  await Promise.resolve()
  await Promise.resolve()
  const two = wake({ watch: event => late.push(event.state) })
  await Promise.all([one, two])
  assert.deepEqual(first, ['starting', 'complete'])
  assert.equal(late.at(-1), 'complete')
})
