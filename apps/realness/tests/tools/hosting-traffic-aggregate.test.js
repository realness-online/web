import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  aggregate_entries,
  aggregate_window,
  bucket_windows,
  visitor_key
} from '../../tools/ops/hosting-traffic.js'

const request = (extra = {}) => ({
  requestMethod: 'GET',
  status: 200,
  requestUrl: 'https://realness.online/',
  remoteIp: '1.2.3.4',
  userAgent: 'Mozilla/5.0',
  ...extra
})

const hit = (httpRequest, timestamp = '2026-10-01T00:00:00.000Z') => ({
  timestamp,
  httpRequest,
  insertId: `${httpRequest.remoteIp}-${timestamp}-${httpRequest.requestUrl}`
})

const BOT_UA = 'Googlebot/2.1 (+http://www.google.com/bot.html)'

test('aggregate_entries counts scans, matches, and bots apart', () => {
  const entries = [
    hit(request()),
    hit(request({ requestUrl: 'https://realness.online/about' })),
    hit(request({ userAgent: BOT_UA })),
    hit(request({ requestUrl: 'https://realness.online/assets/app.js' })),
    hit(request({ requestMethod: 'POST' })),
    hit(request({ status: 404 })),
    hit(request({ requestUrl: 'https://other.test/' }))
  ]
  const report = aggregate_entries(entries, { host: 'realness.online', include_bots: false, all_paths: false })
  assert.equal(report.scanned, 7)
  assert.equal(report.matched, 3, 'only the three marketing page views')
  assert.equal(report.bots, 1)
})

test('aggregate_entries ranks paths by hits, then by name', () => {
  const entries = [
    hit(request({ requestUrl: 'https://realness.online/' })),
    hit(request({ requestUrl: 'https://realness.online/about' })),
    hit(request({ requestUrl: 'https://realness.online/about', remoteIp: '9.9.9.9' })),
    hit(request({ requestUrl: 'https://realness.online/pricing' }))
  ]
  const report = aggregate_entries(entries, { host: 'realness.online', include_bots: false, all_paths: false })
  assert.deepEqual(report.paths.map(row => [row.path, row.hits]), [
    ['/about', 2],
    ['/', 1],
    ['/pricing', 1]
  ])
  assert.equal(report.paths[0].humans, 2)
  assert.equal(report.paths[0].approx_visitors, 2)
})

test('aggregate_entries counts one visitor once however many pages they read', () => {
  const entries = [
    hit(request()),
    hit(request({ requestUrl: 'https://realness.online/about' })),
    hit(request({ requestUrl: 'https://realness.online/pricing', timestamp: '2026-10-01T01:00:00.000Z' }))
  ]
  const report = aggregate_entries(entries, { host: 'realness.online', include_bots: false, all_paths: false })
  assert.equal(report.approx_visitors, 1)
  assert.equal(report.paths.find(row => row.path === '/').approx_visitors, 1)
})

test('aggregate_entries separates bots per path and counts them when asked', () => {
  const entries = [hit(request()), hit(request({ userAgent: BOT_UA }))]
  const quiet = aggregate_entries(entries, { host: 'realness.online', include_bots: false, all_paths: false })
  assert.equal(quiet.paths[0].humans, 1)
  assert.equal(quiet.paths[0].bots, 1)
  assert.equal(quiet.paths[0].approx_visitors, 1, 'a bot is not a visitor')

  const loud = aggregate_entries(entries, { host: 'realness.online', include_bots: true, all_paths: false })
  assert.equal(loud.paths[0].approx_visitors, 2, 'two addresses, so two visitors')
})

test('aggregate_entries ranks referers and names direct arrivals', () => {
  const entries = [
    hit(request({ referer: 'https://news.ycombinator.com/item?id=1' })),
    hit(request({ referer: 'https://news.ycombinator.com/item?id=2', remoteIp: '5.5.5.5' })),
    hit(request({ referer: 'https://example.com/x', remoteIp: '6.6.6.6' })),
    hit(request({ remoteIp: '7.7.7.7' }))
  ]
  const report = aggregate_entries(entries, { host: 'realness.online', include_bots: false, all_paths: false })
  assert.deepEqual(report.top_referers, [
    { host: 'news.ycombinator.com', count: 2 },
    { host: '(none)', count: 1 },
    { host: 'example.com', count: 1 }
  ])
})

