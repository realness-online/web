import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { cache_time, hash, is_current, is_idle, learn, prune, route } from './web-md-cache.js'
import { assess, read_day, reuse } from './web-md-log.js'

const HOUR = 3_600_000
const times = {
  default_hours: 24,
  rules: [
    { kind: 'search results', hours: 0, pattern: '[?&]q=' },
    { kind: 'reference docs', hours: 168, pattern: '/docs/' }
  ]
}

test('cache time: caller, then headers, then never-keep, learned, kind, default', () => {
  const at = (url, extra = {}) => cache_time({ url, times, ...extra })
  assert.deepEqual(at('https://a.dev/docs/x', { caller_hours: 2 }), { hours: 2, why: 'caller' })
  assert.equal(at('https://a.dev/docs/x', { headers: { cache_control: 'no-store' } }).hours, 0)
  assert.equal(at('https://a.dev/x', { headers: { cache_control: 'public, max-age=7200' } }).hours, 2)
  assert.equal(at('https://a.dev/docs/x', { headers: { cache_control: 'max-age=0' } }).why, 'reference docs')
  assert.equal(at('https://a.dev/s?q=x', { learned_hours: 50 }).hours, 0)
  assert.deepEqual(at('https://a.dev/docs/x', { learned_hours: 50 }), { hours: 50, why: 'learned' })
  assert.deepEqual(at('https://a.dev/docs/x'), { hours: 168, why: 'reference docs' })
  assert.deepEqual(at('https://a.dev/blog'), { hours: 24, why: 'default' })
})

test('learning doubles on unchanged, halves on changed, within bounds', () => {
  assert.equal(learn(24, false), 48)
  assert.equal(learn(24, true), 12)
  assert.equal(learn(2000, false), 2160)
  assert.equal(learn(0.3, true), 0.25)
})

test('route skips a method failing three times in a row, then retries after a week', () => {
  const now = Date.now()
  const site = at => ({ methods: { static: { fails_in_row: 3, last_at: new Date(at).toISOString() } } })
  assert.deepEqual(route(site(now - HOUR), now), ['browser', 'firecrawl'])
  assert.deepEqual(route(site(now - 8 * 24 * HOUR), now), ['static', 'browser', 'firecrawl'])
  assert.deepEqual(route({ methods: { static: { fails_in_row: 2, last_at: new Date(now).toISOString() } } }, now).length, 3)
})

test('a kept page is current by its validator first, then by age', () => {
  const now = Date.now()
  const entry = { page: { fetched: new Date(now - 48 * HOUR).toISOString() }, validators: { etag: '"a"' } }
  assert.equal(is_current({ entry, validators: { etag: '"a"' }, time: { hours: 1 }, now }), true)
  assert.equal(is_current({ entry, validators: { etag: '"b"' }, time: { hours: 999 }, now }), false)
  assert.equal(is_current({ entry, validators: {}, time: { hours: 72 }, now }), true)
  assert.equal(is_current({ entry, validators: {}, time: { hours: 24 }, now }), false)
  assert.equal(is_current({ entry, validators: {}, time: { hours: 0 }, now }), false)
})

const web_md = fileURLToPath(new URL('../web-md.js', import.meta.url))
const scratch = fileURLToPath(new URL(`../../artifacts/web-md-test-${process.pid}/`, import.meta.url))
const cache_root = join(scratch, 'cache')
const node_only = join(scratch, 'path')
const article = `<html><head><title>Article</title></head><body><article><h1>Article</h1><p>${'Words that make a real article. '.repeat(30)}</p><p><a href="/next">Next</a></p></article></body></html>`
let base
let server
const hits = {}

