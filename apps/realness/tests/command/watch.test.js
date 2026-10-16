import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PassThrough as pass_through } from 'node:stream'
import {
  health_snapshot,
  newest_session,
  people_for,
  read_status,
  who_from
} from '../../src/command/watch-health.js'
import {
  day_files,
  ledger as usage_ledger,
  read_rows,
  sum_rows
} from '../../src/command/watch-ledger.js'
import {
  day_files as proxy_day_files,
  read_rows as proxy_read_rows,
  sum_rows as proxy_sum_rows,
  usage_row
} from '#root/src/proxy/usage.js'
import { read_status as sync_read_status } from '#root/src/sync/host-status.js'
import { status_html } from '#root/src/host/status.js'
import { intent_now, lifecycle_html } from '#root/src/sync/host-lifecycle.js'
import {
  billing_lines,
  cost_bars,
  frame,
  host_lines,
  interval_for,
  panel,
  resource_lines,
  spend_chart,
  sync_lines
} from '../../src/command/watch-terminal.js'
import { watch } from '../../src/command/watch-loop.js'
import { sync_records } from '../../src/command/command.js'

const phone = '+15555550123'
const claims = (extra = {}) =>
  `x.${Buffer.from(JSON.stringify({ phone_number: phone, exp: 2_000_000_000, ...extra })).toString('base64url')}.y`

/** A store that answers only the keys it knows; every other read fails. */
const store = (keys = {}, { with_changes = false } = {}) => ({
  ls: async path => {
    if (!(path in keys)) throw new Error(`${path}: 404`)
    return keys[path]
  },
  cat: async path => {
    if (!(path in keys)) throw new Error(`${path}: 404`)
    return Buffer.from(keys[path])
  },
  ...(with_changes ? { changes: async () => null } : {})
})

const status_page = ({
  checked = new Date().toISOString(),
  running = '1',
  idle = '0',
  stopped = '0'
} = {}) =>
  `<article itemscope itemtype="/host"><meta itemprop="name" content="host-1"><meta itemprop="checked" content="${checked}"><meta itemprop="actors_running" content="${running}"><meta itemprop="actors_idle" content="${idle}"><meta itemprop="actors_stopped" content="${stopped}"></article>\n`

const ledger = spent => ({ spent: async () => spent })

test("the watch reads the proxy's ledger rows exactly as the proxy writes them", () => {
  const page = [
    usage_row({
      model: 'm',
      actor: 'a-1',
      payer: phone,
      plan: 'free',
      status: 200,
      request_bytes: 10,
      reply_bytes: 20,
      usage: { prompt_tokens: 3, completion_tokens: 4, cost: 0.01 },
      call: 'c1'
    }),
    usage_row({
      model: 'm',
      actor: 'a-1',
      payer: phone,
      plan: 'paid',
      status: 200,
      request_bytes: 1,
      reply_bytes: 2,
      usage: { prompt_tokens: 5, completion_tokens: 6, cost: 0.02 },
      call: 'c2'
    }),
    usage_row({
      model: 'm:free',
      actor: 'a-1',
      payer: phone,
      plan: 'free',
      status: 200,
      request_bytes: 1,
      reply_bytes: 2,
      usage: { prompt_tokens: 7, completion_tokens: 8, cost: 0 },
      call: 'c3'
    }),
    usage_row({
      model: 'm',
      actor: 'a-1',
      payer: phone,
      plan: 'free',
      status: 200,
      request_bytes: 10,
      reply_bytes: 20,
      usage: { prompt_tokens: 3, completion_tokens: 4, cost: 0.01 },
      call: 'c1'
    })
  ].join('')
  assert.deepEqual(read_rows(page, phone), proxy_read_rows(page, phone))
  assert.deepEqual(
    sum_rows(proxy_read_rows(page, phone)),
    proxy_sum_rows(proxy_read_rows(page, phone))
  )
  assert.deepEqual(
    day_files(['b.html', 'a.html', 'index.html']),
    proxy_day_files(['b.html', 'a.html', 'index.html'])
  )
})

