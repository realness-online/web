import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  aggregate_by_day,
  aggregate_trend,
  burst_ips,
  by_day_paths,
  cache_bounds,
  classify_referer,
  compact_entry,
  each_utc_day,
  entry_id,
  entry_timestamp,
  escape_re2_host,
  format_age,
  format_by_day,
  format_delta,
  format_insight,
  format_series,
  http_request_from_entry,
  is_bot_ua,
  is_document_hit,
  marketing_paths,
  parse_args,
  path_from_url,
  referer_host,
  stream_color,
  utc_day,
  visitor_key
} from '../../tools/ops/hosting-traffic.js'

const request = (extra = {}) => ({
  requestMethod: 'GET',
  status: 200,
  requestUrl: 'https://realness.online/about',
  remoteIp: '1.2.3.4',
  userAgent: 'Mozilla/5.0',
  ...extra
})

test('format_age names seconds, minutes, hours, and days', () => {
  assert.equal(format_age(5_000), '5s')
  assert.equal(format_age(89_000), '89s')
  assert.equal(format_age(90_000), '2m')
  assert.equal(format_age(120_000), '2m')
  assert.equal(format_age(3_600_000), '60m')
  assert.equal(format_age(3 * 3_600_000), '3h')
  assert.equal(format_age(4 * 24 * 3_600_000), '4d')
})

test('stream_color needs a tty and no NO_COLOR', () => {
  const before = process.env.NO_COLOR
  delete process.env.NO_COLOR
  assert.equal(stream_color({ isTTY: true }), true)
  assert.equal(stream_color({ isTTY: false }), false)
  process.env.NO_COLOR = '1'
  assert.equal(stream_color({ isTTY: true }), false)
  if (before === undefined) delete process.env.NO_COLOR
  else process.env.NO_COLOR = before
})

test('parse_args reads every flag and its defaults', () => {
  assert.deepEqual(parse_args([]), {
    days: 7,
    buckets: 4,
    project: null,
    host: 'realness.online',
    include_bots: false,
    all_paths: false,
    sample: null,
    cache: null,
    cache_only: false,
    refresh: false,
    by_day: false,
    pages: false
  })
  const parsed = parse_args([
    '--days', '30',
    '--buckets', '6',
    '--project', 'p',
    '--host', 'h.test',
    '--cache', '/tmp/x.jsonl',
    '--include-bots',
    '--all-paths',
    '--by-day',
    '--pages',
    '--sample'
  ])
  assert.equal(parsed.days, 30)
  assert.equal(parsed.buckets, 6)
  assert.equal(parsed.project, 'p')
  assert.equal(parsed.host, 'h.test')
  assert.equal(parsed.cache, '/tmp/x.jsonl')
  assert.equal(parsed.include_bots, true)
  assert.equal(parsed.all_paths, true)
  assert.equal(parsed.by_day, true)
  assert.equal(parsed.pages, true)
  assert.equal(parsed.sample, 5)
  assert.equal(parse_args(['--sample', '10']).sample, 10)
  assert.equal(parse_args(['--sample', '--pages']).sample, 5)
  assert.equal(parse_args(['--refresh']).refresh, true)
  assert.equal(parse_args(['--cache-only']).cache_only, true)
})

test('parse_args refuses bad numbers, unknown flags, and a contradictory pair', () => {
  assert.throws(() => parse_args(['--days', '0']), /--days must be a positive number/)
  assert.throws(() => parse_args(['--days', 'later']), /--days must be a positive number/)
  assert.throws(() => parse_args(['--buckets', '0']), /--buckets must be at least 1/)
  assert.throws(() => parse_args(['--sample', '-1']), /--sample must be a non-negative number/)
  assert.throws(() => parse_args(['--nonsense']), /Unknown argument: --nonsense/)
  assert.throws(() => parse_args(['--cache-only', '--refresh']), /not both/)
})