before(async () => {
  mkdirSync(node_only, { recursive: true })
  symlinkSync(process.execPath, join(node_only, 'node'))
  server = createServer((req, res) => {
    hits[req.url] = (hits[req.url] ?? 0) + 1
    if (req.url === '/etag') {
      if (req.headers['if-none-match'] === '"v1"') return res.writeHead(304).end()
      return res.writeHead(200, { etag: '"v1"', 'content-type': 'text/html' }).end(article)
    }
    if (req.url === '/short-lived') return res.writeHead(200, { 'cache-control': 'max-age=1', 'content-type': 'text/html' }).end(article)
    if (req.url === '/liar') {
      hits.liar_body = (hits.liar_body ?? 0) + 1
      const body = article.replace('<p>Words', `<p>Version ${hits.liar_body}. Words`)
      return res.writeHead(200, { etag: '"same"', 'content-type': 'text/html' }).end(body)
    }
    if (req.url === '/thin') return res.writeHead(200, { 'content-type': 'text/html' }).end('<html><body><div id="app"></div></body></html>')
    res.writeHead(404).end()
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => {
  server.close()
  rmSync(scratch, { recursive: true, force: true })
})

const run = (...args) =>
  new Promise(done =>
    execFile(
      'node',
      [web_md, ...args],
      { env: { PATH: `${node_only}:/usr/bin:/bin`, WEB_MD_CACHE: cache_root } },
      (error, stdout, stderr) => done({ code: error?.code ?? 0, stdout, stderr })
    )
  )
const log_lines = () => read_day(join(scratch, 'log'), new Date().toISOString().slice(0, 10))
const last_line = url => log_lines().filter(l => l.url === hash(url)).at(-1)
const site_record = () => JSON.parse(readFileSync(join(cache_root, 'sites', new URL(base).host + '.json'), 'utf8'))

test('a static page is kept, then served on 304 Not Modified', async () => {
  const first = await run(`${base}/etag`)
  assert.equal(first.code, 0)
  assert.match(first.stdout, /\| static \|/)
  assert.doesNotMatch(first.stdout, /\]\(/, 'links are text only by default')
  const second = await run(`${base}/etag`, '--links')
  assert.match(second.stdout, /cached static, not modified/)
  assert.match(second.stdout, /\[Next\]\(/, 'the kept page still has its links')
  const kept = JSON.parse(readFileSync(join(cache_root, 'pages', `${hash(`${base}/etag`)}.json`), 'utf8'))
  assert.deepEqual(kept.attempts.map(a => a.outcome), ['ok', 'ok'])
})

test('an expired page read again unchanged teaches its cache time', async () => {
  assert.equal((await run(`${base}/short-lived`)).code, 0)
  await new Promise(done => setTimeout(done, 1100))
  assert.equal((await run(`${base}/short-lived`)).code, 0)
  const kept = JSON.parse(readFileSync(join(cache_root, 'pages', `${hash(`${base}/short-lived`)}.json`), 'utf8'))
  assert.deepEqual(kept.checks.map(c => c.changed), [false])
  assert.equal(kept.learned_hours, 0.25, 'one second doubled, held at the fifteen-minute floor')
  const line = last_line(`${base}/short-lived`)
  assert.equal(line.kept.changed, false, 'the log records the reread found no change')
  assert.equal(line.kept.validators, false)
  assert.ok(line.kept.age_h > 0)
})

test('a 304 read logs the kept copy as served young', async () => {
  const line = last_line(`${base}/etag`)
  assert.equal(line.outcome, 'not-modified')
  assert.equal(line.kept.validators, true)
  assert.equal(assess([line])['default'].served.under_7d, 1)
  const kept = JSON.parse(readFileSync(join(cache_root, 'pages', `${hash(`${base}/etag`)}.json`), 'utf8'))
  assert.equal(kept.reuses, 1, 'the 304 read counts as one reuse')
  const used = reuse(log_lines().filter(l => l.url === hash(`${base}/etag`)))
  assert.deepEqual([used.pages, used.bands['1'], used.top[0].reused, used.top[0].reads], [1, 1, 1, 2])
})

test('an ETag that stays while the text changes is logged as lying', async () => {
  assert.equal((await run(`${base}/liar`, '--fresh')).code, 0)
  assert.equal((await run(`${base}/liar`, '--fresh')).code, 0)
  const line = last_line(`${base}/liar`)
  assert.equal(line.kept.matched, true)
  assert.equal(line.kept.changed, true)
  const g = Object.values(assess([line]))[0]
  assert.deepEqual([g.validated, g.lied], [1, 1])
})

test('idle pages without validators are pruned; validated ones stay', () => {
  const now = Date.now()
  const old = new Date(now - 31 * 24 * HOUR).toISOString()
  const page = { markdown: 'x', fetched: old }
  assert.equal(is_idle({ page }, { now }), true)
  assert.equal(is_idle({ page, read_at: new Date(now).toISOString() }, { now }), false, 'a recent read keeps it')
  assert.equal(is_idle({ page, validators: { etag: '"a"' } }, { now }), false, 'kept until it changes')
  const root = join(scratch, 'prune')
  mkdirSync(join(root, 'pages'), { recursive: true })
  writeFileSync(join(root, 'pages', 'a.json'), JSON.stringify({ url: 'a', attempts: [1], page }))
  writeFileSync(join(root, 'pages', 'b.json'), JSON.stringify({ url: 'b', attempts: [], page, validators: { etag: '"b"' } }))
  assert.equal(prune(root, { now }), 1)
  const a = JSON.parse(readFileSync(join(root, 'pages', 'a.json'), 'utf8'))
  assert.deepEqual([a.page, a.attempts], [undefined, [1]], 'text dropped, history kept')
})

test('a thin page with no renderer exits 3; three in a row stop static tries there', async () => {
  for (let i = 0; i < 3; i++) {
    const r = await run(`${base}/thin`)
    assert.equal(r.code, 3)
    assert.match(r.stderr, /static: thin; browser: not here; firecrawl: not here/)
  }
  assert.equal(site_record().methods.static.fails_in_row, 3)
  const before_skip = hits['/thin']
  const skipped = await run(`${base}/thin`)
  assert.equal(skipped.code, 3)
  assert.equal(hits['/thin'], before_skip, 'static was not tried again')
  assert.equal(site_record().methods.browser, undefined, 'a missing renderer is not the site failing')
})

test('a 404 is not sent to Firecrawl', async () => {
  const r = await new Promise(done =>
    execFile(
      'node',
      [web_md, `${base.replace("127.0.0.1", "localhost")}/gone`],
      { env: { PATH: `${node_only}:/usr/bin:/bin`, WEB_MD_CACHE: cache_root, FIRECRAWL_API_KEY: 'fc-test' } },
      (error, stdout, stderr) => done({ code: error?.code ?? 0, stderr })
    )
  )
  assert.equal(r.code, 3)
  assert.match(r.stderr, /firecrawl: skipped, HTTP 404/)
})

test('web-md and the host engine read the same cache-time rules', () => {
  const here = readFileSync(new URL('./web-md-cache-times.json', import.meta.url), 'utf8')
  const host = readFileSync(new URL('../../apps/realness/src/host/web-times.json', import.meta.url), 'utf8')
  assert.equal(host, here, 'copy bin/lib/web-md-cache-times.json to apps/realness/src/host/web-times.json')
})
