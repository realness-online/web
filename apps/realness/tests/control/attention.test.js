import assert from 'node:assert/strict'
import { test } from 'node:test'
import { attention } from '../../src/control/attention.js'
import { gather, overview_text } from '../../src/control/overview.js'

const limits = {
  free_pct: 15,
  mem_available_bytes: 2 * 1024 ** 3,
  spend_day: 5,
  quiet_running_h: 2,
  deep_loop: 2,
  loop_deadline_min: 60
}
const now = Date.parse('2026-09-30T12:00:00Z')
const ago = minutes => new Date(now - minutes * 60e3).toISOString()
const host = (over = {}, actors = []) => ({
  host: {
    name: 'h1',
    seed: 'ready',
    volume_free: 50,
    volume_size: 100,
    mem_free: 50,
    mem_total: 100,
    ...over
  },
  age_s: 10,
  actors
})
const clean = {
  hosts: [
    host({}, [
      { id: 'a-1', state: 'running', last_activity: ago(5) },
      { id: 'a-2', state: 'idle', last_activity: ago(600) }
    ])
  ],
  quiet: { checked: ago(0), quiet_ms: 120_000, quiet: [] },
  loops: [
    { id: 'a-3', status: 'running', started: ago(10), depth: 1 },
    { id: 'a-4', status: 'stopped', started: ago(600), depth: 1 }
  ],
  services: [{ name: 'realness-sync', found: true, ready: true }],
  errors: [{ service: 'realness-sync', count: 0, last: '' }],
  spend: { cost: 4.99 }
}
const kinds = view =>
  attention(view, limits, now)
    .map(line => line.kind)
    .sort()

test('a clean picture needs no attention', () => {
  assert.deepEqual(attention(clean, limits, now), [])
  assert.match(overview_text(clean, []), /attention: none/)
})

test('a quiet host is named, with its age or the lack of one', () => {
  const view = {
    ...clean,
    quiet: {
      quiet: [
        { name: 'realness-1', age_s: null },
        { name: 'realness-2', age_s: 200 }
      ]
    }
  }
  const lines = attention(view, limits, now)
  assert.deepEqual(
    lines.map(l => l.kind),
    ['down', 'down']
  )
  assert.match(
    lines[0].text,
    /realness-1 stopped reporting \(no readable time\)/
  )
  assert.match(lines[1].text, /realness-2 stopped reporting \(200s ago\)/)
})

test('host health shows in the picture, and an undeployed watch is called out', () => {
  assert.match(overview_text(clean, []), /hosts not reporting: none/)
  const late = {
    ...clean,
    quiet: { quiet: [{ name: 'realness-1', age_s: 400 }] }
  }
  assert.match(
    overview_text(late, []),
    /hosts not reporting: realness-1 \(400s\)/
  )
  const old = {
    ...clean,
    quiet: { setup: 'sync does not report host health yet' }
  }
  assert.match(
    overview_text(old, []),
    /host watch: not available \(sync does not report host health yet\)/
  )
})

test("an idle actor's skipped probe is not a failure", () => {
  const idle = {
    ...clean,
    hosts: [
      host({}, [
        {
          id: 'a-2',
          state: 'idle',
          last_activity: ago(600),
          probe_status: 'skipped'
        }
      ])
    ]
  }
  assert.deepEqual(attention(idle, limits, now), [])
})

test('the host line carries available memory, disk, TAPs, and failed probes', () => {
  const view = {
    ...clean,
    hosts: [
      host(
        {
          mem_available: 3 * 1024 ** 3,
          volume_free: 20 * 1024 ** 3,
          actor_taps_used: 34,
          actor_taps_limit: 63
        },
        [
          {
            id: 'a-1',
            state: 'running',
            last_activity: ago(5),
            probe_status: 'failed'
          }
        ]
      )
    ]
  }
  const text = overview_text(view, [])
  assert.match(
    text,
    /3\.00 GiB free, disk 20\.00 GiB free, 34 of 63 actor TAPs, 1 not answering/
  )
})

