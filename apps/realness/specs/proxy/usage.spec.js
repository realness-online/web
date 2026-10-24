import assert from 'node:assert/strict'
import { after, it } from 'node:test'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { disk } from '#root/src/can/disk.js'
import {
  FREE_LIMITS,
  days_since,
  month_days,
  over_limit,
  read_rows,
  usage_key,
  usage_ledger,
  usage_meter,
  usage_row
} from '../../src/proxy/usage.js'
import { call_stats, usage_stats } from '../../src/proxy/report.js'
import { out_path } from '#root/lib/output.js'

const base = out_path(`usage-test-${randomUUID()}/`)
after(() => rm(base, { recursive: true, force: true }))
const bytes = text => new TextEncoder().encode(text)

it('meter finds usage in a stream split mid-line', () => {
  const meter = usage_meter()
  const stream =
    'data: {"choices":[{"delta":{"content":"secret reply"}}]}\n\ndata: {"model":"m/x","usage":{"prompt_tokens":7,"completion_tokens":3,"cost":0.002}}\n\ndata: [DONE]\n'
  for (let i = 0; i < stream.length; i += 13)
    meter.add(bytes(stream.slice(i, i + 13)))
  const { reply_bytes, usage } = meter.finish()
  assert.equal(reply_bytes, bytes(stream).length)
  assert.deepEqual(usage, {
    prompt_tokens: 7,
    completion_tokens: 3,
    cost: 0.002,
    model: 'm/x',
    cached_tokens: 0,
    cache_write_tokens: 0
  })
})

it('meter reads the provider and the cached tokens', () => {
  const meter = usage_meter()
  meter.add(
    bytes(
      'data: {"provider":"DeepInfra","model":"m/x"}\n\ndata: {"model":"m/x","usage":{"prompt_tokens":9,"completion_tokens":1,"prompt_tokens_details":{"cached_tokens":7}}}\n\n'
    )
  )
  const { usage, provider } = meter.finish()
  assert.deepEqual(
    [provider, usage.cached_tokens, usage.cache_write_tokens],
    ['DeepInfra', 7, 0]
  )
})

it('meter reads a plain JSON reply; no usage is null', () => {
  const plain = usage_meter()
  plain.add(
    bytes(
      '{"model":"m","usage":{"prompt_tokens":1,"completion_tokens":2,"cost":0}}'
    )
  )
  assert.equal(plain.finish().usage.completion_tokens, 2)
  const none = usage_meter()
  none.add(bytes('data: done\n'))
  assert.equal(none.finish().usage, null)
})

