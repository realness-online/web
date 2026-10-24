/**
 * The ads side of the ops report: argument parsing, the two Ads API calls,
 * the daily rollup, and the combined table.
 *
 * Only `main` is left out; it reads the live API key, the traffic archive, and
 * the terminal.
 */
import { it } from 'node:test'
import assert from 'node:assert/strict'
import {
  aggregate_topic_hits_by_day,
  fetch_ad_account_timezone,
  fetch_ads_daily_metrics,
  format_combined_report,
  parse_args
} from '../../tools/ops/ads-metrics.js'

const hour = iso => Math.floor(Date.parse(iso) / 1000)

const json = value => new Response(JSON.stringify(value), { status: 200 })

const text = (body, status = 200, statusText = '') =>
  new Response(body, { status, statusText })

const routed_fetch = (t, handler) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    calls.push({ url: String(url), init })
    return handler(String(url), init)
  })
  return calls
}

it('parse_args starts from the weekly defaults', () => {
  assert.deepEqual(parse_args([]), {
    days: 7,
    project: null,
    host: parse_args([]).host,
    topic_param: 'topic',
    cache_only: false,
    refresh: false
  })
})

it('parse_args reads every flag', () => {
  assert.deepEqual(
    parse_args([
      '--days',
      '30',
      '--project',
      'p1',
      '--host',
      'realness.online',
      '--topic-param',
      'utm_source',
      '--cache-only'
    ]),
    {
      days: 30,
      project: 'p1',
      host: 'realness.online',
      topic_param: 'utm_source',
      cache_only: true,
      refresh: false
    }
  )
  assert.equal(parse_args(['--refresh']).refresh, true)
})

it('parse_args refuses what it cannot honour', () => {
  assert.throws(() => parse_args(['--nope']), /Unknown argument: --nope/)
  assert.throws(
    () => parse_args(['--days', '0']),
    /--days must be a positive number/
  )
  assert.throws(
    () => parse_args(['--days', 'soon']),
    /--days must be a positive number/
  )
  assert.throws(
    () => parse_args(['--cache-only', '--refresh']),
    /Use either --cache-only or --refresh, not both/
  )
})

it('--help prints the usage and exits 0', t => {
  const printed = []
  t.mock.method(console, 'info', text => {
    printed.push(String(text))
  })
  t.mock.method(process, 'exit', code => {
    throw new Error(`exit ${code}`)
  })
  assert.throws(() => parse_args(['--help']), /exit 0/)
  assert.match(printed.join('\n'), /OpenAI Ads daily metrics/)
})

it('the account timezone comes from the API and falls back to UTC', async t => {
  const calls = routed_fetch(t, () => json({ timezone: 'America/Los_Angeles' }))
  assert.equal(await fetch_ad_account_timezone('key'), 'America/Los_Angeles')
  assert.equal(calls[0].init.headers.Authorization, 'Bearer key')

  routed_fetch(t, () => json({}))
  assert.equal(await fetch_ad_account_timezone('key'), 'UTC')
})

it('a refused account call names the status and the body', async t => {
  routed_fetch(t, () => text('unauthorized', 401))
  await assert.rejects(
    fetch_ad_account_timezone('key'),
    /Ads API 401: unauthorized/
  )

  routed_fetch(t, () => text('', 500, 'Internal Server Error'))
  await assert.rejects(
    fetch_ad_account_timezone('key'),
    /Ads API 500: Internal Server Error/
  )
})

it('daily metrics sum hourly rows and derive the ratios', async t => {
  const calls = routed_fetch(t, () =>
    json({
      data: [
        {
          start_time: hour('2026-10-02T05:00:00Z'),
          impressions: 6,
          clicks: 1,
          spend: 0.5
        },
        {
          start_time: hour('2026-10-02T06:00:00Z'),
          impressions: 4,
          clicks: 1,
          spend: 1
        }
      ],
      has_more: false
    })
  )
  const by_date = await fetch_ads_daily_metrics({
    api_key: 'key',
    since: '2026-10-01',
    until: '2026-10-03'
  })
  assert.deepEqual(by_date.get('2026-10-02'), {
    impressions: 10,
    clicks: 2,
    spend: 1.5,
    ctr: 0.2,
    cpc: 0.75,
    cpm: 150
  })
  const query = new URL(calls[0].url).searchParams
  assert.equal(query.get('time_granularity'), 'hourly')
  assert.equal(query.get('aggregation_level'), 'ad_account')
  assert.deepEqual(query.getAll('fields[]'), [
    'ad_account.impressions',
    'ad_account.clicks',
    'ad_account.spend'
  ])
  assert.equal(query.get('limit'), '500')
  assert.equal(query.get('after'), null)
})

