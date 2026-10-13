import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:http'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { hash } from './web-md-cache.js'
import { outcome_of, read_day, read_line, summarize } from './web-md-log.js'

const run = promisify(execFile)
const BIN = fileURLToPath(new URL('..', import.meta.url))
const ARTIFACTS = fileURLToPath(new URL('../../artifacts/web-md/', import.meta.url))

test('outcomes come from the source line', () => {
  assert.equal(outcome_of('static'), 'static')
  assert.equal(outcome_of('browser'), 'browser')
  assert.equal(outcome_of('cached static, not modified'), 'not-modified')
  assert.equal(outcome_of('cached browser 2026-10-03'), 'cache')
  assert.equal(outcome_of('blocked'), 'blocked')
  assert.equal(outcome_of('failed'), 'failed')
})

test('a line carries hashes, never the URL or host', () => {
  const url = 'https://example.com/private/path?q=secret'
  const line = read_line({ url, source: 'static', attempts: [{ method: 'static', outcome: 'ok', ms: 5, chars: 9, extra: 'x' }], seen_before: false })
  const text = JSON.stringify(line)
  assert.equal(line.url, hash(url))
  assert.equal(line.site, hash('example.com'))
  assert.ok(!text.includes('example.com') && !text.includes('secret'))
  assert.deepEqual(line.attempts, [{ method: 'static', outcome: 'ok', ms: 5, chars: 9 }])
})

test('a day counts by outcome, method, and repeat', () => {
  const line = (url, source, attempts, seen_before = false) => read_line({ url, source, attempts, seen_before })
  const report = summarize([
    line('https://a.test/', 'static', [{ method: 'static', outcome: 'ok', ms: 100 }]),
    line('https://a.test/', 'cached static, not modified', [{ method: 'static', outcome: 'ok', ms: 50 }], true),
    line('https://b.test/', 'browser', [{ method: 'static', outcome: 'thin', ms: 80 }, { method: 'browser', outcome: 'ok', ms: 4000 }]),
    line('https://c.test/', 'failed', [{ method: 'static', outcome: 'timeout', ms: 15000 }, { method: 'browser', outcome: 'blocked', ms: 9000 }])
  ])
  assert.equal(report.reads, 4)
  assert.equal(report.urls, 3)
  assert.equal(report.repeats_today, 1)
  assert.equal(report.seen_before, 1)
  assert.equal(report.rendered, 2)
  assert.deepEqual(report.by_outcome, { static: 1, 'not-modified': 1, browser: 1, failed: 1 })
  assert.deepEqual(report.by_method.static, { ok: 2, failed: 2, ms: 15230 })
  assert.deepEqual(report.by_method.browser, { ok: 1, failed: 1, ms: 13000 })
})

let server
let base
before(async () => {
  server = createServer((req, res) => {
    if (req.url === '/thin') return res.end('<html><title>t</title><body>hi</body></html>')
    res.setHeader('etag', '"v1"')
    if (req.headers['if-none-match'] === '"v1"') return res.writeHead(304).end()
    res.end(`<html><title>Doc</title><body><article><p>${'words '.repeat(200)}</p></article></body></html>`)
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => server.close())

test('web-md logs each run; the report counts the day', async () => {
  mkdirSync(ARTIFACTS, { recursive: true })
  const dir = mkdtempSync(join(ARTIFACTS, 'log-test-'))
  try {
  const env = { ...process.env, WEB_MD_CACHE: join(dir, 'cache'), PATH: '/usr/bin:/bin', FIRECRAWL_API_KEY: '' }
  await run(process.execPath, [join(BIN, 'web-md.js'), `${base}/doc`], { env })
  await run(process.execPath, [join(BIN, 'web-md.js'), `${base}/doc`], { env })
  await assert.rejects(run(process.execPath, [join(BIN, 'web-md.js'), `${base}/thin`], { env }), { code: 3 })

  const day = new Date().toISOString().slice(0, 10)
  const lines = read_day(join(dir, 'log'), day)
  assert.deepEqual(lines.map(l => l.outcome), ['static', 'not-modified', 'failed'])
  assert.deepEqual(lines.map(l => l.seen_before), [false, true, false])
  assert.ok(!readFileSync(join(dir, 'log', `${day}.jsonl`), 'utf8').includes('127.0.0.1'))

  const report = JSON.parse((await run(process.execPath, [join(BIN, 'web-md-report.js'), day, '--json'], { env })).stdout)
  assert.equal(report.reads, 3)
  assert.equal(report.repeats_today, 1)
  assert.deepEqual(report.by_outcome, { static: 1, 'not-modified': 1, failed: 1 })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