it('a row keeps sizes and cost, never text', () => {
  const html = usage_row({
    model: 'm',
    actor: 'a-abcdef123456',
    status: 200,
    request_bytes: 40,
    reply_bytes: 90,
    usage: { prompt_tokens: 7, completion_tokens: 3, cost: 0.002 }
  })
  assert.doesNotMatch(html, /secret|content"\s*>/)
  assert.deepEqual(read_rows(html), [
    {
      model: 'm',
      actor: 'a-abcdef123456',
      payer: '',
      via: 'actor',
      plan: 'free',
      status: 200,
      request_bytes: 40,
      reply_bytes: 90,
      prompt_tokens: 7,
      completion_tokens: 3,
      cached_tokens: 0,
      cache_write_tokens: 0,
      latency_ms: 0,
      cost: 0.002,
      client: '',
      provider: ''
    }
  ])
})

it('a row keeps the caller, provider, latency, and cached tokens', () => {
  const html = usage_row({
    model: 'm',
    actor: 'app-abcdef123456',
    status: 200,
    request_bytes: 1,
    reply_bytes: 2,
    client: 'pi/1.0 (darwin)',
    provider: 'DeepInfra',
    latency_ms: 412,
    usage: { prompt_tokens: 9, completion_tokens: 1, cached_tokens: 7 }
  })
  const [row] = read_rows(html)
  assert.deepEqual(
    [
      row.client,
      row.provider,
      row.latency_ms,
      row.cached_tokens,
      row.cache_write_tokens
    ],
    ['pi/1.0 (darwin)', 'DeepInfra', 412, 7, 0]
  )
})

it('rows written before the new fields read as zero and empty', () => {
  const old =
    '<p itemscope itemtype="/usage"><meta itemprop="model" content="m"><meta itemprop="actor" content="phone"><meta itemprop="status" content="200"><meta itemprop="cost" content="0.5"></p>\n'
  const [row] = read_rows(old)
  assert.deepEqual(
    [
      row.cached_tokens,
      row.cache_write_tokens,
      row.latency_ms,
      row.client,
      row.provider
    ],
    [0, 0, 0, undefined, undefined]
  )
})

it('stats count cache hits, errors, and the latency tail', () => {
  const rows = [
    {
      status: 200,
      cached_tokens: 0,
      prompt_tokens: 10,
      latency_ms: 100,
      cost: 1
    },
    {
      status: 200,
      cached_tokens: 5,
      prompt_tokens: 10,
      latency_ms: 200,
      cost: 2
    },
    {
      status: 429,
      cached_tokens: 0,
      prompt_tokens: 0,
      latency_ms: 900,
      cost: 0
    }
  ]
  assert.deepEqual(call_stats(rows), {
    calls: 3,
    errors: 1,
    error_rate: 0.3333,
    prompt_tokens: 20,
    completion_tokens: 0,
    cached_tokens: 5,
    cache_write_tokens: 0,
    cache_hits: 1,
    cache_hit_rate: 0.3333,
    cost: 3,
    latency_ms: 400,
    p50_ms: 200,
    p95_ms: 900
  })
  const groups = usage_stats(rows)
  assert.deepEqual(
    [
      groups.by_model.length,
      groups.by_provider[0].name,
      groups.by_client[0].name
    ],
    [1, 'unknown', 'unknown']
  )
})

it('a report spans people and days, and totals their rows', async () => {
  const store = disk(`${base}${randomUUID()}`)
  const ledger = usage_ledger(store)
  const row = (tokens, cached) => ({
    model: 'm',
    actor: 'a-abcdef123456',
    status: 200,
    request_bytes: 1,
    reply_bytes: 1,
    client: 'pi',
    provider: 'DeepInfra',
    latency_ms: 10,
    usage: {
      prompt_tokens: tokens,
      completion_tokens: 0,
      cached_tokens: cached,
      cost: 0
    }
  })
  await ledger.record(
    '+14155550123',
    row(10, 0),
    new Date('2026-10-01T12:00:00Z')
  )
  await ledger.record(
    '+14155550199',
    row(10, 5),
    new Date('2026-10-01T13:00:00Z')
  )
  const report = await ledger.report('2026-10-01')
  assert.deepEqual(
    [
      report.people,
      report.totals.calls,
      report.totals.cached_tokens,
      report.totals.cache_hits,
      report.by_provider[0].name
    ],
    [2, 2, 5, 1, 'DeepInfra']
  )
  assert.deepEqual(new Set(report.rows.map(row => row.payer)).size, 2)
  const series = await ledger.report_days(['2026-09-30', '2026-10-01'])
  assert.deepEqual(
    series.map(day => [day.day, day.totals.calls]),
    [
      ['2026-09-30', 0],
      ['2026-10-01', 2]
    ]
  )
})

it('attribute values are escaped', () => {
  assert.match(
    usage_row({
      model: '"><script>',
      actor: 'phone',
      status: 200,
      request_bytes: 0,
      reply_bytes: 0
    }),
    /content="&quot;>&lt;script>"/
  )
})

it("key sits under the person's day", () => {
  assert.match(
    usage_key('+14155550123', 'phone', new Date('2026-09-27T12:34:56.789Z')),
    /^usage\/\+14155550123\/2026-09-27\/123456789Z-phone-[a-f0-9]{6}\.html$/
  )
})

it('l1: racing calls append to one day file; the day sums them', async () => {
  const store = disk(base)
  const ledger = usage_ledger(store, { wait: 5 })
  const now = new Date('2026-09-27T12:00:00Z')
  const row = {
    model: 'm',
    actor: 'a-abcdef123456',
    status: 200,
    request_bytes: 1,
    reply_bytes: 1,
    usage: { cost: 0.25 }
  }
  await Promise.all(
    Array.from({ length: 20 }, () => ledger.record('+14155550123', row, now))
  )
  const day = await ledger.day('+14155550123', '2026-09-27')
  assert.equal(day.rows.length, 20)
  assert.equal(day.cost, 5)
  assert.equal(new Set(day.rows.map(row => row.call)).size, 20)
  assert.deepEqual((await store.list('usage/+14155550123/2026-09-27/')).files, [
    'index.html'
  ])
  assert.deepEqual((await ledger.day('+14155550123', '2026-09-26')).rows, [])
})

it('l1: a piece left beside the index counts once; old call files still count', async () => {
  const store = disk(`${base}${randomUUID()}`)
  const folder = 'usage/+14155550123/2026-09-27/'
  const row = (call, cost) =>
    usage_row({
      model: 'm',
      actor: 'phone',
      status: 200,
      request_bytes: 1,
      reply_bytes: 1,
      usage: { cost },
      call
    })
  await store.put(
    `${folder}index.html`,
    row('1-phone-aaaaaa.html', 1) + row('2-phone-bbbbbb.html', 2)
  )
  await store.put(`${folder}2-phone-bbbbbb.html`, row('2-phone-bbbbbb.html', 2))
  await store.put(`${folder}0-phone-cccccc.html`, row('', 4))
  assert.equal(
    (await usage_ledger(store).day('+14155550123', '2026-09-27')).cost,
    7
  )
})

it('l1: a piece deleted between list and read is still counted', async () => {
  const store = disk(`${base}${randomUUID()}`)
  const folder = 'usage/+14155550123/2026-09-27/'
  const row = usage_row({
    model: 'm',
    actor: 'phone',
    status: 200,
    request_bytes: 1,
    reply_bytes: 1,
    usage: { cost: 1 },
    call: '1-phone-aaaaaa.html'
  })
  await store.put(`${folder}1-phone-aaaaaa.html`, row)
  const list = store.list
  store.list = async (...a) => {
    const listed = await list(...a)
    await store.compose(
      `${folder}index.html`,
      [`${folder}1-phone-aaaaaa.html`],
      { if_absent: true }
    )
    await store.delete(`${folder}1-phone-aaaaaa.html`)
    return listed
  }
  assert.equal(
    (await usage_ledger(store).day('+14155550123', '2026-09-27')).cost,
    1
  )
})

it('spent reads once, then counts in memory', async () => {
  const store = disk(`${base}${randomUUID()}`)
  const now = new Date()
  const row = {
    model: 'm',
    actor: 'phone',
    status: 200,
    request_bytes: 1,
    reply_bytes: 1,
    usage: { prompt_tokens: 4, completion_tokens: 6, cost: 0.5 }
  }
  await usage_ledger(store).record('+14155550123', row, now)
  const ledger = usage_ledger(store, { wait: 5 })
  assert.deepEqual((await ledger.spent('+14155550123', now)).day, {
    tokens: 10,
    cost: 0.5
  })
  let lists = 0
  const list = store.list
  store.list = (...a) => (lists++, list(...a))
  await ledger.record('+14155550123', row, now)
  lists = 0
  assert.deepEqual((await ledger.spent('+14155550123', now)).day, {
    tokens: 20,
    cost: 1
  })
  assert.equal(lists, 0)
})

it('b1c: a recorded call counts before its storage write ends', async () => {
  const store = disk(`${base}${randomUUID()}`)
  const now = new Date()
  const ledger = usage_ledger(store)
  await ledger.spent('+14155550123', now)
  let release
  const put = store.put
  store.put = (...a) => new Promise(done => (release = () => done(put(...a))))
  const row = {
    model: 'm',
    actor: 'phone',
    status: 200,
    request_bytes: 1,
    reply_bytes: 1,
    usage: { prompt_tokens: 4, completion_tokens: 6, cost: 0 }
  }
  const recording = ledger.record('+14155550123', row, now)
  assert.equal((await ledger.spent('+14155550123', now)).day.tokens, 10)
  release()
  await recording
})

it('b1b: month days run from the 1st to today', () => {
  assert.deepEqual(month_days(new Date('2026-10-03T23:00:00Z')), [
    '2026-10-01',
    '2026-10-02',
    '2026-10-03'
  ])
  assert.equal(month_days(new Date('2026-12-31T00:00:00Z')).length, 31)
})

it('b1b: spent sums the month; the day is today only', async () => {
  const ledger = usage_ledger(disk(`${base}${randomUUID()}`))
  const row = tokens => ({
    model: 'm',
    actor: 'phone',
    status: 200,
    request_bytes: 1,
    reply_bytes: 1,
    usage: { prompt_tokens: tokens, completion_tokens: 0, cost: 0 }
  })
  await ledger.record(
    '+14155550123',
    row(100),
    new Date('2026-09-30T12:00:00Z')
  )
  await ledger.record('+14155550123', row(40), new Date('2026-10-01T12:00:00Z'))
  await ledger.record('+14155550123', row(2), new Date('2026-10-02T12:00:00Z'))
  const spent = await ledger.spent(
    '+14155550123',
    new Date('2026-10-02T13:00:00Z')
  )
  assert.equal(spent.day.tokens, 2)
  assert.equal(spent.month.tokens, 42)
  await ledger.record('+14155550123', row(5), new Date('2026-10-02T14:00:00Z'))
  assert.equal(
    (await ledger.spent('+14155550123', new Date('2026-10-02T15:00:00Z'))).month
      .tokens,
    47
  )
})

it('b1b: either limit refuses; month wins when both are spent', () => {
  const at = (day, month) => ({
    day: { tokens: day, cost: 0 },
    month: { tokens: month, cost: 0 }
  })
  assert.equal(over_limit(at(249_999, 2_999_999), FREE_LIMITS), null)
  assert.equal(over_limit(at(250_000, 250_000), FREE_LIMITS), 'day')
  assert.equal(over_limit(at(0, 3_000_000), FREE_LIMITS), 'month')
  assert.equal(over_limit(at(250_000, 3_000_000), FREE_LIMITS), 'month')
  assert.equal(
    over_limit(
      { day: { tokens: 0, cost: 1 }, month: { tokens: 0, cost: 1 } },
      { day: { cost: 1 } }
    ),
    'day'
  )
  assert.equal(over_limit(at(1e9, 1e9)), null)
})

it('b1a: each row names its payer and how the call came', () => {
  const A = '+14155550123'
  const row = actor =>
    read_rows(
      usage_row({
        model: 'm',
        actor,
        payer: A,
        status: 200,
        request_bytes: 1,
        reply_bytes: 1
      })
    )[0]
  assert.deepEqual(
    [row('a-abcdef123456').via, row('app-abcdef123456').via, row('phone').via],
    ['actor', 'app', 'phone']
  )
  assert.equal(row('app-abcdef123456').payer, A)
})

it("b1a: rows written before payer existed read with the folder's phone", () => {
  const old =
    '<p itemscope itemtype="/usage"><meta itemprop="model" content="m"><meta itemprop="actor" content="a-abcdef123456"><meta itemprop="status" content="200"><meta itemprop="request_bytes" content="1"><meta itemprop="reply_bytes" content="2"><meta itemprop="prompt_tokens" content="3"><meta itemprop="completion_tokens" content="4"><meta itemprop="cost" content="0.5"></p>\n'
  const [row] = read_rows(old, '+14155550123')
  assert.equal(row.payer, '+14155550123')
  assert.equal(row.via, 'actor')
  assert.equal(row.cost, 0.5)
  assert.equal(row.completion_tokens, 4)
})

it('b1d: paid rows spend credit, never free tokens; spent_since crosses months', async () => {
  const ledger = usage_ledger(disk(`${base}${randomUUID()}`))
  const row = (plan, tokens, cost) => ({
    model: 'm',
    actor: 'phone',
    plan,
    status: 200,
    request_bytes: 1,
    reply_bytes: 1,
    usage: { prompt_tokens: tokens, completion_tokens: 0, cost }
  })
  await ledger.record(
    '+14155550123',
    row('paid', 500, 0.25),
    new Date('2026-09-30T12:00:00Z')
  )
  await ledger.record(
    '+14155550123',
    row('free', 40, 0),
    new Date('2026-10-01T12:00:00Z')
  )
  await ledger.record(
    '+14155550123',
    row('paid', 60, 0.5),
    new Date('2026-10-01T13:00:00Z')
  )
  const now = new Date('2026-10-01T14:00:00Z')
  assert.deepEqual((await ledger.spent('+14155550123', now)).day, {
    tokens: 40,
    cost: 0.5
  })
  assert.deepEqual(
    await ledger.spent_since('+14155550123', '2026-09-30', now),
    { tokens: 40, cost: 0.75 }
  )
  await ledger.record(
    '+14155550123',
    row('paid', 10, 0.25),
    new Date('2026-10-01T15:00:00Z')
  )
  assert.equal(
    (
      await ledger.spent_since(
        '+14155550123',
        '2026-09-30',
        new Date('2026-10-01T16:00:00Z')
      )
    ).cost,
    1
  )
  assert.deepEqual(days_since('2026-12-30', new Date('2027-01-02T00:00:00Z')), [
    '2026-12-30',
    '2026-12-31',
    '2027-01-01',
    '2027-01-02'
  ])
})

it('free models never spend free tokens, read back or counted live', async () => {
  const ledger = usage_ledger(disk(`${base}${randomUUID()}`))
  const row = (model, tokens) => ({
    model,
    actor: 'phone',
    plan: 'free',
    status: 200,
    request_bytes: 1,
    reply_bytes: 1,
    usage: { prompt_tokens: tokens, completion_tokens: 0, cost: 0 }
  })
  const now = new Date('2026-10-02T12:00:00Z')
  await ledger.record(
    '+14155550123',
    row('thinkingmachines/inkling:free', 900),
    now
  )
  await ledger.record('+14155550123', row('priced/model', 30), now)
  assert.equal((await ledger.spent('+14155550123', now)).day.tokens, 30)
  await ledger.record(
    '+14155550123',
    row('thinkingmachines/inkling:free', 900),
    now
  )
  assert.equal((await ledger.spent('+14155550123', now)).day.tokens, 30)
})
