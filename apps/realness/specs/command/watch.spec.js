import assert from 'node:assert/strict'
import { it } from 'node:test'
import { PassThrough as pass_through } from 'node:stream'
import {
  health_snapshot,
  local_halo_panel,
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
import { usage_row } from '#root/src/proxy/usage.js'
import { status_html } from '#root/src/halo/status.js'
import { intent_now, lifecycle_html } from '#root/src/sync/halo-lifecycle.js'
import {
  billing_lines,
  cost_bars,
  frame,
  halo_lines,
  health_lights,
  local_light_lines,
  local_panel_lines,
  halo_panel_lines,
  mix_bar,
  model_bar_rows,
  sync_fresh_lines,
  with_machines,
  interval_for,
  panel,
  resource_lines,
  spend_chart,
  sync_lines
} from '../../src/command/watch-terminal.js'
import { in_place, watch } from '../../src/command/watch-loop.js'
import { size_class, stack } from '../../src/command/watch-layout.js'
import { sync_records } from '../../src/command/command.js'

const phone = '+15555550123'
const claims = (extra = {}) =>
  `x.${Buffer.from(JSON.stringify({ phone_number: phone, exp: 2_000_000_000, ...extra })).toString('base64url')}.y`

/** A store that answers only the keys it knows; every other read fails. */
const store = (keys = {}) => ({
  ls: async path => {
    if (!(path in keys)) throw new Error(`${path}: 404`)
    return keys[path]
  },
  cat: async path => {
    if (!(path in keys)) throw new Error(`${path}: 404`)
    return Buffer.from(keys[path])
  }
})

const status_page = ({
  checked = new Date().toISOString(),
  running = '1',
  idle = '0',
  stopped = '0'
} = {}) =>
  `<article itemscope itemtype="/halo"><meta itemprop="name" content="host-1"><meta itemprop="checked" content="${checked}"><meta itemprop="actors_running" content="${running}"><meta itemprop="actors_idle" content="${idle}"><meta itemprop="actors_stopped" content="${stopped}"></article>\n`

const ledger = spent => ({ spent: async () => spent })

it("the watch reads the proxy's ledger rows exactly as the proxy writes them", () => {
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
  const rows = read_rows(page, phone)
  assert.equal(rows.length, 3)
  assert.deepEqual(rows[0], {
    model: 'm',
    actor: 'a-1',
    payer: phone,
    via: 'actor',
    plan: 'free',
    status: 200,
    request_bytes: 10,
    reply_bytes: 20,
    prompt_tokens: 3,
    completion_tokens: 4,
    cached_tokens: 0,
    cache_write_tokens: 0,
    latency_ms: 0,
    cost: 0.01,
    client: '',
    provider: '',
    call: 'c1'
  })
  assert.equal(rows[2].model, 'm:free')
  const total = sum_rows(rows)
  assert.equal(total.tokens, 7)
  assert.equal(Number(total.cost.toFixed(2)), 0.03)
  assert.deepEqual(day_files(['b.html', 'a.html', 'index.html']), [
    'a.html',
    'b.html',
    'index.html'
  ])
})

it('the watch reads a halo record exactly as the sync service does', () => {
  const html = status_html({
    halo: {
      name: 'halo-1',
      checked: '2026-10-09T17:00:00.000Z',
      actors_running: 2
    },
    actors: [{ id: 'a-1', state: 'running' }],
    apps: []
  })
  assert.deepEqual(read_status(html), {
    halo: {
      name: 'halo-1',
      checked: '2026-10-09T17:00:00.000Z',
      actors_running: '2'
    },
    actors: [{ id: 'a-1', state: 'running' }],
    apps: []
  })
})

it('sync records become the folders the panel names, newest time winning', async () => {
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
      synced_at: '2026-10-09T18:00:00.000Z'
    })
  )
  await writeFile(
    join(state, 'sync', 'b.json'),
    JSON.stringify({
      remote: `people/${phone}/harness/`,
      synced_at: '2026-10-09T19:00:00.000Z'
    })
  )
  await writeFile(
    join(state, 'sync', 'c.json'),
    JSON.stringify({
      remote: `people/${phone}/artifacts/realness/practice/`,
      synced_at: '2026-10-09T20:00:00.000Z'
    })
  )
  const records = await sync_records(state)
  await rm(state, { recursive: true, force: true })
  assert.deepEqual(records, {
    'can://~/harness/': { at: '2026-10-09T19:00:00.000Z' }
  })
})

it('the token names the person a watch reads, unless a person is named', () => {
  assert.deepEqual(people_for(who_from(claims()), []), [phone])
  assert.deepEqual(people_for(who_from(claims()), ['+15555550999']), [
    '+15555550999'
  ])
  assert.deepEqual(people_for(null, []), [])
  assert.equal(who_from(null), null)
})

it('a halo record with no recent report is quiet, and its age is shown', async () => {
  const now = Date.now()
  const old = new Date(now - 300_000).toISOString()
  const snapshot = await health_snapshot({
    store: store({
      'can://halos/': ['host-1/'],
      'can://halos/host-1/status.html': status_page({ checked: old })
    }),
    token: claims(),
    ledger: ledger({
      day: { tokens: 1, cost: 0.5 },
      month: { tokens: 2, cost: 1.5 }
    }),
    now
  })
  assert.equal(snapshot.panels.halos.status, 'ok')
  assert.equal(snapshot.panels.halos.rows[0].state, 'quiet')
  assert.ok(snapshot.panels.halos.rows[0].age_s >= 300)
  assert.equal(snapshot.panels.cost.rows[0].month.cost, 1.5)
})