it('a page follows the last id, and field names may carry the account prefix', async t => {
  const pages = [
    json({
      data: [
        {
          start_time: hour('2026-10-02T05:00:00Z'),
          'ad_account.impressions': 3,
          ad_account_clicks: 0,
          spend: 0
        },
        { start_time: 'not a number', impressions: 99 },
        { impressions: 99 }
      ],
      has_more: true,
      last_id: 'page-2'
    }),
    json({
      data: [
        {
          start_time: hour('2026-10-03T05:00:00Z'),
          impressions: 1,
          clicks: 1,
          spend: 2
        }
      ],
      has_more: false
    })
  ]
  const calls = routed_fetch(t, () => pages.shift())
  const by_date = await fetch_ads_daily_metrics({
    api_key: 'key',
    since: '2026-10-01',
    until: '2026-10-04'
  })
  assert.equal(calls.length, 2)
  assert.equal(new URL(calls[1].url).searchParams.get('after'), 'page-2')
  assert.deepEqual(by_date.get('2026-10-02'), {
    impressions: 3,
    clicks: 0,
    spend: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0
  })
  assert.equal(by_date.get('2026-10-03').ctr, 1)
  assert.equal(by_date.get('2026-10-03').cpc, 2)
})

it('a refused insights call names the status', async t => {
  routed_fetch(t, () => text('quota', 429))
  await assert.rejects(
    fetch_ads_daily_metrics({ api_key: 'k', since: 'a', until: 'b' }),
    /Ads API 429: quota/
  )
})

const hit = (url, timestamp, userAgent = 'Mozilla/5.0 (Macintosh)') => ({
  timestamp,
  httpRequest: {
    requestMethod: 'GET',
    status: 200,
    requestUrl: url,
    userAgent
  }
})

it('topic hits count only human document hits that carry the parameter', () => {
  const since = '2026-10-01'
  const by_day = aggregate_topic_hits_by_day(
    [
      hit(
        'https://realness.online/pricing?topic=spring',
        '2026-10-02T10:00:00Z'
      ),
      hit(
        'https://realness.online/pricing?topic=spring',
        '2026-10-02T11:00:00Z'
      ),
      hit('https://realness.online/pricing', '2026-10-02T12:00:00Z'),
      hit(
        'https://realness.online/assets/logo.svg?topic=spring',
        '2026-10-02T13:00:00Z'
      ),
      hit(
        'https://realness.online/pricing?topic=spring',
        '2026-10-02T14:00:00Z',
        'Googlebot/2.1'
      ),
      hit(
        'https://elsewhere.example/pricing?topic=spring',
        '2026-10-02T15:00:00Z'
      ),
      { timestamp: '2026-10-02T16:00:00Z' }
    ],
    { host: 'realness.online', topic_param: 'topic', since }
  )
  assert.equal(by_day.get('2026-10-02'), 2)
  assert.equal(by_day.get(since), 0)
})

it('the combined report lines ads up with traffic and topic hits', () => {
  const traffic_rows = [
    {
      day: '2026-10-02',
      paths: { '/': { humans: 12 }, '/pricing': { humans: 3 } }
    }
  ]
  const report = format_combined_report(
    new Map([
      [
        '2026-10-02',
        {
          impressions: 1000,
          clicks: 25,
          spend: 12.5,
          ctr: 0.025,
          cpc: 0.5,
          cpm: 12.5
        }
      ]
    ]),
    traffic_rows,
    new Map([['2026-10-02', 7]]),
    'topic'
  )
  const [headers, rule, row] = report.split('\n')
  assert.match(
    headers,
    /Day\s+Impr\s+Clicks\s+Spend\s+CTR\s+CPC\s+CPM\s+home\s+about\s+pricing\s+topic=/
  )
  assert.match(rule, /^-+(  -+)+$/)
  assert.match(
    row,
    /2026-10-02\s+1000\s+25\s+12\.50\s+2\.50%\s+0\.50\s+12\.50\s+12\s+0\s+3\s+7/
  )
  assert.match(report, /home\/about\/pricing = human page hits, bots excluded/)
})

it('a day with no ads reports zeroes rather than dropping the row', () => {
  const report = format_combined_report(
    new Map(),
    [{ day: '2026-10-02', paths: {} }],
    new Map(),
    'topic'
  )
  assert.match(
    report.split('\n')[2],
    /2026-10-02\s+0\s+0\s+0\.00\s+0\.00%\s+0\.00\s+0\.00/
  )
})