test('aggregate_entries answers an empty report for no entries', () => {
  const report = aggregate_entries([], { host: 'realness.online', include_bots: false, all_paths: false })
  assert.deepEqual(report, {
    scanned: 0,
    matched: 0,
    bots: 0,
    paths: [],
    top_referers: [],
    approx_visitors: 0
  })
})

test('aggregate_window counts landings, deeper visits, and where people came from', () => {
  const entries = [
    hit(request({ referer: 'https://news.ycombinator.com/item?id=1' }), '2026-10-01T00:00:00.000Z'),
    hit(request({ requestUrl: 'https://realness.online/about', remoteIp: '1.2.3.4' }), '2026-10-01T00:00:01.000Z'),
    hit(request({ referer: 'https://example.com/x', remoteIp: '5.5.5.5' }), '2026-10-01T00:00:02.000Z'),
    hit(request({ remoteIp: '6.6.6.6' }), '2026-10-01T00:00:03.000Z')
  ]
  const window = aggregate_window(entries, { host: 'realness.online', include_bots: false, all_paths: false })
  assert.equal(window.landed, 3, 'three addresses reached the homepage')
  assert.equal(window.deeper, 1, 'one of them went past it')
  assert.equal(window.outside, 2, 'two arrived from another site')
  assert.equal(window.direct, 1)
  assert.equal(window.internal, 0)
  assert.deepEqual(window.sources, [
    { host: 'example.com', count: 1 },
    { host: 'news.ycombinator.com', count: 1 }
  ])
})

test('aggregate_window holds a burst address out of the reading and says so', () => {
  const entries = Array.from({ length: 30 }, (_, index) =>
    hit(request({ remoteIp: '10.0.0.1' }), new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString())
  )
  const window = aggregate_window(entries, { host: 'realness.online', include_bots: false, all_paths: false })
  assert.equal(window.burst_hits, 30)
  assert.deepEqual(window.burst_ips, ['10.0.0.1'])
  assert.equal(window.landed, 0, 'a burst address is not a visitor')
  assert.equal(window.outside, 0)
})

test('aggregate_window counts bots separately and can include them', () => {
  const entries = [hit(request()), hit(request({ userAgent: BOT_UA }))]
  const quiet = aggregate_window(entries, { host: 'realness.online', include_bots: false, all_paths: false })
  assert.equal(quiet.bots, 1)
  assert.equal(quiet.landed, 1)
  const loud = aggregate_window(entries, { host: 'realness.online', include_bots: true, all_paths: false })
  assert.equal(loud.landed, 2)
})

test('aggregate_window reads only the arrivals it can place', () => {
  const entries = [
    hit(request({ requestUrl: 'https://realness.online/assets/app.js' })),
    hit(request({ requestMethod: 'POST' })),
    hit(request({ requestUrl: 'https://other.test/' }))
  ]
  const window = aggregate_window(entries, { host: 'realness.online', include_bots: false, all_paths: false })
  assert.equal(window.landed, 0)
  assert.equal(window.outside, 0)
})

test('aggregate_window keeps the first referer it sees for a visitor', () => {
  const entries = [
    hit(request({ referer: 'https://news.ycombinator.com/item?id=1' }), '2026-10-01T00:00:01.000Z'),
    hit(request({ referer: 'https://example.com/x', requestUrl: 'https://realness.online/about' }), '2026-10-01T00:00:02.000Z')
  ]
  const window = aggregate_window(entries, { host: 'realness.online', include_bots: false, all_paths: false })
  assert.equal(window.outside, 1)
  assert.deepEqual(window.sources, [{ host: 'news.ycombinator.com', count: 1 }])
})

test('bucket_windows gives consecutive periods, oldest first', () => {
  const now = Date.parse('2026-10-08T00:00:00.000Z')
  const windows = bucket_windows(now, 7, 2)
  assert.equal(windows.length, 2)
  assert.equal(windows[0].start, '2026-09-24T00:00:00.000Z')
  assert.equal(windows[1].end, '2026-10-08T00:00:00.000Z')
  assert.equal(windows[0].end, windows[1].start, 'windows meet with no gap')
})

test('bucket_windows accepts a string or a number as the end', () => {
  const from_string = bucket_windows('2026-10-08T00:00:00.000Z', 1, 1)
  const from_number = bucket_windows(Date.parse('2026-10-08T00:00:00.000Z'), 1, 1)
  assert.deepEqual(from_string, from_number)
})

test('the visitor key is the same for two hits from one address and agent', () => {
  assert.equal(visitor_key(request()), visitor_key(request({ requestUrl: 'https://realness.online/about' })))
})