test('path_from_url normalises a real url and a bare path', () => {
  assert.equal(path_from_url('https://realness.online/'), '/')
  assert.equal(path_from_url('https://realness.online/about/'), '/about')
  assert.equal(path_from_url('https://realness.online/about?x=1#top'), '/about')
  assert.equal(path_from_url('/about/'), '/about')
  assert.equal(path_from_url('/about?x=1'), '/about')
  assert.equal(path_from_url('not a url'), '')
  assert.equal(path_from_url(''), '')
  assert.equal(path_from_url(null), '')
  assert.equal(path_from_url(42), '')
})

test('is_bot_ua reads a real user agent string only', () => {
  assert.equal(is_bot_ua('Googlebot/2.1 (+http://www.google.com/bot.html)'), true)
  assert.equal(is_bot_ua('Mozilla/5.0 (Macintosh)'), false)
  assert.equal(is_bot_ua(undefined), false)
  assert.equal(is_bot_ua(null), false)
})

test('is_document_hit keeps only public marketing page views', () => {
  const options = { host: 'realness.online', all_paths: false }
  assert.equal(is_document_hit(request(), options), true)
  assert.equal(is_document_hit(request({ requestUrl: 'https://realness.online/' }), options), true)
  assert.equal(is_document_hit(request({ requestUrl: 'https://realness.online/nope' }), options), false)
  assert.equal(is_document_hit(request({ requestMethod: 'POST' }), options), false)
  assert.equal(is_document_hit(request({ status: 404 }), options), false)
  assert.equal(is_document_hit(request({ status: 204 }), options), true)
  assert.equal(is_document_hit(request({ requestUrl: 'https://other.test/about' }), options), false)
  assert.equal(is_document_hit(null, options), false)
  assert.equal(is_document_hit('nope', options), false)

  const all = { host: 'realness.online', all_paths: true }
  assert.equal(is_document_hit(request({ requestUrl: 'https://realness.online/anything' }), all), true)
  assert.equal(is_document_hit(request({ requestUrl: 'https://realness.online/assets/app.js' }), all), false)
  assert.equal(is_document_hit(request({ requestUrl: 'https://realness.online/media/a.png' }), all), false)
  assert.equal(is_document_hit(request({ requestUrl: 'https://realness.online/' }), { host: '', all_paths: false }), true)
})

test('http_request_from_entry reads every shape an entry uses', () => {
  assert.deepEqual(http_request_from_entry({ httpRequest: { a: 1 } }), { a: 1 })
  assert.deepEqual(http_request_from_entry({ http_request: { a: 2 } }), { a: 2 })
  assert.deepEqual(http_request_from_entry({ protoPayload: { httpRequest: { a: 3 } } }), { a: 3 })
  assert.equal(http_request_from_entry({ protoPayload: 'text' }), null)
  assert.equal(http_request_from_entry({}), null)
  assert.equal(http_request_from_entry(null), null)
})

test('referer_host names a host, and says when there is none', () => {
  assert.equal(referer_host('https://news.ycombinator.com/item?id=1'), 'news.ycombinator.com')
  assert.equal(referer_host('https://example.com:8443/x'), 'example.com:8443')
  assert.equal(referer_host(''), '(none)')
  assert.equal(referer_host('   '), '(none)')
  assert.equal(referer_host('not a url'), '(none)')
  assert.equal(referer_host(null), '(none)')
})

test('visitor_key is stable per ip and user agent, and short', () => {
  const key = visitor_key(request())
  assert.equal(key, visitor_key(request()))
  assert.equal(key.length, 12)
  assert.notEqual(key, visitor_key(request({ remoteIp: '5.6.7.8' })))
  assert.notEqual(key, visitor_key(request({ userAgent: 'curl/8' })))
})

test('entry_timestamp reads a string and a seconds object', () => {
  const iso = '2026-10-01T00:00:00.000Z'
  assert.equal(entry_timestamp({ timestamp: iso }), iso)
  assert.equal(entry_timestamp({ timestamp: { seconds: 1_700_000_000 } }), new Date(1_700_000_000_000).toISOString())
  assert.equal(entry_timestamp({ timestamp: { seconds: '1700000000' } }), new Date(1_700_000_000_000).toISOString())
  assert.equal(entry_timestamp({ timestamp: { seconds: 'later' } }), null)
  assert.equal(entry_timestamp({ timestamp: 42 }), null)
  assert.equal(entry_timestamp({}), null)
  assert.equal(entry_timestamp(null), null)
})

