import assert from 'node:assert/strict'
import { it } from 'node:test'
import { LAST_TAP } from '#root/src/halo/syscalls.js'
import {
  HaloStatus,
  halo_resources,
  read_status
} from '../../src/halo/status.js'

const actor = (id, state = 'running') => ({
  id,
  state,
  owner: '+14156667777',
  last_activity: '2026-10-05T10:00:00Z'
})
const fixture = (actors, options = {}) => {
  const writes = []
  const store = {
    volume: '/',
    vsock_port: 52,
    list: () => actors,
    seed_status: () => ({ built: true, matches: true })
  }
  const status = new HaloStatus(store, {
    mirror: { put: async (key, body) => writes.push(read_status(body)) },
    resources: () => ({
      mem_available: 123456,
      actor_taps_used: 3,
      actor_taps_limit: 63
    }),
    now: () => new Date('2026-10-05T12:00:00Z'),
    ...options
  })
  return { status, writes }
}

it('routine records include resources and timed running-actor responses', async () => {
  const actors = [actor('a1'), actor('a2', 'idle'), actor('a3', 'stopped')]
  let clock = 0
  const calls = []
  const { status, writes } = fixture(actors, {
    clock: () => clock,
    probe: async (record, port) => {
      calls.push([record.id, port])
      clock += 12
    }
  })
  assert.equal(await status.publish(), true)
  const record = writes[0]
  assert.equal(record.halo.mem_available, '123456')
  assert.equal(record.halo.actor_taps_used, '3')
  assert.equal(record.halo.actor_taps_limit, '63')
  assert.deepEqual(calls, [['a1', 52]])
  assert.equal(record.actors[0].probe_status, 'ok')
  assert.equal(record.actors[0].probe_ms, '12')
  assert.equal(record.actors[0].probe_checked, '2026-10-05T12:00:00.000Z')
  assert.equal(record.actors[1].probe_status, 'skipped')
  assert.equal(record.actors[2].probe_status, 'skipped')
  assert.equal(actors[0].last_activity, '2026-10-05T10:00:00Z')
})

it('probe failures are published and do not hide healthy actors', async () => {
  const { status, writes } = fixture([actor('a1'), actor('a2')], {
    probe: async record => {
      if (record.id === 'a1') throw new Error('guest timed out')
    }
  })
  assert.equal(await status.publish(), true)
  assert.equal(writes[0].actors[0].probe_status, 'failed')
  assert.equal(writes[0].actors[0].probe_error, 'guest timed out')
  assert.equal(writes[0].actors[1].probe_status, 'ok')
})

it('each report probes at most four actors and rotates through the rest', async () => {
  const actors = Array.from({ length: 6 }, (_, i) => actor(`a${i}`))
  const calls = []
  const { status, writes } = fixture(actors, {
    probe: async record => calls.push(record.id)
  })
  await status.publish()
  assert.deepEqual(calls, ['a0', 'a1', 'a2', 'a3'])
  assert.equal(writes[0].actors[4].probe_status, 'pending')
  calls.length = 0
  await status.publish()
  assert.deepEqual(calls, ['a4', 'a5', 'a0', 'a1'])
  actors[0].state = 'idle'
  await status.publish()
  assert.equal(writes[2].actors[0].probe_status, 'skipped')
  assert.equal(writes[2].actors[0].probe_checked, undefined)
})

it('available memory uses MemAvailable and TAPs count actual network devices', () => {
  const result = halo_resources('fc-tap', {
    read_file: () => 'MemFree: 1 kB\nMemAvailable: 2048 kB\n',
    list_network: () => [
      'lo',
      'fc-tap0',
      'fc-tap1',
      'fc-tap63',
      'fc-app1',
      'fc-tap200',
      'fc-tap255'
    ]
  })
  assert.equal(result.mem_available, 2048 * 1024)
  assert.equal(result.actor_taps_used, 3)
  assert.equal(result.actor_taps_limit, LAST_TAP)
})