test('the host line carries boot, guest, and turn percentiles', () => {
  const view = {
    ...clean,
    hosts: [
      host({
        create_vm_ms_count: 12,
        create_vm_ms_p50: 1294,
        create_vm_ms_p99: 4100,
        create_agent_ms_count: 12,
        create_agent_ms_p50: 176,
        create_agent_ms_p99: 500,
        turn_count: 9,
        turn_p50: 8200,
        turn_p99: 21000
      })
    ]
  }
  const text = overview_text(view, [])
  assert.match(
    text,
    /boot p50 1294ms p99 4100ms \(n=12\), guest p50 176ms p99 500ms \(n=12\), turn p50 8200ms p99 21000ms \(n=9\)/
  )
})

test('a host with no timings prints no timing line', () => {
  const text = overview_text(clean, [])
  assert.equal(text.includes('p50'), false)
})

test('each rule flags its own case', () => {
  const cases = [
    [{ hosts: [host({ seed: 'stale' })] }, 'seed'],
    [{ hosts: [host({ volume_free: 14 })] }, 'disk'],
    [{ hosts: [host({ mem_free: 10 })] }, 'memory'],
    [
      {
        hosts: [
          host({}, [{ id: 'a-1', state: 'running', last_activity: ago(121) }])
        ]
      },
      'long'
    ],
    [
      {
        hosts: [
          host({}, [{ id: 'a-1', state: 'incomplete', last_activity: '' }])
        ]
      },
      'incomplete'
    ],
    [
      {
        loops: [
          {
            id: 'a-3',
            status: 'stopped',
            started: ago(5),
            error: 'probe exit 1'
          }
        ]
      },
      'loop'
    ],
    [
      { loops: [{ id: 'a-3', status: 'running', started: ago(61), depth: 1 }] },
      'long'
    ],
    [
      { loops: [{ id: 'a-3', status: 'running', started: ago(5), depth: 2 }] },
      'deep'
    ],
    [{ services: [{ name: 'realness-proxy', found: false }] }, 'service'],
    [
      { services: [{ name: 'realness-proxy', found: true, ready: false }] },
      'service'
    ],
    [
      { errors: [{ service: 'realness-sync', count: 3, last: 'boom' }] },
      'errors'
    ],
    [{ spend: { cost: 5.01 } }, 'spend'],
    [{ hosts: [host({ mem_available: 1024 ** 3 })] }, 'memory'],
    [{ hosts: [host({ actor_taps_used: 63, actor_taps_limit: 63 })] }, 'taps'],
    [{ hosts: [host({ resource_error: 'no meminfo' })] }, 'resources'],
    [
      {
        hosts: [
          host({}, [
            {
              id: 'a-1',
              state: 'running',
              last_activity: ago(5),
              probe_status: 'failed',
              probe_error: 'no guest response in 2000ms'
            }
          ])
        ]
      },
      'probe'
    ],
    [{ unread: [{ source: 'errors', error: 'gcloud: auth' }] }, 'unread'],
    [{ quiet: { quiet: [{ name: 'realness-1', age_s: 400 }] } }, 'down'],
    [{ quiet: { setup: 'sync does not report host health yet' } }, 'watch']
  ]
  for (const [view, kind] of cases)
    assert.deepEqual(kinds({ ...clean, ...view }), [kind], kind)
})

test('gather keeps going when one source fails, and names it', async () => {
  const sources = {
    spend: async () => {
      throw new Error('sync 503')
    },
    services: async () => []
  }
  const view = await gather({ now }, ['spend', 'services'], sources)
  assert.deepEqual(view.services, [])
  assert.deepEqual(kinds({ ...clean, unread: view.unread }), ['unread'])
  assert.deepEqual(view.unread, [{ source: 'spend', error: 'sync 503' }])
})
