#!/usr/bin/env node
import { execFileSync as exec_file_sync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { parse_html, Readability, TurndownService } from './lib/harness-dependencies.js'
import { hash, open_cache } from './lib/web-md-cache.js'
import { kept_line, log_read, read_line } from './lib/web-md-log.js'

const args = process.argv.slice(2)
const url = args.find(a => /^https?:\/\//.test(a))
const opt = name => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? null : args[i + 1]
}
const max = Number(opt('max') ?? 8000)
const grep = opt('grep')
const keep_links = args.includes('--links')
const fresh = args.includes('--fresh')
const caller_hours = opt('max-age') == null ? null : Number(opt('max-age'))
const forced = args.includes('--firecrawl') ? 'firecrawl' : args.includes('--browser') ? 'browser' : null
const HERE = dirname(file_url_to_path(import.meta.url))
const CACHE_ROOT = process.env.WEB_MD_CACHE ?? join(HERE, '..', 'artifacts', 'web-md', 'cache')
const LOG_ROOT = process.env.WEB_MD_LOG ?? join(dirname(CACHE_ROOT), 'log')
const MIN_TEXT = 400
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const BLOCKED =
  /just a moment|attention required|performing security verification|been blocked|access denied|are you a robot|verify you are human|enable javascript and cookies|captcha|continue shopping|unusual traffic/i
const OVERLAY =
  /cookie|consent|gdpr|onetrust|modal|overlay|popup|signup|sign-up|newsletter|paywall|login-wall/i

if (!url) {
  console.error(
    'usage: web-md.js <url> [--max N] [--grep word] [--browser] [--firecrawl] [--fresh] [--max-age hours] [--links]'
  )
  process.exit(1)
}

const fetch_static = async (extra = {}) => {
  const res = await fetch(url, {
    headers: { 'user-agent': CHROME_UA, accept: 'text/html', 'accept-language': 'en-US,en;q=0.9', ...extra },
    signal: AbortSignal.timeout(15000)
  })
  return {
    status: res.status,
    validators: { etag: res.headers.get('etag'), last_modified: res.headers.get('last-modified') },
    headers: { cache_control: res.headers.get('cache-control'), expires: res.headers.get('expires') },
    html: res.ok ? await res.text() : null
  }
}

const fetch_browser = () => {
  const session = `web-md-${process.pid}-${Date.now()}`
  const ab = (...a) =>
    exec_file_sync(
      'agent-browser',
      ['--session', session, '--user-agent', CHROME_UA, '--args', '--disable-blink-features=AutomationControlled', ...a],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 45000, maxBuffer: 50 * 1024 * 1024 }
    )
  try {
    try {
      ab('open', url)
    } catch {}
    try {
      ab('wait', '--load', 'networkidle')
    } catch {}
    let html = `<html>${ab('get', 'html', 'html')}</html>`
    if (is_blocked(to_markdown(html))) {
      ab('wait', '5000')
      html = `<html>${ab('get', 'html', 'html')}</html>`
    }
    let status = null
    try {
      status = Number(ab('eval', "performance.getEntriesByType('navigation')[0]?.responseStatus").trim()) || null
    } catch {}
    return { ...to_markdown(html), status }
  } finally {
    try {
      ab('close')
    } catch {}
  }
}

const fetch_firecrawl = async () => {
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
    signal: AbortSignal.timeout(60000)
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || typeof body.data?.markdown !== 'string') throw new Error(body.error ?? `HTTP ${res.status}`)
  return { title: body.data.metadata?.title ?? '', markdown: body.data.markdown }
}

const has_agent_browser = () => {
  try {
    exec_file_sync('agent-browser', ['--version'], { stdio: 'ignore', timeout: 10000 })
    return true
  } catch {
    return false
  }
}

const available = {
  static: () => true,
  browser: has_agent_browser,
  firecrawl: () => Boolean(process.env.FIRECRAWL_API_KEY)
}

const strip_overlays = document => {
  for (const el of document.querySelectorAll('[role=dialog], [aria-modal=true], dialog, [class], [id]')) {
    if (el === document.body || el === document.documentElement) continue
    const label = `${el.getAttribute('class') ?? ''} ${el.id ?? ''}`
    const overlay = el.matches('[role=dialog], [aria-modal=true], dialog') || OVERLAY.test(label)
    if (overlay && (el.textContent ?? '').length < 3000) el.remove()
  }
}

const to_markdown = html => {
  const { document } = parse_html(html)
  strip_overlays(document)
  const article = new Readability(document).parse()
  const page = parse_html(html).document
  strip_overlays(page)
  const page_len = page.body?.textContent?.length ?? 0
  const use_article = article && article.textContent.length > page_len * 0.2
  const body = use_article ? article.content : (page.body?.innerHTML ?? '')
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
  td.remove(['script', 'style', 'noscript', 'iframe', 'svg', 'form', 'img', 'figure', 'sup'])
  td.addRule('no-images', { filter: 'img', replacement: () => '' })
  const markdown = td.turndown(body).replace(/\n{3,}/g, '\n\n').trim()
  return { title: article?.title ?? document.title ?? '', markdown }
}

const present = markdown => {
  let md = markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  if (!keep_links) md = md.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  return md.replace(/\n{3,}/g, '\n\n').trim()
}

const is_blocked = ({ title, markdown }) => BLOCKED.test(title) || BLOCKED.test(present(markdown).slice(0, 600))
const shortfall = page => (is_blocked(page) ? 'blocked' : present(page.markdown).length < MIN_TEXT ? 'thin' : null)