test('the watch reads a host record exactly as the sync service does', () => {
  const html = status_html({
    host: {
      name: 'host-1',
      checked: '2026-10-09T17:00:00.000Z',
      actors_running: 2
    },
    actors: [{ id: 'a-1', state: 'running' }],
    apps: []
  })
  assert.deepEqual(read_status(html), sync_read_status(html))
})

test('sync records become the folders the panel names, newest time winning', async () => {
  const { mkdir, mkdtemp, writeFile, rm } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const artifacts = new URL(
    '../../../../artifacts/realness/watch-tests/',
    import.meta.url
  ).pathname
  await mkdir(artifacts, { recursive: true })
  const state = await mkdtemp(join(artifacts, 'records-'))
  await mkdir(join(state, 'sync'), { recursive: true })
  await writeFile(
    join(state, 'sync', 'a.json'),
    JSON.stringify({
      remote: `people/${phone}/harness/`,
      walked_at: '2026-10-09T18:00:00.000Z'
    })
  )
  await writeFile(
    join(state, 'sync', 'b.json'),
    JSON.stringify({
      remote: `people/${phone}/harness/`,
      walked_at: '2026-10-09T19:00:00.000Z'
    })
  )
  await writeFile(
    join(state, 'sync', 'c.json'),
    JSON.stringify({
      remote: `people/${phone}/artifacts/realness/practice/`,
      walked_at: '2026-10-09T20:00:00.000Z'
    })
  )
  const records = await sync_records(state)
  await rm(state, { recursive: true, force: true })
  assert.deepEqual(records, {
    'can://~/harness/': { at: '2026-10-09T19:00:00.000Z' }
  })
})

test('the token names the person a watch reads, unless a person is named', () => {
  assert.deepEqual(people_for(who_from(claims()), []), [phone])
  assert.deepEqual(people_for(who_from(claims()), ['+15555550999']), [
    '+15555550999'
  ])
  assert.deepEqual(people_for(null, []), [])
  assert.equal(who_from(null), null)
})

test('a host record with no recent report is quiet, and its age is shown', async () => {
  const now = Date.now()
  const old = new Date(now - 300_000).toISOString()
  const snapshot = await health_snapshot({
    store: store({
      'can://hosts/': ['host-1/'],
      'can://hosts/host-1/status.html': status_page({ checked: old })
    }),
    token: claims(),
    ledger: ledger({
      day: { tokens: 1, cost: 0.5 },
      month: { tokens: 2, cost: 1.5 }
    }),
    now
  })
  assert.equal(snapshot.panels.hosts.status, 'ok')
  assert.equal(snapshot.panels.hosts.rows[0].state, 'quiet')
  assert.ok(snapshot.panels.hosts.rows[0].age_s >= 300)
  assert.equal(snapshot.panels.cost.rows[0].month.cost, 1.5)
})

test('a planned park reads parked, never quiet', async () => {
  const now = Date.now()
  const old = new Date(now - 3_600_000).toISOString()
  const snapshot = await health_snapshot({
    store: store({
      'can://hosts/': ['host-1/'],
      'can://hosts/host-1/status.html': status_page({ checked: old }),
      'can://hosts/host-1/lifecycle.html': lifecycle_html(
        intent_now('parked', { now: now - 3_000_000 })
      )
    }),
    token: claims(),
    ledger: ledger({
      day: { tokens: 0, cost: 0 },
      month: { tokens: 0, cost: 0 }
    }),
    now
  })
  assert.equal(snapshot.panels.hosts.rows[0].state, 'parked')
})