test('entry_id prefers insertId and is otherwise stable for one request', () => {
  assert.equal(entry_id({ insertId: 'abc' }), 'abc')
  const entry = { timestamp: '2026-10-01T00:00:00.000Z', httpRequest: request() }
  assert.equal(entry_id(entry), entry_id({ ...entry }))
  assert.equal(entry_id(entry).length, 24)
  assert.notEqual(entry_id(entry), entry_id({ ...entry, httpRequest: request({ remoteIp: '9.9.9.9' }) }))
  assert.equal(entry_id(null), '')
  assert.equal(entry_id('nope'), '')
})

test('compact_entry keeps the id, time, and request only', () => {
  const entry = { insertId: 'keep', timestamp: '2026-10-01T00:00:00.000Z', httpRequest: request(), extra: 'dropped' }
  assert.deepEqual(compact_entry(entry), {
    insertId: 'keep',
    timestamp: '2026-10-01T00:00:00.000Z',
    httpRequest: request()
  })
  const no_id = compact_entry({ timestamp: '2026-10-01T00:00:00.000Z', httpRequest: request() })
  assert.equal(no_id.insertId.length, 24)
})

test('cache_bounds names the first and last entry times', () => {
  const rows = [
    { timestamp: '2026-10-01T00:00:00.000Z' },
    { timestamp: '2026-10-03T00:00:00.000Z' }
  ]
  assert.deepEqual(cache_bounds(rows), { oldest: '2026-10-01T00:00:00.000Z', newest: '2026-10-03T00:00:00.000Z' })
  assert.deepEqual(cache_bounds([]), { oldest: null, newest: null })
  assert.deepEqual(cache_bounds([{ timestamp: '' }, { timestamp: 7 }]), { oldest: null, newest: null })
})

test('burst_ips flags only an address with both enough hits and enough share', () => {
  const flagged = burst_ips([['1.1.1.1', 40], ['2.2.2.2', 60], ['3.3.3.3', 5]], 105)
  assert.ok(flagged.has('1.1.1.1'))
  assert.ok(flagged.has('2.2.2.2'))
  assert.ok(!flagged.has('3.3.3.3'), 'too few hits')
  assert.equal(burst_ips([['1.1.1.1', 25]], 1000).size, 0, 'enough hits but a tiny share')
  assert.equal(burst_ips([['1.1.1.1', 25]], 0).size, 0)
})

test('utc_day, each_utc_day, and aggregate_by_day walk real days', () => {
  assert.equal(utc_day('2026-10-01T23:59:59.000Z'), '2026-10-01')
  const days = [...each_utc_day('2026-10-01T00:00:00.000Z', '2026-10-03T00:00:00.000Z')]
  assert.deepEqual(days, ['2026-10-01', '2026-10-02', '2026-10-03'])
  assert.deepEqual([...each_utc_day('2026-10-03T00:00:00.000Z', '2026-10-01T00:00:00.000Z')], [])

  const entries = [
    { timestamp: '2026-10-01T01:00:00.000Z', httpRequest: request({ requestUrl: 'https://realness.online/' }), insertId: 'a' },
    { timestamp: '2026-10-01T02:00:00.000Z', httpRequest: request({ requestUrl: 'https://realness.online/about' }), insertId: 'b' },
    { timestamp: '2026-10-02T01:00:00.000Z', httpRequest: request({ requestUrl: 'https://realness.online/pricing' }), insertId: 'c' }
  ]
  const rows = aggregate_by_day(entries, { host: 'realness.online', since: '2026-10-01T00:00:00.000Z' })
  // The day list runs from `since` to today, so it holds today as well.
  assert.equal(rows[0].day, '2026-10-01')
  assert.ok(rows.length >= 2, `walked ${rows.length} days`)
  const first = rows[0].paths
  assert.equal(first['/'].humans, 1)
  assert.equal(first['/about'].humans, 1)
  assert.equal(first['/pricing'].humans, 0)
  assert.equal(first['/'].approx_visitors, 1)
})

