import assert from 'node:assert/strict'
import {
  existsSync as exists_sync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync
} from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  WebEngine,
  cache_time,
  check_url,
  engine_report,
  is_idle,
  is_private,
  learn,
  robots_allows,
  safe_fetch,
  shortfall
} from '../../src/host/web-engine.js'

const root = mkdtempSync(
  fileURLToPath(
    new URL('../../../../artifacts/brayness/web-engine-', import.meta.url)
  )
)
const article = (n = '') =>
  `<html><head><title>Article${n}</title></head><body><article><h1>Article</h1><p>${'Words that make a real article. '.repeat(30)}${n}</p></article></body></html>`
const hits = {}
let base
let server

before(async () => {
  server = createServer((req, res) => {
    hits[req.url] = (hits[req.url] ?? 0) + 1
    const html = (body, headers = {}) =>
      res.writeHead(200, { 'content-type': 'text/html', ...headers }).end(body)
    if (req.url === '/robots.txt')
      return res
        .writeHead(200, { 'content-type': 'text/plain' })
        .end('User-agent: *\nDisallow: /private-by-robots\n')
    if (
      req.url === '/page' ||
      req.url === '/' ||
      req.url === '/docs/x' ||
      req.url === '/steady' ||
      req.url.startsWith('/page?')
    )
      return html(article())
    if (req.url === '/changing') return html(article(` v${hits[req.url]}`))
    if (req.url === '/etag') {
      if (req.headers['if-none-match'] === '"v1"')
        return res.writeHead(304).end()
      return html(article(), { etag: '"v1"', 'cache-control': 'max-age=0' })
    }
    if (req.url === '/no-store')
      return html(article(), { 'cache-control': 'no-store' })
    if (req.url === '/private')
      return html(article(), { 'cache-control': 'max-age=600, private' })
    if (req.url === '/private-by-robots') return html(article())
    if (req.url === '/shell')
      return html('<html><body><div id="app"></div></body></html>')
    if (req.url === '/redirect-home')
      return res.writeHead(302, { location: 'http://127.0.0.1:1/' }).end()
    res.writeHead(404).end('not here')
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => {
  server.close()
  rmSync(root, { recursive: true, force: true })
})

const engine = (options = {}) =>
  new WebEngine({
    root: join(root, options.dir ?? 'cache'),
    allow_private: true,
    ...options
  })
const log_lines = (dir = 'cache') => {
  const log = join(root, dir, 'log')
  return readdirSync(log).flatMap(f =>
    readFileSync(join(log, f), 'utf8').trim().split('\n').map(JSON.parse)
  )
}

test('addresses: private, loopback, metadata, and shared ranges are refused', () => {
  for (const a of [
    '10.0.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.4.2',
    '172.19.1.2',
    '192.168.1.1',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1'
  ])
    assert.equal(is_private(a), true, a)
  for (const a of ['93.184.216.34', '1.1.1.1', '172.32.0.1', '2606:4700::1111'])
    assert.equal(is_private(a), false, a)
  assert.throws(() => check_url('file:///etc/passwd'), /only http/)
  assert.throws(() => check_url('http://user:pw@example.com/'), /credentials/)
})

test('safe_fetch refuses private addresses, by IP, by name, and by redirect', async () => {
  await assert.rejects(safe_fetch(`${base}/page`), /private address/)
  await assert.rejects(
    safe_fetch(`http://localhost:${server.address().port}/page`),
    /private address/
  )
  await assert.rejects(
    safe_fetch('http://169.254.169.254/latest/meta-data/'),
    /private address/
  )
  await assert.rejects(
    safe_fetch(`${base}/redirect-home`, { allow_private: false }),
    /private address/
  )
})

test('robots.txt: longest match for user-agent * wins', () => {
  const robots =
    'User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /search\nAllow: /search/about\n'
  assert.equal(robots_allows(robots, '/docs'), true)
  assert.equal(robots_allows(robots, '/search?q=x'), false)
  assert.equal(robots_allows(robots, '/search/about'), true)
  assert.equal(robots_allows('', '/anything'), true)
})

test('a shell page is thin; a bot wall is blocked', () => {
  assert.equal(
    shortfall('<html><body><div id="app"></div></body></html>'),
    'thin'
  )
  assert.equal(
    shortfall(
      `<html><head><title>Just a moment...</title></head><body>${'x '.repeat(200)}</body></html>`
    ),
    'blocked'
  )
  assert.equal(shortfall(article()), null)
})

test('the first reader fetches; the second reads the shared copy without fetching', async () => {
  const web = engine()
  const first = await web.read(`${base}/page`, { actor: 'a-1' })
  assert.deepEqual(
    [first.source, first.kind, first.title],
    ['static', 'html', 'Article']
  )
  const fetched = hits['/page']
  const second = await web.read(`${base}/page`, { actor: 'a-2' })
  assert.deepEqual([second.source, second.via], ['cache', 'static'])
  assert.equal(hits['/page'], fetched, 'no second fetch')
  const report = engine_report(log_lines())
  assert.deepEqual(
    [report.reads, report.hits, report.hit_rate, report.actors],
    [2, 1, 0.5, 2]
  )
})

test('an expired copy with an ETag is revalidated, not fetched again', async () => {
  const web = engine({ dir: 'etag' })
  await web.read(`${base}/etag`)
  const again = await web.read(`${base}/etag`)
  assert.equal(again.source, 'cache')
  assert.equal(log_lines('etag').at(-1).attempts[0].outcome, 'not-modified')
})

test('no-store pages and robots-disallowed pages are served but not shared', async () => {
  const web = engine({ dir: 'unshared' })
  for (const path of ['/no-store', '/private-by-robots']) {
    assert.equal((await web.read(`${base}${path}`)).source, 'static')
    assert.equal(
      (await web.read(`${base}${path}`)).source,
      'static',
      `${path} was not kept`
    )
  }
  assert.deepEqual(
    log_lines('unshared').map(l => l.shared),
    [false, false, false, false]
  )
})

test('a thin page goes to Chrome; a 404 stops before Chrome and Firecrawl', async () => {
  const rendered = []
  const render = async url => (
    rendered.push(url),
    { status: 200, html: article(' rendered') }
  )
  const web = engine({ dir: 'render', render, firecrawl_key: 'fc-test' })
  const page = await web.read(`${base}/shell`)
  assert.deepEqual([page.source, page.title], ['chrome', 'Article rendered'])
  await assert.rejects(web.read(`${base}/missing`), /static: HTTP 404$/)
  assert.deepEqual(
    rendered,
    [`${base}/shell`],
    'the 404 never reached Chrome or Firecrawl'
  )
})

test('idle pages without validators are pruned after 30 days unread', async () => {
  const expires = Date.parse('2026-11-10T00:00:00Z')
  assert.equal(
    is_idle({ headers: {}, fetched: '2026-10-01T00:00:00Z' }, { now: expires }),
    true
  )
  assert.equal(
    is_idle(
      {
        headers: {},
        fetched: '2026-10-01T00:00:00Z',
        read_at: '2026-11-01T00:00:00Z'
      },
      { now: expires }
    ),
    false
  )
  assert.equal(
    is_idle(
      { headers: { etag: '"a"' }, fetched: '2026-01-01T00:00:00Z' },
      { now: expires }
    ),
    false
  )

  let now = Date.parse('2026-10-08T00:00:00Z')
  const web = engine({ dir: 'prune', now: () => now })
  await web.read(`${base}/page`)
  await web.read(`${base}/etag`)
  now = Date.parse('2026-11-01T00:00:00Z')
  await web.read(`${base}/steady`)
  now = expires

  assert.equal(web.prune(), 1)
  assert.equal(exists_sync(web.page_file(`${base}/page`)), false)
  assert.equal(
    exists_sync(web.page_file(`${base}/etag`)),
    true,
    'validators keep an old page'
  )
  assert.equal(
    exists_sync(web.page_file(`${base}/steady`)),
    true,
    'recently read pages stay'
  )
  assert.equal(web.prune(), 0)
})

const times = JSON.parse(
  readFileSync(
    new URL('../../src/host/web-times.json', import.meta.url),
    'utf8'
  )
)
const HOUR = 3_600_000

test('r4 done-when: a busy page and a pinned doc get different times', () => {
  const busy = cache_time({ url: 'https://news.ycombinator.com/', times })
  const pinned = cache_time({
    url: 'https://github.com/earendil-works/pi/blob/v1.0.2/packages/coding-agent/docs/models.md',
    times
  })
  assert.deepEqual(busy, {
    hours: 0.25,
    why: 'front page or listing',
    stale_hours: 0
  })
  assert.deepEqual(pinned, {
    hours: 2160,
    why: 'pinned version',
    stale_hours: 2160
  })
  assert.deepEqual(
    cache_time({ url: 'https://developer.mozilla.org/en-US/docs/Web', times }),
    { hours: 168, why: 'reference docs', stale_hours: 168 }
  )
  assert.equal(
    cache_time({ url: 'https://www.google.com/search?q=x', times }).hours,
    0
  )
  assert.deepEqual(
    cache_time({
      url: 'https://news.ycombinator.com/',
      headers: { cache_control: 'max-age=7200, stale-while-revalidate=60' },
      times
    }),
    { hours: 2, why: 'max-age', stale_hours: 60 / 3600 }
  )
  assert.equal(
    cache_time({
      url: 'https://a.dev/x',
      headers: { cache_control: 'no-cache' },
      times
    }).why,
    'revalidate'
  )
  const github = 'https://github.com/earendil-works/pi/blob/v1.0.2/README.md'
  assert.equal(
    cache_time({
      url: github,
      headers: { cache_control: 'max-age=0, private, must-revalidate' },
      times
    }).hours,
    2160
  )
  assert.equal(
    cache_time({ url: github, headers: { cache_control: 'no-store' }, times })
      .hours,
    0
  )
  assert.deepEqual(
    cache_time({ url: 'https://a.dev/x', learned_hours: 96, times }),
    { hours: 96, why: 'learned', stale_hours: 24 }
  )
  assert.deepEqual(
    [learn(24, false), learn(24, true), learn(2000, false), learn(0.3, true)],
    [48, 12, 2160, 0.25]
  )
})

test('a busy front page is never served stale; a doc is, while one read refreshes it', async () => {
  let now = Date.parse('2026-10-08T00:00:00Z')
  const web = engine({ dir: 'stale', now: () => now })
  assert.equal((await web.read(`${base}/`)).source, 'static')
  assert.equal((await web.read(`${base}/docs/x`)).source, 'static')
  now += 20 * 60_000
  assert.equal(
    (await web.read(`${base}/`)).source,
    'static',
    'a busy page waits for a fresh read'
  )
  now += 169 * HOUR
  const fetched = hits['/docs/x']
  assert.equal((await web.read(`${base}/docs/x`)).source, 'stale')
  await web.refreshing.get(`${base}/docs/x`)
  assert.equal(hits['/docs/x'], fetched + 1, 'one background read refreshed it')
  assert.equal(
    (await web.read(`${base}/docs/x`)).source,
    'cache',
    'the next reader gets the refreshed copy'
  )
  const whys = log_lines('stale').map(l => l.why)
  assert.ok(
    whys.includes('front page or listing') && whys.includes('reference docs')
  )
})

test('re-reads teach a page its time: unchanged doubles, changed halves', async () => {
  let now = Date.parse('2026-10-08T00:00:00Z')
  const web = engine({ dir: 'learn', now: () => now })
  const kept = path =>
    JSON.parse(readFileSync(web.page_file(`${base}${path}`), 'utf8'))
  await web.read(`${base}/steady`)
  await web.read(`${base}/changing`)
  now += 49 * HOUR
  await web.read(`${base}/steady`)
  await web.read(`${base}/changing`)
  assert.equal(kept('/steady').learned_hours, 48)
  assert.equal(kept('/changing').learned_hours, 12)
  assert.deepEqual(
    log_lines('learn')
      .filter(l => l.changed != null)
      .map(l => l.changed),
    [false, true]
  )
})

test('an anonymous private page is shared; no-store is not', async () => {
  const web = engine({ dir: 'private' })
  await web.read(`${base}/private`)
  assert.equal((await web.read(`${base}/private`)).source, 'cache')
})

test('search results are served but never kept', async () => {
  const web = engine({ dir: 'search' })
  assert.equal((await web.read(`${base}/page?q=x`)).source, 'static')
  assert.equal((await web.read(`${base}/page?q=x`)).source, 'static')
  assert.deepEqual(
    log_lines('search').map(l => [l.shared, l.why]),
    [
      [false, 'search results'],
      [false, 'search results']
    ]
  )
})