test('a host with running actors reports running, and no actors reports sleeping', async () => {
  const now = Date.now()
  const running = await health_snapshot({
    store: store({
      'can://hosts/': ['host-1/'],
      'can://hosts/host-1/status.html': status_page({
        checked: new Date(now).toISOString()
      })
    }),
    token: claims(),
    ledger: ledger({
      day: { tokens: 0, cost: 0 },
      month: { tokens: 0, cost: 0 }
    }),
    now
  })
  assert.equal(running.panels.hosts.rows[0].state, 'running')
  const asleep = await health_snapshot({
    store: store({
      'can://hosts/': ['host-1/'],
      'can://hosts/host-1/status.html': status_page({
        checked: new Date(now).toISOString(),
        running: '0',
        stopped: '2'
      })
    }),
    token: claims(),
    ledger: ledger({
      day: { tokens: 0, cost: 0 },
      month: { tokens: 0, cost: 0 }
    }),
    now
  })
  assert.equal(asleep.panels.hosts.rows[0].state, 'sleeping')
})

test('one failing read fails only its own panel', async () => {
  const snapshot = await health_snapshot({
    store: store({
      'can://hosts/': ['host-1/'],
      'can://hosts/host-1/status.html': status_page()
    }),
    token: claims(),
    ledger: {
      spent: async () => {
        throw new Error('ledger unreadable')
      }
    }
  })
  assert.equal(snapshot.panels.hosts.status, 'ok')
  assert.equal(snapshot.panels.cost.status, 'failed')
  assert.match(snapshot.panels.cost.error, /ledger unreadable/)
  assert.equal(snapshot.panels.sign_on.status, 'ok')
})

test('an unsigned watch reports unknown sign-on and an empty cost panel', async () => {
  const snapshot = await health_snapshot({
    store: store({}),
    token: null,
    ledger: ledger({
      day: { tokens: 0, cost: 0 },
      month: { tokens: 0, cost: 0 }
    })
  })
  assert.equal(snapshot.panels.sign_on.state, 'unknown')
  assert.deepEqual(snapshot.panels.cost.rows, [])
  assert.deepEqual(
    snapshot.panels.sync.rows.map(row => row.folder),
    ['harness/vault/Sessions/']
  )
})

test('the newest session time comes from session names', () => {
  assert.equal(
    newest_session([
      '2026-10-16T03-24-27-026Z_a.jsonl',
      'notes.md',
      '2026-10-16T03-30-01-000Z_b.html.gz'
    ]),
    '2026-10-16T03:30:01Z'
  )
  assert.equal(newest_session(['notes.md']), null)
})

test('panel labels stay dim while data keeps its contrast', () => {
  const lines = panel({
    title: 'MODEL SPEND',
    detail: 'today',
    lines: ['TODAY $1.24'],
    width: 40,
    on: true
  })
  assert.equal(lines[0], '\x1b[90mMODEL SPEND today\x1b[0m')
  assert.equal(lines[1], 'TODAY $1.24')
  assert.ok(!lines.join('\n').includes('\x1b[7m'))
  assert.deepEqual(
    panel({ title: 'HOSTS', lines: ['host-a running'], on: false }),
    ['HOSTS', 'host-a running']
  )
})