test('aggregate_by_day counts a bot separately from a person', () => {
  const entries = [
    { timestamp: '2026-10-01T01:00:00.000Z', httpRequest: request({ userAgent: 'Googlebot/2.1 (+http://www.google.com/bot.html)' }), insertId: 'bot' },
    { timestamp: '2026-10-01T02:00:00.000Z', httpRequest: request(), insertId: 'person' }
  ]
  const without = aggregate_by_day(entries, { host: 'realness.online', since: '2026-10-01T00:00:00.000Z' })
  assert.equal(without[0].paths['/about'].humans, 1, 'the bot is left out by default')
  const with_bots = aggregate_by_day(entries, { host: 'realness.online', since: '2026-10-01T00:00:00.000Z', include_bots: true })
  assert.equal(with_bots[0].paths['/about'].humans, 2, 'the bot counts when asked for')
})

test('format_series and format_delta describe a change plainly', () => {
  assert.equal(typeof format_series([1, 2, 3]), 'string')
  assert.match(format_series([1, 2, 3]), /1.*2.*3/)
  assert.match(format_delta(120, 100), /\+20%|\+20/)
  assert.match(format_delta(80, 100), /-20%|-20/)
  assert.match(format_delta(100, 0), /new|\+|—|n\/a/i)
})

test('format_insight says when a period has no visitor data yet', () => {
  const empty = format_insight(
    [{ covered: false, landed: 0, deeper: 0, outside: 0 }],
    { days: 7, color: false }
  )
  assert.match(empty, /no visitor data/)

  const entries = Array.from({ length: 12 }, (_, index) => ({
    timestamp: new Date(Date.now() - index * 60_000).toISOString(),
    httpRequest: request({ requestUrl: 'https://realness.online/', remoteIp: `10.0.0.${index}` }),
    insertId: `hit-${index}`
  }))
  const trend = aggregate_trend(entries, {
    host: 'realness.online',
    include_bots: false,
    all_paths: false,
    days: 1,
    buckets: 1
  })
  const covered = format_insight(trend, { days: 1, color: false })
  assert.doesNotMatch(covered, /no visitor data/)
  // The unit is a distinct visitor, so many addresses read as many people.
  assert.match(covered, /1[12] people visited the homepage/)
})

test('classify_referer separates direct, internal, and external', () => {
  assert.equal(classify_referer('', 'realness.online'), 'direct')
  assert.equal(classify_referer('https://www.realness.online/about', 'realness.online'), 'internal')
  assert.equal(classify_referer('https://google.com/search?q=x', 'realness.online'), 'external')
})

test('format_by_day names the tracked paths and their two columns', () => {
  const rows = [
    {
      day: '2026-10-01',
      paths: {
        '/': { humans: 1, approx_visitors: 1 },
        '/about': { humans: 2, approx_visitors: 2 },
        '/pricing': { humans: 0, approx_visitors: 0 }
      }
    }
  ]
  const text = format_by_day(rows, by_day_paths, { color: false })
  assert.match(text, /By day/)
  assert.match(text, /home/)
  assert.match(text, /about/)
  assert.match(text, /2026-10-01/)
  assert.match(text, /1/)
})

test('escape_re2_host escapes the characters RE2 treats specially', () => {
  assert.equal(escape_re2_host('realness.online'), 'realness\\.online')
  assert.equal(escape_re2_host('a+b(c)'), 'a\\+b\\(c\\)')
})

test('the marketing path set holds the public pages and not the app', () => {
  assert.ok(marketing_paths.has('/'))
  assert.ok(marketing_paths.has('/about'))
  assert.ok(!marketing_paths.has('/admin'))
})