it('a planned park reads parked, never quiet', async () => {
  const now = Date.now()
  const old = new Date(now - 3_600_000).toISOString()
  const snapshot = await health_snapshot({
    store: store({
      'can://halos/': ['host-1/'],
      'can://halos/host-1/status.html': status_page({ checked: old }),
      'can://halos/host-1/lifecycle.html': lifecycle_html(
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
  assert.equal(snapshot.panels.halos.rows[0].state, 'parked')
})

it('a halo with running actors reports running, and no actors reports sleeping', async () => {
  const now = Date.now()
  const running = await health_snapshot({
    store: store({
      'can://halos/': ['host-1/'],
      'can://halos/host-1/status.html': status_page({
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
  assert.equal(running.panels.halos.rows[0].state, 'running')
  const asleep = await health_snapshot({
    store: store({
      'can://halos/': ['host-1/'],
      'can://halos/host-1/status.html': status_page({
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
  assert.equal(asleep.panels.halos.rows[0].state, 'sleeping')
})

it('one failing read fails only its own panel', async () => {
  const snapshot = await health_snapshot({
    store: store({
      'can://halos/': ['host-1/'],
      'can://halos/host-1/status.html': status_page()
    }),
    token: claims(),
    ledger: {
      spent: async () => {
        throw new Error('ledger unreadable')
      }
    }
  })
  assert.equal(snapshot.panels.halos.status, 'ok')
  assert.equal(snapshot.panels.cost.status, 'failed')
  assert.match(snapshot.panels.cost.error, /ledger unreadable/)
  assert.equal(snapshot.panels.sign_on.status, 'ok')
})

it('an unsigned watch reports unknown sign-on and an empty cost panel', async () => {
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
    ['vault/Sessions/']
  )
})

it('the newest session time comes from session names', () => {
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

it('panel labels stay dim while data keeps its contrast', () => {
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
    panel({ title: 'HALOS', lines: ['host-a running'], on: false }),
    ['HALOS', 'host-a running']
  )
})

it("the wide dashboard shows today's calls in the model tile", () => {
  const text = frame({
    snapshot: {
      checked: '2026-10-09T17:00:00.000Z',
      who: { phone },
      panels: {
        model: {
          status: 'ok',
          totals: {
            calls: 2,
            errors: 0,
            error_rate: 0,
            p50_ms: 100,
            p95_ms: 300,
            cache_hit_rate: 0.5,
            cost: 0.01
          },
          by_model: [],
          by_client: []
        },
        cost: {
          status: 'ok',
          rows: [{ phone, day: { cost: 0 }, month: { cost: 0 } }]
        }
      }
    },
    width: 120,
    height: 40,
    on: false
  })
  assert.match(text, /╭─ model /)
  assert.match(text, /calls 2 calls  0 errors \(0\.0%\)/)
})

it('the frame holds the panels, interval, and controls', () => {
  const text = frame({
    snapshot: {
      checked: '2026-10-09T17:00:00.000Z',
      who: { phone },
      panels: {
        halos: {
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
              last_sync: '2026-10-09T16:59:00.000Z'
            }
          ]
        },
        sign_on: {
          status: 'ok',
          state: 'running',
          rows: [{ phone, expires_at: '2026-10-09T18:00:00.000Z' }]
        },
        publish: { status: 'ok', rows: [{ phone, sites: 1 }] },
        model: {
          status: 'ok',
          totals: {
            calls: 2,
            errors: 1,
            error_rate: 0.5,
            p50_ms: 100,
            p95_ms: 900,
            cache_hit_rate: 0,
            cost: 0.02
          },
          by_model: [],
          by_client: []
        }
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

it('a failed panel prints its error and the time of the last read', () => {
  const text = frame({
    snapshot: {
      checked: '2026-10-09T17:00:00.000Z',
      who: null,
      panels: {
        halos: {
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
  assert.match(text, /failed boom/)
  assert.match(text, /last read 16:59:00Z/)
})

it("halo lines carry each state's own color when color is on", () => {
  const lines = halo_lines(
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

it('daily spend reaches the frame through the ledger and health snapshot', async () => {
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
    dates.map((date, cost) => ({
      date,
      tokens: 3,
      cost,
      paid: 0,
      calls: 1,
      used: 3
    }))
  )
  assert.deepEqual(spent.day, { tokens: 3, cost: 2, calls: 1, used: 3 })
  assert.deepEqual(spent.month, { tokens: 9, cost: 3, calls: 3, used: 9 })
  const snapshot = await health_snapshot({
    store: store(keys),
    token: claims(),
    ledger: ledger(spent)
  })
  const text = frame({
    snapshot,
    on: false,
    width: 130,
    height: 60,
    details: true
  })
  assert.match(text, /today \$2\.00  month \$3\.00/)
  assert.ok(!text.includes('tok today'))
  assert.match(text, /10-01 to 10-03; daily/)
  assert.ok(
    text.indexOf('BILLING DETAILS') < text.indexOf('AGENT REPORT HISTORY')
  )
  assert.ok(!spend_chart(spent.daily).join('\n').includes('UTC'))
  assert.match(text, /# #/)
})

it('the watch report sums every person and reaches the frame', async () => {
  const other = '+15555550999'
  const day = '2026-10-09'
  const page = (actor, latency, status) =>
    usage_row({
      model: 'm',
      actor,
      client: 'pi/1.0',
      provider: 'DeepInfra',
      latency_ms: latency,
      status,
      request_bytes: 1,
      reply_bytes: 1,
      usage: { prompt_tokens: 5, completion_tokens: 1, cost: 0.01 }
    })
  const keys = {
    'can://usage/': [`${phone}/`, `${other}/`],
    [`can://usage/${phone}/${day}/`]: ['index.html'],
    [`can://usage/${phone}/${day}/index.html`]: page(
      'a-abcdef123456',
      100,
      200
    ),
    [`can://usage/${other}/${day}/`]: ['index.html'],
    [`can://usage/${other}/${day}/index.html`]: page('a-abcdef123456', 900, 429)
  }
  const found = await usage_ledger(store(keys)).report(day)
  assert.deepEqual(
    [
      found.people,
      found.totals.calls,
      found.totals.errors,
      found.totals.p95_ms,
      found.by_client[0].name
    ],
    [2, 2, 1, 900, 'pi/1.0']
  )
  const snapshot = await health_snapshot({
    store: store(keys),
    token: claims(),
    ledger: {
      spent: async () => ({
        day: { tokens: 0, cost: 0 },
        month: { tokens: 0, cost: 0 },
        daily: []
      }),
      report: async () => found
    },
    now: Date.parse('2026-10-09T12:00:00Z')
  })
  assert.equal(snapshot.panels.model.totals.calls, 2)
  const text = frame({
    snapshot,
    on: false,
    width: 130,
    height: 60,
    details: true
  })
  assert.match(text, /MODEL CALLS - today, all people/)
  assert.match(text, /2 calls  1 error \(50\.0%\)  p50 100ms  p95 900ms/)
  assert.match(text, /model m {2}██████ 2 calls 1 err ████ 900ms/)
  const compact = frame({ snapshot, on: false, width: 100, height: 40 })
  assert.match(compact, /cloud: model: 1 error today/)
})

it('a failed watch report is visible, not a zero', async () => {
  const snapshot = await health_snapshot({
    store: store({}),
    token: claims(),
    ledger: {
      spent: async () => ({
        day: { tokens: 0, cost: 0 },
        month: { tokens: 0, cost: 0 },
        daily: []
      }),
      report: async () => {
        throw new Error('ledger down')
      }
    }
  })
  assert.equal(snapshot.panels.model.status, 'failed')
  const text = frame({ snapshot, on: false, width: 100, height: 40 })
  assert.match(text, /model call stats unavailable/)
})

it('model ledger failures do not turn into a zero-dollar balance', async () => {
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

it('spend bars distinguish zero, small values, and the peak', () => {
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

it('daily charts show negative credits below zero', () => {
  const lines = spend_chart([
    { date: '2026-10-01', cost: 1 },
    { date: '2026-10-02', cost: -2 }
  ])
  assert.ok(lines.some(line => line.includes('$-2.00 |')))
  assert.ok(lines.some(line => line.endsWith('|   -')))
})

it('narrow charts sum days and frames fit terminal dimensions', () => {
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

it('missing billing data never presents a zero-dollar cloud total', () => {
  const text = billing_lines(
    { status: 'failed', error: 'no export' },
    100,
    false
  ).join('\n')
  assert.match(text, /unavailable/)
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
  assert.match(present, /month \$5.47/)
  assert.match(present, /Firebase Hosting/)
  assert.doesNotMatch(present, /behind/)
})

it('billing details show times in local time', () => {
  const bill = {
    table: 'project.billing.export',
    through: '2026-10-11T09:00:00Z',
    checked: '2026-10-11T17:01:52.065Z',
    rows: []
  }
  const text = frame({
    snapshot: { panels: { billing: { status: 'ok', exports: [bill] } } },
    width: 130,
    height: 60,
    on: false,
    details: true
  })
  const local = iso =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  assert.ok(
    text.includes(
      `Usage through ${local(bill.through)}; queried ${local(bill.checked)}`
    ),
    text
  )
  assert.doesNotMatch(text, /T09:00:00Z/)
})

it('sync shows a summary and wraps full problem paths', () => {
  const folder = 'harness/vault/Areas/a-long-folder-name/'
  const lines = sync_lines(
    [
      { folder, listing: false },
      { folder: 'harness/', listing: true, last_sync: 'today' }
    ],
    false,
    20
  )
  assert.equal(lines[0], '1/2 readable')
  assert.equal(lines.slice(1).join(''), `Cannot read: ${folder}`)
})

it('wraps a path with no spaces to break at, keeping every character', () => {
  const folder = 'harness/vault/Areas/one-unbroken-name-with-no-spaces/'
  const lines = sync_lines([{ folder, listing: false }], false, 12)
  const body = lines.slice(1)
  assert.ok(body.length > 1)
  for (const line of body) assert.ok([...line].length <= 12, line)
  assert.equal(body.join(''), `Cannot read: ${folder}`)
})

it('scrolling exposes all rows instead of silently hiding sections', () => {
  const snapshot = {
    panels: {
      halos: {
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

it('main view shows charts and cloud power state without diagnostic noise', () => {
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
      halos: { rows: [{ name: 'chat-ui', state: 'sleeping' }] },
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
  assert.match(text, /month \$37.11/)
  assert.doesNotMatch(text, /behind/)
  assert.match(text, /Compute Engine \$36.32 █/)
  assert.match(text, /chat-ui +\S+ running/)
  assert.match(text, /20 GB retained/)
  for (const noise of [
    'realness.billing.export',
    'practice/',
    '2026-10',
    'UTC',
    'No recorded model cost'
  ])
    assert.ok(!text.includes(noise), noise)
  assert.ok(!text.includes('j/k scroll'))
  assert.match(
    frame({ snapshot, on: false, details: true }),
    /realness.billing.export/
  )
})

it('details keep deleted machine reports separate from empty cloud inventory', () => {
  const snapshot = {
    panels: {
      resources: {
        status: 'ok',
        inventories: [
          { project: 'realness-development', instances: [], disks: [] }
        ]
      },
      halos: {
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
  const text = frame({
    snapshot,
    details: true,
    on: false,
    width: 130,
    height: 60
  })
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

it('stopped cloud machines still show retained disk costs', () => {
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
  assert.match(text, /chat-ui  stopped/)
  assert.match(text, /30 GB retained - storage charges continue/)
  assert.match(text, /1 disks are unattached/)
})

it('cost bars preserve small costs and negative credits', () => {
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
    /\$0.01 ▏·/
  )
  assert.match(
    lines.find(line => line.startsWith('Credits')),
    /\$-2.00 █/
  )
})

it('keys set the interval; anything else keeps it', () => {
  assert.equal(interval_for('u', 60_000), 15_000)
  assert.equal(interval_for('m', 15_000), 60_000)
  assert.equal(interval_for('h', 60_000), 300_000)
  assert.equal(interval_for('x', 60_000), 60_000)
})

it('the loop hands the token to the health read, so a panel can name the person', async () => {
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

it('details, scroll and quit do not trigger another health read', async () => {
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

it('the loop draws a first frame, refreshes on the interval, and stops', async () => {
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

it('frames draw in place without blanking the screen', () => {
  const text = in_place('a\nb\n')
  assert.equal(text, '\x1b[H\x1b[2Ka\n\x1b[2Kb\x1b[J')
  assert.ok(!text.endsWith('\n'))
  assert.ok(!text.includes('\x1b[2J'))
})

it('a resize redraws at the new width without reading services again', async () => {
  const { EventEmitter } = await import('node:events')
  const stdout = Object.assign(new EventEmitter(), {
    columns: 100,
    rows: 30,
    written: [],
    write(text) {
      this.written.push(text)
    }
  })
  const stdin = Object.assign(new EventEmitter(), {
    setRawMode: () => {},
    resume: () => {},
    pause: () => {}
  })
  const controller = new AbortController()
  let reads = 0
  const loop = watch({
    interval_ms: 60_000,
    stdout,
    stdin,
    signal: controller.signal,
    read: async () => {
      reads++
      return { panels: {} }
    }
  })
  await new Promise(resolve => setImmediate(resolve))
  stdout.columns = 30
  stdout.emit('resize')
  controller.abort()
  await loop
  assert.equal(reads, 1)
  const resized = stdout.written
    .filter(text => text.includes('REALNESS SERVICE WATCH'))
    .at(-1)
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
  assert.ok(resized.split('\n').every(line => [...line].length <= 30))
  assert.equal(stdout.listenerCount('resize'), 0)
})

it('a long watch asks for a fresh sign-in after a 401, then keeps it', async () => {
  const { renewing_token } = await import('#root/src/command/command.js')
  const minted = ['first', 'second']
  const where = { get_token: async () => minted.shift() ?? 'none' }
  const token = renewing_token(where, await where.get_token())
  assert.equal(await token(), 'first')
  assert.equal(await token({ refresh: true }), 'second')
  assert.equal(await token(), 'second', 'the watch keeps the renewed one')
})

it('free-model calls show as model use, though they spend no allowance', async () => {
  const phone = '+15555550123'
  const path = `can://usage/${phone}/2026-10-30/`
  const keys = {
    [path]: ['index.html'],
    [`${path}index.html`]: usage_row({
      model: 'example/model:free',
      payer: phone,
      plan: 'free',
      status: 200,
      usage: { prompt_tokens: 40000, completion_tokens: 3552, cost: 0 },
      call: 'c1'
    })
  }
  const spent = await usage_ledger(store(keys)).spent(
    phone,
    new Date('2026-10-30T12:00:00Z')
  )
  assert.deepEqual(spent.month, { tokens: 0, cost: 0, calls: 1, used: 43552 })
  const snapshot = await health_snapshot({
    store: store(keys),
    token: claims(),
    ledger: ledger(spent)
  })
  const text = frame({ snapshot, on: false, width: 100, height: 60 })
  assert.doesNotMatch(text, /no model use/)
  assert.match(text, /month 1 call 44k/)
})

it('the local halo is asked over HTTP, not read from a synced report', async () => {
  const asked = []
  const running = await local_halo_panel(async url => {
    asked.push(url)
    return {
      status: 200,
      body: JSON.stringify({
        ok: true,
        seed: { built: true },
        actors: { running: 2, idle: 1, stopped: 3 }
      })
    }
  })
  assert.match(asked[0], /\/v1\/health$/)
  assert.equal(running.state, 'running')
  assert.equal(running.seed, 'built')
  assert.deepEqual(running.actors, { running: 2, idle: 1, stopped: 3 })
})

it('a local halo that does not answer is asleep, not an error', async () => {
  const asleep = await local_halo_panel(async () => null)
  assert.equal(asleep.state, 'sleeping')
  assert.equal(asleep.actors, null)
})

it('a port answering something else is an error worth reading', async () => {
  await assert.rejects(
    local_halo_panel(async () => ({ status: 404, body: 'nope' })),
    /the local halo answered 404/
  )
})

it('the snapshot carries the local halo beside the synced ones', async () => {
  const snapshot = await health_snapshot({
    store: store({}),
    token: claims(),
    ledger: ledger({
      day: { tokens: 0, cost: 0 },
      month: { tokens: 0, cost: 0 }
    }),
    request: async () => ({
      status: 200,
      body: JSON.stringify({
        ok: true,
        actors: { running: 0, idle: 1, stopped: 0 }
      })
    })
  })
  assert.equal(snapshot.panels.local.status, 'ok')
  assert.equal(snapshot.panels.local.state, 'idle')
})

it('the local halo gets its own light, panel, and status line', () => {
  const panels = {
    halos: { status: 'ok', rows: [] },
    local: {
      status: 'ok',
      url: 'http://127.0.0.1:18080/v1/health',
      state: 'running',
      seed: 'built',
      actors: { running: 1, idle: 0, stopped: 2 }
    },
    services: { status: 'ok', rows: [] }
  }
  assert.doesNotMatch(health_lights(panels, false, 200).join(' '), /local/)
  const lights = local_light_lines(panels, false).join(' ')
  assert.match(lights, /halo ok/)
  assert.match(lights, /sync \?/)
  const lines = local_panel_lines(panels.local, false, 200)
  assert.equal(lines.length, 2)
  assert.match(lines[0], /up {2}127\.0\.0\.1:18080/)
  assert.match(lines[1], /1 run 0 idle 2 stop {2}seed built/)
})

it('a machine that is running is never drawn as parked', () => {
  const halos = {
    status: 'ok',
    rows: [{ name: 'realness-1', state: 'parked', age_s: 40, actors: null }]
  }
  const resources = {
    status: 'ok',
    inventories: [
      {
        project: 'p',
        disks: [],
        instances: [{ name: 'realness-1', status: 'RUNNING' }]
      }
    ]
  }
  const shown = with_machines(halos, resources)
  assert.equal(shown.rows[0].state, 'running')
  assert.doesNotMatch(halo_panel_lines(shown, false, 200)[0], /parked/)
  assert.equal(
    with_machines(halos, { status: 'ok', inventories: [] }).rows[0].state,
    'parked'
  )
})

it('a narrow halo panel keeps the actor labels and drops the age', () => {
  const halos = {
    status: 'ok',
    rows: [
      {
        name: 'realness-1',
        state: 'ok',
        age_s: 9,
        actors: { running: 0, idle: 0, stopped: 1 }
      }
    ]
  }
  assert.match(
    halo_panel_lines(halos, false, 200)[0],
    /0 run 0 idle 1 stop {2}9s ago/
  )
  assert.equal(
    halo_panel_lines(halos, false, 35)[0],
    'realness-1  0 run 0 idle 1 stop'
  )
})

it('a local halo that was not read says how to start one', () => {
  const lines = local_panel_lines(null, false, 200)
  assert.match(lines[0], /unavailable/)
  assert.match(lines[1], /run npm run local/)
})

it('with no local halo reading, nothing local is drawn', () => {
  const panels = {
    halos: { status: 'ok', rows: [] },
    services: { status: 'ok', rows: [] }
  }
  assert.doesNotMatch(health_lights(panels, false, 200).join(' '), /local/)
})

it('a tall dashboard gives the local halo its own tile', () => {
  const panels = {
    halos: { status: 'ok', rows: [] },
    services: { status: 'ok', rows: [] },
    local: {
      status: 'ok',
      url: 'http://127.0.0.1:18080/v1/health',
      state: 'running',
      seed: 'built',
      actors: { running: 1, idle: 0, stopped: 2 }
    }
  }
  const text = frame({
    snapshot: { panels },
    width: 120,
    height: 40,
    on: false
  })
  assert.match(text, /╭─ local /)
  assert.match(text, /127\.0\.0\.1:18080/)
  assert.match(text, /local: halo up at 127\.0\.0\.1:18080/)
  assert.match(text, /cloud: 0 services ready/)
})

it('a short dashboard drops the local tile rather than overflow the window', () => {
  const panels = {
    halos: { status: 'ok', rows: [] },
    services: { status: 'ok', rows: [] },
    local: {
      status: 'ok',
      url: 'http://127.0.0.1:18080/v1/health',
      state: 'running',
      seed: null,
      actors: null
    }
  }
  const text = frame({
    snapshot: { panels },
    width: 120,
    height: 18,
    on: false
  })
  assert.doesNotMatch(text, /╭─ local /)
  assert.match(local_panel_lines(panels.local, false, 200)[1], /no actors yet/)
  const no_seed = {
    status: 'ok',
    state: 'idle',
    url: null,
    seed: null,
    actors: { running: 0, idle: 1, stopped: 0 }
  }
  assert.match(local_panel_lines(no_seed, false, 200)[1], /seed unknown/)
  assert.match(
    local_panel_lines(no_seed, false, 200)[0],
    /not in this checkout/
  )
})

const layout_now = Date.parse('2026-10-11T18:00:00Z')
const layout_days = Array.from(
  { length: 11 },
  (_, at) => `2026-10-${String(at + 1).padStart(2, '0')}`
)
const layout_snapshot = {
  panels: {
    billing: {
      status: 'ok',
      exports: [
        {
          total: 37.11,
          daily: layout_days.map((date, at) => ({
            date,
            cost: 1 + ((at * 7) % 5)
          })),
          rows: [
            { service: 'Compute Engine', net: 30.32 },
            { service: 'Cloud Run', net: 4.79 }
          ]
        }
      ]
    },
    halos: { status: 'ok', rows: [] },
    services: { status: 'ok', rows: [] },
    sync: {
      status: 'ok',
      rows: [{ folder: 'practice/', listing: true, last_sync: null }]
    },
    publish: { status: 'ok', rows: [{ phone, sites: 2 }] },
    cost: { rows: [{ phone, day: { cost: 0 }, month: { cost: 0 } }] },
    model: {
      status: 'ok',
      totals: {
        calls: 12,
        errors: 0,
        error_rate: 0,
        p50_ms: 900,
        p95_ms: 4000,
        cache_hit_rate: 0.5,
        cost: 0.4
      },
      by_model: [
        { name: 'sonnet', calls: 12, errors: 0, p95_ms: 4000, cost: 0.4 }
      ],
      by_client: []
    },
    traffic: {
      people: 70,
      deeper: 12,
      outside: 5,
      previous: 50,
      newest: new Date(layout_now).toISOString(),
      daily: layout_days.map((date, at) => ({ date, people: 3 + at }))
    }
  }
}

/** The plain rows between the head and the controls, each checked for width. */
const layout_rows = (width, height, offset = 0) => {
  const lines = frame({
    snapshot: layout_snapshot,
    width,
    height,
    offset,
    on: false,
    now: layout_now
  })
    .trimEnd()
    .split('\n')
  assert.equal(lines.length, height)
  const rows = lines.slice(1, -1)
  for (const row of rows) assert.equal([...row].length, width)
  return { rows, text: lines.join('\n'), controls: lines.at(-1) }
}
const boxes_across = row => row.match(/╭─/g)?.length ?? 0

it('terminal size picks small, medium, tall, or wide', () => {
  assert.equal(size_class(80, 24), 'small')
  assert.equal(size_class(200, 17), 'small')
  assert.equal(size_class(120, 40), 'medium')
  assert.equal(size_class(160, 100), 'tall')
  assert.equal(size_class(179, 50), 'medium')
  assert.equal(size_class(180, 50), 'wide')
  assert.equal(size_class(300, 80), 'wide')
})

it('a column keeps its order, shows only whole boxes, and grows only what can grow', () => {
  const lines = count => Array.from({ length: count }, () => 'x')
  const boxes = [
    { name: 'chart', title: 'chart', lines: lines(2), max: 6 },
    { name: 'extra', title: 'extra', lines: lines(4) },
    { name: 'must', title: 'must', lines: lines(1) }
  ]
  boxes[0].grow = extra => lines(2 + extra)
  const short = stack(boxes, 8, ['must', 'chart', 'extra'])
  assert.deepEqual(
    short.map(box => [box.name, box.height]),
    [
      ['chart', 5],
      ['must', 3]
    ]
  )
  const roomy = stack(boxes, 20, ['must', 'chart', 'extra'])
  assert.deepEqual(
    roomy.map(box => [box.name, box.height]),
    [
      ['chart', 6],
      ['extra', 6],
      ['must', 3]
    ]
  )
  assert.equal(roomy[0].lines.length, 4)
  assert.deepEqual(stack(boxes, 2, ['must']), [])
})

it('a small terminal stacks its boxes in one column that scrolls', () => {
  const top = layout_rows(80, 24)
  assert.match(top.rows[0], /^╭─ cloud-billing ─+╮$/)
  assert.ok(top.rows.every(row => boxes_across(row) <= 1))
  assert.match(top.controls, /rows 1-22\/\d+ {2}j\/k scroll/)
  assert.doesNotMatch(top.text, /daily-cost|daily-traffic|publish/)
  const down = layout_rows(80, 24, 1)
  assert.equal(down.rows[0], top.rows[1])
  assert.match(down.controls, /rows 2-23\//)
})

it('a medium terminal caps the chart and fills the rows it frees', () => {
  const { rows, text } = layout_rows(120, 40)
  assert.match(rows[0], /^╭─ cloud-spend .*╮╭─ cloud-health .*╮$/)
  assert.ok(rows.every(row => boxes_across(row) <= 2))
  assert.equal(
    layout_rows(170, 60).rows.findIndex(row => row.startsWith('╰')),
    15
  )
  assert.match(text, /╭─ daily-cost /)
  assert.match(text, /10-11 █+·* \$1\.00/)
  assert.match(text, /╭─ model /)
  assert.match(text, /╭─ sync /)
  assert.equal(text.match(/╭─/g).length, text.match(/╰─/g).length)
})

it('a tall terminal puts the chart across the top, two columns below', () => {
  const { rows, text } = layout_rows(160, 100)
  const chart_rows = rows.findIndex(row => row.startsWith('╰')) + 1
  assert.equal(chart_rows, 16)
  for (const row of rows.slice(0, chart_rows))
    assert.doesNotMatch(row, /╮╭|││|╯╰/)
  assert.match(rows[chart_rows], /^╭─ budget ─+╮╭─ cloud-health ─+╮$/)
  for (const title of ['daily-cost', 'daily-traffic', 'sync', 'publish'])
    assert.match(text, new RegExp(`╭─ ${title} `))
  assert.match(text, /10-11 █+ 13 people/)
})

it('a wide terminal draws three columns', () => {
  const { rows, text } = layout_rows(300, 80)
  assert.match(
    rows[0],
    /^╭─ cloud-spend .*╮╭─ site-traffic .*╮╭─ cloud-health .*╮$/
  )
  assert.ok(rows.every(row => boxes_across(row) <= 3))
  assert.match(text, /╭─ publish ─+╮/)
  assert.match(text, new RegExp(`${phone.replace('+', '\\+')} {2}sites 2`))
  assert.equal(size_class(179, 90), 'tall')
})

it('a large terminal shows the details as boxes and offers no second page', () => {
  const large = frame({
    snapshot: layout_snapshot,
    width: 300,
    height: 80,
    on: false,
    details: true,
    now: layout_now
  })
  assert.match(large, /╭─ model /)
  assert.match(large, /╭─ cloud-machines /)
  assert.match(large, /No local sync record: practice\//)
  assert.doesNotMatch(large, /d details|d costs|BILLING DETAILS/)
  const medium = layout_rows(120, 40)
  assert.match(medium.controls, /d details/)
  assert.doesNotMatch(medium.text, /practice\//)
})

it('each thing has one name and one box', () => {
  const snapshot = {
    panels: {
      ...layout_snapshot.panels,
      sign_on: { status: 'ok', rows: [{ phone, expires_at: null }] },
      services: {
        status: 'ok',
        rows: [{ name: 'realness-sync', found: true, ready: true }]
      },
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
      local: {
        status: 'ok',
        url: 'http://127.0.0.1:18080/v1/health',
        state: 'running',
        seed: 'built',
        actors: { running: 1, idle: 0, stopped: 2 }
      }
    }
  }
  const text = frame({
    snapshot,
    width: 300,
    height: 80,
    on: false,
    now: layout_now
  })
  const names = [
    'model',
    'local',
    'cloud-health',
    'cloud-machines',
    'cloud-halos',
    'status',
    'sync',
    'publish',
    'sign-on'
  ]
  for (const name of names)
    assert.equal(text.match(new RegExp(`╭─ ${name} `, 'g'))?.length, 1, name)
  for (const gone of [
    'model-spend',
    'model-calls',
    'model-ledger',
    'local-halo',
    'cloud-resources',
    'agent-reports',
    'billing-details',
    'cloud-services'
  ])
    assert.doesNotMatch(text, new RegExp(gone))
  assert.match(text, /n2-standard-4/)
  assert.match(text, /realness-sync {2}ready/)
  assert.match(text, /model sonnet {2}██████ 12 calls/)
  assert.doesNotMatch(text, /cloud: model calls/)
})

const healthy_panels = {
  billing: { status: 'ok', exports: [] },
  resources: { status: 'ok', inventories: [] },
  halos: { status: 'ok', rows: [{ name: 'chat-ui', state: 'running' }] },
  services: {
    status: 'ok',
    rows: ['sync', 'proxy', 'gate'].map(name => ({
      name: `realness-${name}`,
      found: true,
      ready: true
    }))
  },
  local: { status: 'ok', url: 'http://127.0.0.1:18080/v1/health' },
  sync: { status: 'ok', rows: [{ folder: 'vault/', listing: true }] },
  cost: { status: 'ok', rows: [] },
  model: { status: 'ok', totals: { calls: 0 } },
  traffic: { people: 1, deeper: 0, outside: 0, daily: [] }
}

/** The head row, which carries the verdict on every layout. */
const head_row = (panels, width = 120, height = 40) =>
  frame({
    snapshot: { panels },
    width,
    height,
    on: false,
    now: layout_now
  })
    .split('\n')
    .at(0)

it('the head answers all ok in one line', () => {
  const healthy = head_row(healthy_panels)
  assert.match(healthy, /every 60s {2}all ok/)
  assert.equal(healthy.match(/all ok/g).length, 1)
  assert.ok([...healthy].length <= 120)
  assert.equal(
    head_row({ ...healthy_panels, cost: { status: 'failed' } }),
    healthy.replace('all ok', '1 down')
  )
  assert.match(
    head_row({
      ...healthy_panels,
      halos: { status: 'ok', rows: [{ name: 'chat-ui', state: 'quiet' }] }
    }),
    /1 warn/
  )
  assert.match(head_row({}), /no data/)
  assert.match(
    head_row({ ...healthy_panels, traffic: { status: 'failed' } }, 300, 80),
    /1 down/
  )
})

/** A row inside a box that carries nothing. */
const blank_body = row => row.includes('│') && row.replace(/[│\s]/g, '') === ''

it('spare rows grow the charts and leave no blank box', () => {
  const { rows, text } = layout_rows(160, 100)
  const chart_rows = rows.findIndex(row => row.startsWith('╰')) + 1
  assert.equal(chart_rows, 16)
  assert.match(text, /10-11 █+·* \$1\.00/)
  assert.equal(text.match(/│ \d\d-\d\d █/g).length, 22)
  assert.equal(rows.at(-1).trim(), '')
  for (let at = 1; at < rows.length; at++)
    assert.ok(!(blank_body(rows[at]) && blank_body(rows[at - 1])), rows[at])
  const split = layout_rows(80, 24)
  assert.match(split.rows[0], /^╭─ cloud-billing ─+╮$/)
  assert.match(split.controls, /j\/k scroll/)
})

it('a growing box shows more of its own data and stops at its cap', () => {
  const services = Array.from({ length: 9 }, (_, at) => ({
    service: `svc${at}`,
    net: 9 - at
  }))
  const models = Array.from({ length: 6 }, (_, at) => ({
    name: `mod${at}`,
    calls: 6 - at,
    errors: 0,
    p95_ms: 100,
    cost: 0.1
  }))
  const panels = {
    ...layout_snapshot.panels,
    billing: {
      status: 'ok',
      exports: [
        {
          total: 45,
          daily: layout_snapshot.panels.billing.exports[0].daily,
          rows: services
        }
      ]
    },
    model: {
      status: 'ok',
      totals: {
        calls: 21,
        errors: 0,
        error_rate: 0,
        p50_ms: 100,
        p95_ms: 200,
        cache_hit_rate: 0,
        cost: 0.6
      },
      by_model: models,
      by_client: []
    }
  }
  const drawn = (width, height) =>
    frame({ snapshot: { panels }, width, height, on: false, now: layout_now })
  const medium = drawn(120, 40)
  const large = drawn(160, 100)
  const named = (text, pattern) =>
    text.match(new RegExp(pattern, 'g'))?.length ?? 0
  assert.equal(named(medium, '│ svc\\d '), 5)
  assert.match(medium, /Other/)
  assert.equal(named(medium, 'model mod\\d '), 1)
  assert.equal(named(large, '│ svc\\d '), 9)
  assert.equal(named(large, 'model mod\\d '), 6)
  for (const text of [medium, large])
    assert.ok(!text.split('\n').some(blank_body))
})

it('a halo draws its actor mix and a disk draws its size', () => {
  const halos = {
    status: 'ok',
    rows: [
      {
        name: 'chat-ui',
        state: 'running',
        age_s: 40,
        actors: { running: 1, idle: 2, stopped: 1 }
      },
      { name: 'parked', state: 'parked', age_s: 400, actors: null }
    ]
  }
  const lines = halo_panel_lines(halos, false, 60)
  assert.match(lines[0], /^chat-ui {2}1 run 2 idle 1 stop {2}40s ago$/)
  assert.match(lines[1], /^██▓▓▓▓·· {2}mem .*disk /)
  assert.match(lines[2], /^parked {2}parked {2}6m ago$/)
  assert.equal(mix_bar({ running: 0, idle: 0, stopped: 0 }, 4, false), '····')
  assert.equal(mix_bar({ running: 3 }, 4, true), '\x1b[32m████\x1b[0m')
  const panels = {
    resources: {
      status: 'ok',
      inventories: [
        {
          project: 'p',
          instances: [{ name: 'chat-ui', status: 'RUNNING', machine: 'n2' }],
          disks: [
            { name: 'boot', size_gb: 20, attached: ['chat-ui'] },
            { name: 'old', size_gb: 10, attached: [] }
          ]
        }
      ]
    }
  }
  const text = frame({
    snapshot: { panels },
    width: 160,
    height: 100,
    on: false,
    now: layout_now
  })
  assert.match(text, /boot {2}████████ 20 GB {2}chat-ui/)
  assert.match(text, /old {2}████···· 10 GB {2}unattached/)
})

it('a model row draws its calls and its latency', () => {
  const panels = {
    cost: { rows: [{ phone, day: { cost: 0 }, month: { cost: 0 } }] },
    model: {
      status: 'ok',
      totals: {
        calls: 10,
        errors: 1,
        error_rate: 0.1,
        p50_ms: 100,
        p95_ms: 4000,
        cache_hit_rate: 0,
        cost: 0.6
      },
      by_model: [
        { name: 'mod0', calls: 6, errors: 0, p95_ms: 4000, cost: 0.3 },
        { name: 'mod1', calls: 3, errors: 1, p95_ms: 2000, cost: 0.2 },
        { name: 'mod2', calls: 1, errors: 0, p95_ms: 100, cost: 0.1 }
      ],
      by_client: []
    }
  }
  const text = frame({
    snapshot: { panels },
    width: 160,
    height: 100,
    on: false,
    now: layout_now
  })
  assert.match(text, /model mod0 {2}██████ 6 calls ████ 4000ms/)
  assert.match(text, /model mod1 {2}███··· 3 calls 1 err ██·· 2000ms/)
  assert.match(text, /model mod2 {2}█····· 1 call ▏··· 100ms/)
  const colored = frame({
    snapshot: { panels },
    width: 160,
    height: 100,
    on: true,
    now: layout_now
  })
  assert.match(colored, /\x1b\[32m██████\x1b\[0m 6 calls/)
  assert.match(colored, /\x1b\[31m████\x1b\[0m 4000ms/)
  assert.match(colored, /\x1b\[33m██··\x1b\[0m 2000ms/)
  assert.match(colored, /\x1b\[32m▏···\x1b\[0m 100ms/)
  const rows = model_bar_rows('model', panels.model.by_model, 60, false)
  assert.match(rows[0], /^model mod0 +██████ 6 calls ████ 4000ms$/)
  assert.match(rows[1], /^model mod1 +███··· 3 calls 1 err ██·· 2000ms$/)
  assert.match(rows[2], /^model mod2 +█····· 1 call ▏··· 100ms$/)
  assert.match(
    model_bar_rows('model', panels.model.by_model, 36, false)[0],
    /^model mod0 {2}6 calls p95 4000ms \$0\.30$/
  )
})

it('a sync row draws how fresh its last sync is', () => {
  const rows = [
    {
      folder: 'vault/',
      listing: true,
      newest: new Date(layout_now - 60_000).toISOString()
    },
    {
      folder: 'practice/',
      listing: true,
      newest: new Date(layout_now - 3 * 86_400_000).toISOString()
    },
    { folder: 'archive/', listing: true, last_sync: null }
  ]
  const plain = sync_fresh_lines(rows, false, layout_now)
  assert.match(plain[0], /^vault\/ {2}██████ 1m ago$/)
  assert.match(plain[1], /^practice\/ {2}······ 3d ago$/)
  assert.match(plain[2], /^archive\/ {2}······ never$/)
  const colored = sync_fresh_lines(rows, true, layout_now)
  assert.match(colored[0], /\x1b\[32m██████\x1b\[0m 1m ago/)
  assert.match(colored[1], /\x1b\[31m······\x1b\[0m 3d ago/)
  const text = frame({
    snapshot: { panels: { sync: { status: 'ok', rows } } },
    width: 160,
    height: 100,
    on: false,
    now: layout_now
  })
  assert.match(text, /╭─ sync /)
  assert.match(text, /vault\/ {2}██████ 1m ago/)
  assert.match(text, /No local sync record: archive\//)
  const medium = frame({
    snapshot: { panels: { sync: { status: 'ok', rows } } },
    width: 120,
    height: 40,
    on: false,
    now: layout_now
  })
  assert.doesNotMatch(medium, /1m ago/)
})

it('a medium screen gets one detail row per box', () => {
  const panels = {
    billing: { status: 'ok', exports: [] },
    services: {
      status: 'ok',
      rows: ['svc-a', 'svc-b', 'svc-c'].map(name => ({
        name,
        found: true,
        ready: true
      }))
    },
    resources: {
      status: 'ok',
      inventories: [
        {
          project: 'p',
          instances: [
            { name: 'chat-ui', status: 'RUNNING', machine: 'n2-standard-4' },
            { name: 'other', status: 'TERMINATED', machine: 'e2-small' }
          ],
          disks: [
            { name: 'boot', size_gb: 50, attached: ['chat-ui'] },
            { name: 'old', size_gb: 10, attached: [] }
          ]
        }
      ]
    },
    sync: {
      status: 'ok',
      rows: [
        {
          folder: 'vault/',
          listing: true,
          newest: new Date(layout_now - 60_000).toISOString(),
          last_sync: new Date(layout_now - 60_000).toISOString()
        },
        {
          folder: 'practice/',
          listing: true,
          newest: new Date(layout_now - 3 * 86_400_000).toISOString(),
          last_sync: new Date(layout_now - 3 * 86_400_000).toISOString()
        }
      ]
    },
    cost: { rows: [{ phone, day: { cost: 0 }, month: { cost: 0 } }] },
    model: {
      status: 'ok',
      totals: {
        calls: 10,
        errors: 0,
        error_rate: 0,
        p50_ms: 100,
        p95_ms: 400,
        cache_hit_rate: 0,
        cost: 0.5
      },
      by_model: [
        { name: 'mod0', calls: 6, errors: 0, p95_ms: 400, cost: 0.3 },
        { name: 'mod1', calls: 3, errors: 0, p95_ms: 300, cost: 0.2 },
        { name: 'mod2', calls: 1, errors: 0, p95_ms: 100, cost: 0.1 }
      ],
      by_client: []
    }
  }
  const count = (text, pattern) =>
    text.match(new RegExp(pattern, 'g'))?.length ?? 0
  const medium = frame({
    snapshot: { panels },
    width: 120,
    height: 50,
    on: false,
    now: layout_now
  })
  const large = frame({
    snapshot: { panels },
    width: 160,
    height: 100,
    on: false,
    now: layout_now
  })
  assert.equal(size_class(120, 50), 'medium')
  assert.equal(count(medium, 'svc-'), 1)
  assert.equal(count(medium, 'n2-standard-4'), 1)
  assert.equal(count(medium, 'e2-small'), 0)
  assert.equal(count(medium, 'model mod\\d '), 1)
  assert.match(medium, /calls 10 calls {2}0 errors/)
  assert.equal(count(medium, 'vault/'), 0)
  assert.equal(count(large, 'svc-'), 3)
  assert.equal(count(large, 'model mod\\d '), 3)
  assert.equal(count(large, 'vault/'), 1)
})

it('health and money read first; detail boxes sit quiet', () => {
  const panels = {
    ...layout_snapshot.panels,
    local: {
      status: 'ok',
      url: 'http://127.0.0.1:18080/v1/health',
      state: 'running',
      seed: 'built',
      actors: { running: 1, idle: 0, stopped: 2 }
    }
  }
  const draw = (width, height, on) =>
    frame({ snapshot: { panels }, width, height, on, now: layout_now })
  for (const [width, height] of [
    [120, 40],
    [160, 100],
    [300, 80]
  ]) {
    const plain = draw(width, height, false)
    const order = ['cloud-health', 'status', 'local'].map(name =>
      plain.indexOf(`╭─ ${name} `)
    )
    assert.ok(
      order.every(at => at > 0),
      `${width}x${height}`
    )
    assert.deepEqual(
      order,
      order.toSorted((a, b) => a - b)
    )
    const colored = draw(width, height, true)
    const dim = '\x1b[90m'
    const clay = '\x1b[38;2;163;65;69m'
    for (const name of ['sync', 'publish', 'daily-cost'])
      assert.ok(colored.includes(`${dim}╭─ \x1b[0m${dim}${name}`), name)
    for (const name of ['cloud-health', 'budget', 'status'])
      assert.ok(colored.includes(`${clay}╭─ \x1b[0m`), name)
    assert.ok(!colored.includes(`${dim}╭─ \x1b[0m${dim}cloud-health`))
    assert.ok(!colored.includes(`${dim}╭─ \x1b[0m${dim}budget`))
  }
})

it('every dashboard chart is Braille and every bar is a block', () => {
  const panels = {
    ...layout_snapshot.panels,
    cost: {
      rows: [
        {
          phone,
          day: { cost: 0.4, calls: 2, used: 9000 },
          month: { cost: 6.2, calls: 30, used: 240000 },
          daily: layout_days.map((date, at) => ({
            date,
            cost: at / 10,
            used: at * 1000
          }))
        }
      ]
    }
  }
  const box_rows = (text, title) => {
    const at = text.indexOf(`╭─ ${title} `)
    const lines = text.split('\n')
    const col = text.slice(0, at).split('\n').at(-1).length
    const width =
      lines
        .find(row => row.includes(`╭─ ${title} `))
        .slice(col)
        .indexOf('╮') + 1
    const column = lines.map(row => row.slice(col, col + width))
    const from = column.findIndex(row => row.startsWith(`╭─ ${title} `))
    const body = []
    for (const row of column.slice(from + 1)) {
      if (row.startsWith('╰')) break
      body.push(row)
    }
    return body
  }
  const braille_rows = (text, title) =>
    box_rows(text, title).filter(row => /[\u2801-\u28ff]/.test(row)).length
  for (const [width, height] of [
    [120, 40],
    [160, 100],
    [300, 80]
  ]) {
    const text = frame({
      snapshot: { panels },
      width,
      height,
      on: false,
      now: layout_now
    })
    assert.doesNotMatch(text, /[▁▂▃▄▅▆▇]/, `${width}x${height}`)
    assert.doesNotMatch(text, /#/, `${width}x${height}`)
    assert.match(text, /Compute Engine \$30\.32 █+/)
    assert.ok(braille_rows(text, 'site-traffic') >= 2, 'traffic')
    assert.ok(braille_rows(text, 'model') >= 2, 'model')
  }
  const tall = frame({
    snapshot: { panels },
    width: 160,
    height: 100,
    on: false,
    now: layout_now
  })
  assert.equal(braille_rows(tall, 'site-traffic'), 8)
})

it('labels are lowercase and no row is clipped', () => {
  const panels = {
    ...layout_snapshot.panels,
    services: {
      status: 'ok',
      rows: [
        { name: 'realness-sync', found: true, ready: false },
        { name: 'realness-gate', found: false }
      ]
    },
    resources: {
      status: 'ok',
      inventories: [
        {
          project: 'realness-online',
          instances: [
            { name: 'chat-ui', status: 'RUNNING', machine: 'n2-standard-4' },
            { name: 'parked-one', status: 'TERMINATED', machine: 'e2-small' }
          ],
          disks: [
            { name: 'boot-disk', size_gb: 50, attached: ['chat-ui'] },
            { name: 'old-disk', size_gb: 10, attached: [] }
          ]
        }
      ]
    },
    sync: {
      status: 'ok',
      rows: [
        {
          folder: 'vault/',
          listing: true,
          last_sync: new Date(layout_now - 60_000).toISOString()
        },
        { folder: 'harness/', listing: false, error: 'not a folder' }
      ]
    },
    model: {
      status: 'ok',
      totals: {
        calls: 10,
        errors: 1,
        error_rate: 0.1,
        p50_ms: 100,
        p95_ms: 4000,
        cache_hit_rate: 0.5,
        cost: 0.6
      },
      by_model: [
        {
          name: 'claude-sonnet-long-name',
          calls: 6,
          errors: 0,
          p95_ms: 4000,
          cost: 0.3
        }
      ],
      by_client: []
    },
    publish: { status: 'ok', rows: [{ phone, sites: 2 }] },
    sign_on: { status: 'ok', rows: [{ phone, expires_at: null }] }
  }
  for (const [width, height] of [
    [80, 24],
    [120, 40],
    [160, 100],
    [300, 80]
  ]) {
    const text = frame({
      snapshot: { panels },
      width,
      height,
      on: false,
      now: layout_now
    })
    const body = text.trimEnd().split('\n').slice(1).join('\n')
    const label = `${width}x${height}`
    assert.deepEqual(body.match(/\b[A-Z]{3,}\b/g), null, label)
    assert.equal(body.match(/…/g), null, label)
    assert.equal(body.match(/undefined/g), null, label)
  }
})

it('the footer marks the active interval and a read in flight', () => {
  const footer_of = options =>
    frame({
      snapshot: { panels: healthy_panels },
      width: 120,
      height: 40,
      on: false,
      now: layout_now,
      ...options
    })
      .trimEnd()
      .split('\n')
      .at(-1)
  assert.match(footer_of({ interval_ms: 15_000 }), /u 15s\* {2}m 60s {2}h 5m/)
  assert.match(footer_of({ interval_ms: 60_000 }), /u 15s {2}m 60s\* {2}h 5m/)
  assert.match(footer_of({ interval_ms: 300_000 }), /u 15s {2}m 60s {2}h 5m\*/)
  assert.match(
    footer_of({ interval_ms: 60_000, reading: true }),
    /h 5m {2}reading/
  )
  assert.doesNotMatch(footer_of({ interval_ms: 60_000 }), /reading/)
})

it('the loop shows a read in flight before the read returns', async () => {
  const written = []
  const controller = new AbortController()
  let reads = 0
  const loop = watch({
    interval_ms: 60_000,
    stdout: { write: text => written.push(text), columns: 120, rows: 40 },
    stdin: {
      isTTY: true,
      setRawMode: () => {},
      resume: () => {},
      off: () => {},
      on: () => {}
    },
    signal: controller.signal,
    read: async () => {
      reads++
      controller.abort()
      return { checked: '2026-10-09T17:00:00.000Z', panels: {} }
    }
  })
  await loop
  assert.equal(reads, 1)
  assert.match(written[0], /reading/)
  assert.doesNotMatch(written.at(-1), /reading/)
})