test('the frame holds the panels, interval, and controls', () => {
  const text = frame({
    snapshot: {
      checked: '2026-10-09T17:00:00.000Z',
      who: { phone },
      panels: {
        hosts: {
          status: 'ok',
          rows: [
            {
              name: 'host-1',
              state: 'running',
              age_s: 12,
              actors: { running: 2, idle: 1, stopped: 0 }
            }
          ]
        },
        cost: {
          status: 'ok',
          rows: [
            {
              phone,
              day: { tokens: 12, cost: 0.25 },
              month: { tokens: 40, cost: 1 }
            }
          ]
        },
        sync: {
          status: 'ok',
          rows: [
            {
              folder: 'vault/',
              listing: true,
              changes: 3,
              last_sync: '2026-10-09T16:59:00.000Z'
            }
          ]
        },
        sign_on: {
          status: 'ok',
          state: 'running',
          rows: [{ phone, expires_at: '2026-10-09T18:00:00.000Z' }]
        },
        publish: { status: 'ok', rows: [{ phone, sites: 1 }] }
      }
    },
    width: 100,
    height: 30,
    interval_ms: 60_000,
    on: false,
    details: true
  })
  assert.match(text, /REALNESS SERVICE WATCH/)
  assert.match(text, /AGENT REPORT HISTORY/)
  assert.match(text, /MODEL SPEND/)
  assert.match(text, /every 60s/)
  assert.match(text, /host-1/)
  assert.match(text, /r refresh/)
  const visible = line => [...line.replace(/\x1b\[[0-9;]*m/g, '')].length
  assert.ok(text.split('\n').every(line => visible(line) <= 100))
})

test('a failed panel prints its error and the time of the last read', () => {
  const text = frame({
    snapshot: {
      checked: '2026-10-09T17:00:00.000Z',
      who: null,
      panels: {
        hosts: {
          status: 'failed',
          error: 'boom',
          at: '2026-10-09T16:59:00.000Z'
        }
      }
    },
    width: 100,
    height: 30,
    interval_ms: 60_000,
    on: false,
    details: true
  })
  assert.match(text, /FAILED boom/)
  assert.match(text, /last read 16:59:00Z/)
})

test("host lines carry each state's own color when color is on", () => {
  const lines = host_lines(
    [
      {
        name: 'host-1',
        state: 'quiet',
        age_s: 300,
        actors: { running: 0, idle: 0, stopped: 1 }
      },
      {
        name: 'host-2',
        state: 'running',
        age_s: 1,
        actors: { running: 1, idle: 0, stopped: 0 }
      }
    ],
    true
  )
  assert.match(lines[0], /\x1b\[35m/)
  assert.match(lines[1], /\x1b\[32m/)
})

test('daily spend reaches the frame through the ledger and health snapshot', async () => {
  const phone = '+15555550123'
  const dates = ['2026-10-01', '2026-10-02', '2026-10-03']
  const keys = {}
  for (const [index, date] of dates.entries()) {
    const path = `can://usage/${phone}/${date}/`
    keys[path] = ['index.html']
    keys[`${path}index.html`] = usage_row({
      model: 'm',
      payer: phone,
      plan: 'free',
      status: 200,
      usage: { prompt_tokens: 1, completion_tokens: 2, cost: index },
      call: date
    })
  }
  const source = usage_ledger(store(keys))
  const spent = await source.spent(phone, new Date('2026-10-03T12:00:00Z'))
  assert.deepEqual(
    spent.daily,
    dates.map((date, cost) => ({ date, tokens: 3, cost }))
  )
  assert.deepEqual(spent.day, { tokens: 3, cost: 2 })
  assert.deepEqual(spent.month, { tokens: 9, cost: 3 })
  const snapshot = await health_snapshot({
    store: store(keys),
    token: claims(),
    ledger: ledger(spent)
  })
  const text = frame({
    snapshot,
    on: false,
    width: 100,
    height: 60,
    details: true
  })
  assert.match(text, /TODAY \$2\.00  MONTH \$3\.00/)
  assert.ok(!text.includes('tok today'))
  assert.match(text, /10-01 to 10-03; daily/)
  assert.ok(
    text.indexOf('BILLING DETAILS') < text.indexOf('AGENT REPORT HISTORY')
  )
  assert.ok(!spend_chart(spent.daily).join('\n').includes('UTC'))
  assert.match(text, /# #/)
})

test('model ledger failures do not turn into a zero-dollar balance', async () => {
  const now = new Date('2026-10-01T12:00:00Z')
  await assert.rejects(
    usage_ledger({
      ls: async () => {
        throw new Error('permission denied')
      }
    }).spent(phone, now),
    /permission denied/
  )
  await assert.rejects(
    usage_ledger(store({})).spent(phone, now),
    /no model ledger/
  )
  const path = `can://usage/${phone}/2026-10-01/`
  await assert.rejects(
    usage_ledger(store({ [path]: ['index.html'] })).spent(phone, now),
    /404/
  )
})

test('spend bars distinguish zero, small values, and the peak', () => {
  const daily = [0, 0.01, 2].map((cost, index) => ({
    date: `2026-10-0${index + 1}`,
    cost
  }))
  const lines = spend_chart(daily)
  assert.equal(lines[0], '$2.00 |     #')
  assert.equal(lines[3], '      |   # #')
  assert.ok(
    !spend_chart(daily.map(day => ({ ...day, cost: 0 })))
      .join('\n')
      .includes('#')
  )
  assert.deepEqual(spend_chart([]), ['daily history unavailable'])
})

test('daily charts show negative credits below zero', () => {
  const lines = spend_chart([
    { date: '2026-10-01', cost: 1 },
    { date: '2026-10-02', cost: -2 }
  ])
  assert.ok(lines.some(line => line.includes('$-2.00 |')))
  assert.ok(lines.some(line => line.endsWith('|   -')))
})

test('narrow charts sum days and frames fit terminal dimensions', () => {
  const daily = Array.from({ length: 31 }, (_, index) => ({
    date: `2026-10-${String(index + 1).padStart(2, '0')}`,
    cost: 1
  }))
  assert.match(spend_chart(daily, 20).join('\n'), /3-day totals/)
  assert.match(spend_chart(daily, 20)[0], /\$3\.00/)
  for (const width of [40, 80, 100]) {
    const snapshot = {
      panels: {
        cost: {
          rows: [
            { phone, daily, day: { cost: 1, tokens: 2 }, month: { cost: 31 } }
          ]
        }
      }
    }
    const text = frame({ snapshot, width, height: 24, on: false })
    const lines = text.trimEnd().split('\n')
    assert.ok(lines.length <= 24)
    assert.ok(
      lines.every(
        line => [...line.replace(/\x1b\[[0-9;]*m/g, '')].length <= width
      )
    )
  }
})

test('missing billing data never presents a zero-dollar cloud total', () => {
  const text = billing_lines(
    { status: 'failed', error: 'no export' },
    100,
    false
  ).join('\n')
  assert.match(text, /UNAVAILABLE/)
  assert.ok(!text.includes('$0.00'))
  const bill = {
    total: 5.47,
    month: '2026-10',
    table: 'project.billing.export',
    through: '2026-10-11T10:00:00Z',
    checked: '2026-10-11T12:00:00Z',
    rows: [{ net: 5.47, service: 'Firebase Hosting', project: 'project' }]
  }
  const present = billing_lines(
    { status: 'ok', exports: [bill] },
    100,
    false
  ).join('\n')
  assert.match(present, /MONTH \$5.47/)
  assert.match(present, /Firebase Hosting/)
  assert.match(present, /Billing .* behind/)
})

test('sync shows a summary and wraps full problem paths', () => {
  const folder = 'harness/vault/Areas/a-long-folder-name/'
  const lines = sync_lines(
    [
      { folder, listing: false },
      { folder: 'harness/', listing: true, last_sync: 'today' }
    ],
    false,
    20
  )
  assert.equal(lines[0], '1/2 folders readable; 0 without a local sync record')
  assert.equal(lines.slice(1).join(''), `Cannot read: ${folder}`)
})

test('scrolling exposes all rows instead of silently hiding sections', () => {
  const snapshot = {
    panels: {
      hosts: {
        rows: Array.from({ length: 30 }, (_, index) => ({
          name: `host-${index}`,
          state: 'sleeping'
        }))
      },
      sign_on: { rows: [{ phone }] }
    }
  }
  const top = frame({ snapshot, height: 20, on: false, details: true })
  const bottom = frame({
    snapshot,
    height: 20,
    on: false,
    offset: 999,
    details: true
  })
  assert.match(top, /j\/k scroll/)
  assert.match(bottom, /signed in/)
  assert.match(bottom, /host-29/)
})

test('main view shows charts and cloud power state without diagnostic noise', () => {
  const bill = {
    total: 37.11,
    month: '2026-10',
    table: 'realness.billing.export',
    through: '2026-10-11T09:00:00Z',
    checked: '2026-10-11T17:00:00Z',
    daily: [
      { date: '2026-10-01', cost: 0 },
      { date: '2026-10-02', cost: 37.11 }
    ],
    rows: [
      { service: 'Compute Engine', net: 36.32 },
      { service: 'Cloud Run', net: 0.79 }
    ]
  }
  const snapshot = {
    panels: {
      billing: { status: 'ok', exports: [bill] },
      resources: {
        status: 'ok',
        inventories: [
          {
            project: 'realness',
            instances: [
              { name: 'chat-ui', status: 'RUNNING', machine: 'n2-standard-4' }
            ],
            disks: [{ name: 'boot', size_gb: 20, attached: ['chat-ui'] }]
          }
        ]
      },
      hosts: { rows: [{ name: 'chat-ui', state: 'sleeping' }] },
      services: {
        status: 'ok',
        rows: [{ name: 'sync', found: true, ready: true }]
      },
      sync: { rows: [{ folder: 'practice/', listing: true, last_sync: null }] },
      cost: { rows: [{ phone, day: { cost: 0 }, month: { cost: 0 } }] }
    }
  }
  const text = frame({
    snapshot,
    width: 100,
    height: 30,
    on: false,
    now: Date.parse('2026-10-11T18:00:00Z')
  })
  assert.match(text, /MONTH \$37.11/)
  assert.match(text, /Billing 9h behind/)
  assert.match(text, /Compute Engine \$36.32 #/)
  assert.match(text, /chat-ui  RUNNING/)
  assert.match(text, /20 GB retained/)
  for (const noise of [
    'realness.billing.export',
    'sleeping',
    'practice/',
    '2026-10',
    'UTC',
    'No recorded model cost',
    'HOSTS'
  ])
    assert.ok(!text.includes(noise), noise)
  assert.ok(!text.includes('j/k scroll'))
  assert.match(
    frame({ snapshot, on: false, details: true }),
    /realness.billing.export/
  )
})

test('details keep deleted machine reports separate from empty cloud inventory', () => {
  const snapshot = {
    panels: {
      resources: {
        status: 'ok',
        inventories: [
          { project: 'realness-development', instances: [], disks: [] }
        ]
      },
      hosts: {
        status: 'ok',
        rows: [
          {
            name: 'realness-demo',
            state: 'quiet',
            age_s: 1620,
            actors: { running: 0, idle: 1, stopped: 0 }
          },
          {
            name: 'chat-ui',
            state: 'quiet',
            age_s: 1680,
            actors: { running: 0, idle: 0, stopped: 1 }
          }
        ]
      }
    }
  }
  const text = frame({ snapshot, details: true, on: false, height: 60 })
  assert.match(text, /Cloud inventory: 0 machines, 0 disks/)
  assert.match(text, /AGENT REPORT HISTORY/)
  assert.match(text, /realness-demo  last agent report 27m ago/)
  assert.match(text, /chat-ui  last agent report 28m ago/)
  assert.ok(!text.includes('1 idle'))
  assert.ok(!text.includes('1 stopped'))
  assert.ok(!text.includes('quiet'))
  const unavailable = frame({
    snapshot: {
      panels: { resources: { status: 'failed', error: 'permission denied' } }
    },
    details: true,
    on: false
  })
  assert.match(unavailable, /permission denied/)
  assert.ok(!unavailable.includes('Cloud inventory: 0'))
})

test('stopped cloud machines still show retained disk costs', () => {
  const text = resource_lines(
    {
      status: 'ok',
      inventories: [
        {
          instances: [
            { name: 'chat-ui', status: 'TERMINATED', machine: 'n2-standard-4' }
          ],
          disks: [{ size_gb: 30, attached: [] }]
        }
      ]
    },
    100,
    false
  ).join('\n')
  assert.match(text, /0 running cloud machines  1 stopped/)
  assert.match(text, /chat-ui  STOPPED/)
  assert.match(text, /30 GB retained - storage charges continue/)
  assert.match(text, /1 disks are unattached/)
})

test('cost bars preserve small costs and negative credits', () => {
  const lines = cost_bars(
    [
      { service: 'Compute', net: 36 },
      { service: 'Storage', net: 0.01 },
      { service: 'Credits', net: -2 }
    ],
    40
  )
  assert.ok(lines.every(line => line.length <= 40))
  assert.match(
    lines.find(line => line.startsWith('Storage')),
    /\$0.01 #/
  )
  assert.match(
    lines.find(line => line.startsWith('Credits')),
    /\$-2.00 -/
  )
})

test('keys set the interval; anything else keeps it', () => {
  assert.equal(interval_for('u', 60_000), 15_000)
  assert.equal(interval_for('m', 15_000), 60_000)
  assert.equal(interval_for('h', 60_000), 300_000)
  assert.equal(interval_for('x', 60_000), 60_000)
})

test('the loop hands the token to the health read, so a panel can name the person', async () => {
  const stdout = { write: () => {}, columns: 100, rows: 30 }
  const stdin = {
    isTTY: true,
    setRawMode: () => {},
    resume: () => {},
    off: () => {},
    on: () => {}
  }
  const controller = new AbortController()
  const drawn = []
  const writing = { write: text => drawn.push(text), columns: 100, rows: 30 }
  const loop = watch({
    token: claims(),
    store: store({}),
    ledger: ledger({
      day: { tokens: 0, cost: 0 },
      month: { tokens: 0, cost: 0 }
    }),
    interval_ms: 5,
    stdout: writing,
    stdin,
    signal: controller.signal
  })
  setTimeout(() => controller.abort(), 30)
  const snapshot = await loop
  assert.equal(snapshot.who.phone, phone)
  assert.ok(drawn.join('').includes('REALNESS SERVICE WATCH'))
})

test('details, scroll and quit do not trigger another health read', async () => {
  const stdin = new pass_through()
  let frames = 0
  let reads = 0
  const stdout = {
    columns: 100,
    rows: 20,
    write: text => {
      if (!text.includes('REALNESS SERVICE WATCH')) return
      frames++
      setImmediate(() =>
        stdin.write(frames === 1 ? 'd' : frames === 2 ? 'j' : 'q')
      )
    }
  }
  await watch({
    stdin,
    stdout,
    clear: false,
    read: async () => {
      reads++
      return { panels: {} }
    }
  })
  assert.equal(reads, 1)
  assert.equal(frames, 3)
  assert.equal(stdin.listenerCount('data'), 0)
  assert.equal(stdin.isPaused(), true)
  stdin.destroy()
})

test('the loop draws a first frame, refreshes on the interval, and stops', async () => {
  const written = []
  let reads = 0
  const stdout = { write: text => written.push(text), columns: 100, rows: 30 }
  const stdin = {
    isTTY: true,
    setRawMode: () => {},
    resume: () => {},
    off: () => {},
    on: () => {}
  }
  const controller = new AbortController()
  const loop = watch({
    store: store({}),
    ledger: ledger({
      day: { tokens: 0, cost: 0 },
      month: { tokens: 0, cost: 0 }
    }),
    interval_ms: 15,
    stdout,
    stdin,
    signal: controller.signal,
    read: async () => {
      reads++
      if (reads === 2) controller.abort()
      return { checked: '2026-10-09T17:00:00.000Z', who: null, panels: {} }
    }
  })
  await loop
  assert.ok(reads >= 2)
  assert.ok(
    written.filter(text => text.includes('REALNESS SERVICE WATCH')).length >= 2
  )
})