const filter = md => {
  if (!grep) return md
  const re = new RegExp(grep, 'i')
  return md
    .split(/\n\n+/)
    .filter(p => /^#/.test(p) || re.test(p))
    .filter((p, i, all) => !/^#/.test(p) || (all[i + 1] && !/^#/.test(all[i + 1])))
    .join('\n\n')
}

const print = (page, source) => {
  let md = filter(present(page.markdown))
  const total = present(page.markdown).length
  const truncated = md.length > max
  if (truncated) md = md.slice(0, max)
  console.log(`# ${page.title}\n<!-- ${url} | ${source} | ${total} chars${truncated ? `, cut to ${max}` : ''} -->\n\n${md}`)
}

const ENGINE = '/usr/local/bin/brayness-read'
if (process.env.BRAYNESS_ACTOR && !forced && existsSync(ENGINE)) {
  let reply = null
  try {
    const out = exec_file_sync(ENGINE, [url, ...(fresh ? ['--fresh'] : [])], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 200_000, maxBuffer: 64 * 1024 * 1024 })
    reply = JSON.parse(out)
  } catch (error) {
    console.error(`web-md: render failed: engine: ${String(error.stderr || error.message).trim().replace(/^brayness-read: /, '')}`)
    process.exit(3)
  }
  const page = reply.kind === 'html' ? to_markdown(reply.body) : { title: reply.title, markdown: reply.body }
  print({ ...page, title: page.title || reply.title }, `engine ${reply.source}${reply.via ? ` ${reply.via}` : ''}`)
  process.exit(0)
}

const cache = open_cache({ root: CACHE_ROOT, url, times_file: join(HERE, 'lib', 'web-md-cache-times.json') })
const methods = forced ? [forced] : cache.route()
const seen_before = cache.entry.attempts.length > 0 || Boolean(cache.entry.page)
const earlier = new Set(cache.entry.attempts)
const prior = cache.entry.page && { ...cache.entry.page, validators: cache.entry.validators ?? {} }
const failures = []
let validators = {}
let headers = {}
let found = null
let blocked = null
const GONE = new Set([404, 410])
let gone = null

if (methods.includes('static') && !forced) {
  const started = Date.now()
  try {
    const res = await fetch_static(fresh ? {} : cache.conditional())
    validators = res.validators
    headers = res.headers
    if (res.status === 304 && cache.entry.page && !fresh) {
      cache.attempt('static', 'ok', { ms: Date.now() - started })
      found = { page: cache.entry.page, source: `cached ${cache.entry.page.method}, not modified` }
    } else if (res.html === null) {
      if (GONE.has(res.status)) gone = res.status
      throw new Error(`HTTP ${res.status}`)
    } else {
      const page = to_markdown(res.html)
      const why = shortfall(page)
      cache.attempt('static', why ?? 'ok', { ms: Date.now() - started, chars: page.markdown.length })
      if (why) failures.push(`static: ${why}`)
      if (why === 'blocked') blocked = page
      if (!why) {
        cache.store({ method: 'static', ...page }, { validators, headers, caller_hours })
        found = { page, source: 'static' }
      }
    }
  } catch (error) {
    const why = error.name === 'TimeoutError' ? 'timeout' : error.message
    cache.attempt('static', why, { ms: Date.now() - started })
    failures.push(`static: ${why}`)
  }
}

if (!found && !fresh && !forced && cache.current({ validators, caller_hours, headers })) {
  const kept = cache.entry.page
  found = { page: kept, source: `cached ${kept.method} ${kept.fetched.slice(0, 10)}` }
}

for (const method of methods.filter(m => m !== 'static')) {
  if (found) break
  if (!available[method]()) {
    failures.push(`${method}: not here`)
    continue
  }
  if (method === 'firecrawl' && gone && !forced) {
    failures.push(`firecrawl: skipped, HTTP ${gone}`)
    continue
  }
  const started = Date.now()
  try {
    const page = method === 'browser' ? fetch_browser() : await fetch_firecrawl()
    const why = GONE.has(page.status) ? `HTTP ${page.status}` : shortfall(page)
    if (GONE.has(page.status)) gone = page.status
    cache.attempt(method, why ?? 'ok', { ms: Date.now() - started, chars: page.markdown.length })
    if (why === 'blocked') blocked = page
    if (why) {
      failures.push(`${method}: ${why}`)
      continue
    }
    cache.store({ method, ...page }, { validators, headers, caller_hours })
    found = { page, source: method }
  } catch (error) {
    const why = error.name === 'TimeoutError' ? 'timeout' : error.message.split('\n')[0]
    cache.attempt(method, why, { ms: Date.now() - started })
    failures.push(`${method}: ${why}`)
  }
}

if (found) cache.touch({ from_cache: found.source.startsWith('cached') })
cache.save()

const read_now = Boolean(found) && !found.source.startsWith('cached')
const kept = forced
  ? null
  : kept_line({
      prior,
      read: read_now,
      hash: read_now ? hash(found.page.markdown) : null,
      method: read_now ? found.source : null,
      validators,
      ttl: cache.time({ headers })
    })

const log = (source, chars = null) => {
  try {
    const attempts = cache.entry.attempts.filter(a => !earlier.has(a))
    log_read(LOG_ROOT, read_line({ url, source, attempts, seen_before, chars, forced, kept }))
  } catch {}
}

if (found) {
  log(found.source, present(found.page.markdown).length)
  print(found.page, found.source)
} else if (blocked) {
  log('blocked', present(blocked.markdown).length)
  console.log(
    `# ${blocked.title}\n<!-- ${url} | blocked | ${present(blocked.markdown).length} chars -->\n\nBlocked: the site served a bot check or an empty page.`
  )
  process.exit(2)
} else {
  log('failed')
  console.error(`web-md: render failed: ${failures.join('; ') || 'no method left to try'}`)
  process.exit(3)
}