it('unreadable resources are unknown rather than zero capacity', () => {
  const result = halo_resources('fc-tap', {
    read_file: () => {
      throw new Error('no meminfo')
    },
    list_network: () => {
      throw new Error('no devices')
    }
  })
  assert.equal(result.mem_available, null)
  assert.equal(result.actor_taps_used, null)
  assert.match(result.resource_error, /no meminfo/)
  assert.match(result.resource_error, /no devices/)
})

it('without a mirror no probes run', async () => {
  const { status } = fixture([actor('a1')], {
    mirror: null,
    probe: () => assert.fail('unexpected probe')
  })
  assert.equal(await status.publish(), false)
})

it('the record carries p50 and p99 for create, reload, and probe', async () => {
  const traces = [
    [
      {
        event: 'create',
        vm_ms: 100,
        agent_ms: 10,
        init_ms: 20,
        ms: 130,
        probe_ms: 11
      },
      {
        event: 'create',
        vm_ms: 200,
        agent_ms: 20,
        init_ms: 30,
        ms: 250,
        probe_ms: 12
      }
    ],
    [
      {
        event: 'reload',
        from_memory: true,
        vm_ms: 50,
        agent_ms: 5,
        init_ms: 10,
        ms: 65
      }
    ]
  ]
  const { status, writes } = fixture([actor('a1'), actor('a2')], {
    traces: () => traces
  })
  assert.equal(await status.publish(), true)
  const halo = writes[0].halo
  assert.equal(halo.create_ms_count, '2')
  assert.equal(halo.create_ms_p50, '130')
  assert.equal(halo.create_ms_p99, '250')
  assert.equal(halo.create_vm_ms_p50, '100')
  assert.equal(halo.reload_ms_p50, '65')
  assert.equal(halo.probe_p50, '11')
  assert.equal(halo.probe_p99, '12')
})

it('a trace that cannot be read is warned about, and the record still writes', async () => {
  const warned = []
  const { status, writes } = fixture([actor('a1')], {
    traces: () => {
      throw new Error('unreadable trace')
    },
    warn: message => warned.push(message)
  })
  assert.equal(await status.publish(), true)
  assert.match(warned[0], /unreadable trace/)
  assert.equal(writes[0].halo.create_ms_p50, undefined)
  assert.equal(writes[0].actors.length, 1)
})

it('an empty trace set reports no percentiles rather than zero', async () => {
  const { status, writes } = fixture([actor('a1')], { traces: () => [[]] })
  assert.equal(await status.publish(), true)
  assert.equal(writes[0].halo.create_ms_p50, undefined)
  assert.equal(writes[0].halo.probe_p50, undefined)
})

it('probes never touch the store, so no actor is woken or has its idle timer reset', async () => {
  const actors = [actor('a1')]
  const calls = []
  const store = {
    volume: '/',
    vsock_port: 52,
    list: () => actors,
    seed_status: () => ({ built: true, matches: true }),
    touch: async id => calls.push(['touch', id]),
    ensure_running: async id => calls.push(['ensure_running', id]),
    begin_work: id => calls.push(['begin_work', id])
  }
  const status = new HaloStatus(store, {
    mirror: { put: async () => {} },
    resources: () => ({
      mem_available: 1,
      actor_taps_used: 1,
      actor_taps_limit: 63
    }),
    probe: async () => calls.push(['probe'])
  })
  await status.publish()
  assert.deepEqual(calls, [['probe']])
  assert.equal(actors[0].last_activity, '2026-10-05T10:00:00Z')
})

it('a probe that never answers is failed at the timeout, not left pending', async () => {
  const { status, writes } = fixture([actor('a1')], {
    probe: () => new Promise(() => {})
  })
  const started = Date.now()
  assert.equal(await status.publish(), true)
  assert.ok(Date.now() - started >= 1900, 'waited for the probe timeout')
  assert.equal(writes[0].actors[0].probe_status, 'failed')
  assert.match(writes[0].actors[0].probe_error, /no guest response in 2000ms/)
})
