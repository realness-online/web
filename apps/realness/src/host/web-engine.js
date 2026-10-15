import { createHash as create_hash } from 'node:crypto'
import { lookup as dns_lookup } from 'node:dns'
import {
  appendFileSync as append_file_sync,
  mkdirSync as mkdir_sync,
  readdirSync as readdir_sync,
  readFileSync as read_file_sync,
  renameSync as rename_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { request as http_request } from 'node:http'
import { request as https_request } from 'node:https'
import {
  BlockList,
  isIP as is_ip,
  isIPv4 as is_ipv4,
  isIPv6 as is_ipv6
} from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { HTTP } from '#root/lib/http.js'
import {
  HOURS_PER_DAY,
  ISO_DATE,
  MIB,
  SECONDS_PER_HOUR
} from '#root/lib/units.js'

const FETCH_TIMEOUT_MS = 15_000
const REDIRECT_MIN = 300
const BLOCK_SCAN = 600
const PAGE_LIMIT = 100_000
const RENDER_TIMEOUT_MS = 60_000
const AGE_PLACES = 4

const HOUR = 3_600_000
const IDLE_DAYS = 30
const DEFAULT_HOURS = 24
const MIN_HOURS = 0.25
const MAX_HOURS = 2160
const TIMES_FILE = join(
  dirname(file_url_to_path(import.meta.url)),
  'web-times.json'
)
const MAX_BYTES = 5 * MIB
const MAX_REDIRECTS = 5
const MIN_TEXT = 200
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const GONE = new Set([HTTP.NOT_FOUND, HTTP.GONE])
const BLOCKED_TEXT =
  /just a moment|attention required|verify you are human|access denied|are you a robot|captcha|enable javascript and cookies/i

const hash = text => create_hash('sha256').update(text).digest('hex')

const PRIVATE = new BlockList()
for (const range of [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '224.0.0.0/3'
]) {
  const [network, prefix] = range.split('/')
  PRIVATE.addSubnet(network, Number(prefix), 'ipv4')
}
for (const range of [
  '::/128',
  '::1/128',
  'fc00::/7',
  'fe80::/10',
  'ff00::/8'
]) {
  const [network, prefix] = range.split('/')
  PRIVATE.addSubnet(network, Number(prefix), 'ipv6')
}
const MAPPED = '::ffff:'

export const is_private = address => {
  if (is_ipv6(address)) {
    const lower = address.toLowerCase()
    if (lower.startsWith(MAPPED)) return is_private(lower.slice(MAPPED.length))
    return PRIVATE.check(lower, 'ipv6')
  }
  return is_ipv4(address) && PRIVATE.check(address, 'ipv4')
}

export const check_url = raw => {
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error('not a URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error('only http and https are read')
  if (url.username || url.password)
    throw new Error('URLs with credentials are not read')
  url.hash = ''
  return url
}

export const safe_fetch = (
  raw,
  {
    headers = {},
    allow_private = false,
    timeout = FETCH_TIMEOUT_MS,
    redirects = MAX_REDIRECTS
  } = {}
) =>
  new Promise((done, fail) => {
    const url = check_url(raw)
    /**
     * @type {import('node:net').LookupFunction}
     */
    const lookup = (host, options, callback) =>
      dns_lookup(host, { ...options, all: true }, (error, addresses) => {
        if (error) return callback(error, '', 0)
        const bad = addresses.find(
          ({ address }) => !allow_private && is_private(address)
        )
        if (bad)
          return callback(
            new Error(`${host} resolves to a private address`),
            '',
            0
          )
        if (options.all) return callback(null, addresses)
        callback(null, addresses[0].address, addresses[0].family)
      })
    if (
      is_ip(url.hostname.replace(/^\[|\]$/g, '')) &&
      !allow_private &&
      is_private(url.hostname.replace(/^\[|\]$/g, ''))
    ) {
      fail(new Error(`${url.hostname} is a private address`))
      return
    }

    const request = (url.protocol === 'https:' ? https_request : http_request)(
      url,
      {
        method: 'GET',
        lookup,
        timeout,
        headers: {
          'user-agent': UA,
          accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
          ...headers
        }
      },
      response => {
        const status = response.statusCode ?? HTTP.OK
        if (
          status >= REDIRECT_MIN &&
          status < HTTP.BAD_REQUEST &&
          response.headers.location
        ) {
          response.resume()
          if (redirects <= 0) return fail(new Error('too many redirects'))
          return safe_fetch(new URL(response.headers.location, url).href, {
            headers,
            allow_private,
            timeout,
            redirects: redirects - 1
          }).then(done, fail)
        }
        const chunks = []
        let size = 0
        response.on('data', chunk => {
          size += chunk.length
          if (size > MAX_BYTES) request.destroy(new Error('page is over 5 MB'))
          else chunks.push(chunk)
        })
        response.on('end', () =>
          done({
            url: url.href,
            status,
            body: Buffer.concat(chunks).toString('utf8'),
            type: response.headers['content-type'] ?? '',
            headers: {
              etag: response.headers.etag ?? null,
              last_modified: response.headers['last-modified'] ?? null,
              cache_control: response.headers['cache-control'] ?? null
            }
          })
        )
        response.on('error', fail)
      }
    )
    request.on('timeout', () => request.destroy(new Error('timeout')))
    request.on('error', fail)
    request.end()
  })

const visible_text = html =>
  html
    .replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const title_of = html =>
  (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '')
    .replace(/\s+/g, ' ')
    .trim()

const static_shortfall = reply => {
  if (reply.status >= HTTP.BAD_REQUEST) return `HTTP ${reply.status}`
  if (!/html|xml|text\/plain/i.test(reply.type)) return 'not html'
  return shortfall(reply.body)
}

const page_shortfall = page =>
  page.status >= HTTP.BAD_REQUEST ? `HTTP ${page.status}` : shortfall(page.html)

/**
 * @typedef {{ method: string, kind: string, body: string, title: string }} PageRead
 */

/**
 * @typedef {{ method: string, hash: string, headers: object, learned_hours?: number }} KeptPage
 */

const html_read = (method, body) => ({
  method,
  kind: 'html',
  body,
  title: title_of(body)
})

const markdown_shortfall = page =>
  page.markdown.replace(/\s+/g, ' ').trim().length < MIN_TEXT ? 'thin' : null

export const shortfall = html => {
  const text = visible_text(html)
  if (BLOCKED_TEXT.test(`${title_of(html)} ${text.slice(0, BLOCK_SCAN)}`))
    return 'blocked'
  return text.length < MIN_TEXT ? 'thin' : null
}

const shareable_headers = (headers = {}) =>
  !/no-store/i.test(headers.cache_control ?? '')

/**
 * @param {object} options
 * @param {string} options.url
 * @param {{ cache_control?: string | null, expires?: string | null }} [options.headers]
 * @param {number | null} [options.learned_hours]
 * @param {{ default_hours?: number, default_stale_hours?: number, rules: { pattern: string, hours: number, kind: string, stale_hours?: number }[] }} options.times
 * @param {number} [options.now]
 */
export const cache_time = ({
  url,
  headers = {},
  learned_hours = null,
  times,
  now = Date.now()
}) => {
  const cc = headers.cache_control ?? ''
  const rule = times.rules.find(r => new RegExp(r.pattern, 'i').test(url))
  const swr = /stale-while-revalidate=(\d+)/i.exec(cc)
  const stale_hours = swr
    ? Number(swr[1]) / SECONDS_PER_HOUR
    : (rule?.stale_hours ?? times.default_stale_hours ?? 0)
  const answer = (hours, why) => ({
    hours,
    why,
    stale_hours: hours > 0 ? stale_hours : 0
  })
  if (/no-store/i.test(cc)) return answer(0, 'no-store')
  const max_age = /(?:^|,)\s*(?:s-)?max-age=(\d+)/i.exec(cc)
  if (rule?.kind === 'pinned version') return answer(rule.hours, rule.kind)
  if (/no-cache/i.test(cc) || (max_age && Number(max_age[1]) === 0))
    return { hours: 0, why: 'revalidate', stale_hours: 0 }
  if (max_age) return answer(Number(max_age[1]) / SECONDS_PER_HOUR, 'max-age')
  const expires = Date.parse(headers.expires ?? '') - now
  if (expires > 0) return answer(expires / HOUR, 'expires')
  if (rule?.hours === 0) return answer(0, rule.kind)
  if (learned_hours) return answer(learned_hours, 'learned')
  return rule
    ? answer(rule.hours, rule.kind)
    : answer(times.default_hours ?? DEFAULT_HOURS, 'default')
}

export const learn = (hours, changed) =>
  Math.min(MAX_HOURS, Math.max(MIN_HOURS, changed ? hours / 2 : hours * 2))

export const robots_allows = (text, path) => {
  let applies = false
  let in_group = false
  const rules = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const [, key, value = ''] = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line) ?? []
    if (!key) continue
    const k = key.toLowerCase()
    if (k === 'user-agent') {
      if (!in_group) applies = false
      in_group = true
      if (value.trim() === '*') applies = true
      continue
    }
    in_group = false
    if (applies && (k === 'allow' || k === 'disallow') && value)
      rules.push({ allow: k === 'allow', prefix: value.trim() })
  }
  const matches = rules.filter(r =>
    path.startsWith(r.prefix.replace(/\*$/, ''))
  )
  if (!matches.length) return true
  matches.sort(
    (a, b) =>
      b.prefix.length - a.prefix.length || Number(b.allow) - Number(a.allow)
  )
  return matches[0].allow
}

const read_json = (file, fallback) => {
  try {
    return JSON.parse(read_file_sync(file, 'utf8'))
  } catch {
    return fallback
  }
}
const write_json = (file, value) => {
  mkdir_sync(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  write_file_sync(tmp, JSON.stringify(value))
  rename_sync(tmp, file)
}

export const is_idle = (
  page,
  { now = Date.now(), idle_days = IDLE_DAYS } = {}
) => {
  if (page.headers?.etag || page.headers?.last_modified) return false
  return (
    now - Date.parse(page.read_at ?? page.fetched) >=
    idle_days * HOURS_PER_DAY * HOUR
  )
}

export class WebEngine {
  /** @type {string} */
  root
  /** @type {((url: string) => Promise<{ status: number, html: string }>) | null} */
  render
  /** @type {string | null} */
  firecrawl_key
  /** @type {boolean} */
  allow_private
  /** @type {() => number} */
  now
  /** @type {{ default_hours?: number, default_stale_hours?: number, rules: { pattern: string, hours: number, kind: string, stale_hours?: number }[] }} */
  times
  /** @type {Map<string, { text: string, at: number }>} */
  robots = new Map()
  /** @type {Map<string, Promise<unknown>>} */
  refreshing = new Map()

  /**
   * @param {object} options
   * @param {string} options.root the shared cache
   * @param {((url: string) => Promise<{ status: number, html: string }>) | null} [options.render]
   *   reads a page in a Chrome copy, or null where the host has none
   * @param {string | null} [options.firecrawl_key]
   * @param {boolean} [options.allow_private] tests only
   * @param {() => number} [options.now]
   * @param {object} [options.times] the cache-time rules, read from disk by default
   */
  constructor({
    root,
    render = null,
    firecrawl_key = null,
    allow_private = false,
    now = () => Date.now(),
    times = read_json(TIMES_FILE, { default_hours: DEFAULT_HOURS, rules: [] })
  }) {
    Object.assign(this, {
      root,
      render,
      firecrawl_key,
      allow_private,
      now,
      times
    })
    this.robots = new Map()
    this.refreshing = new Map()
  }

  /**
   * @param {string} url
   * @param {{ etag?: string | null, last_modified?: string | null, cache_control?: string | null }} headers
   * @param {number | null} [learned_hours]
   */
  time(url, headers, learned_hours = null) {
    return cache_time({
      url,
      headers,
      learned_hours,
      times: this.times,
      now: this.now()
    })
  }

  page_file(url) {
    return join(this.root, 'pages', `${hash(url)}.json`)
  }

  log(line) {
    try {
      const at = new Date(this.now()).toISOString()
      mkdir_sync(join(this.root, 'log'), { recursive: true })
      append_file_sync(
        join(this.root, 'log', `${at.slice(0, ISO_DATE)}.jsonl`),
        `${JSON.stringify({ at, ...line })}\n`
      )
    } catch {}
  }

  async #robots(url) {
    const kept = this.robots.get(url.origin)
    if (kept && this.now() - kept.at < DEFAULT_HOURS * HOUR) return kept.text
    let text = ''
    try {
      const reply = await safe_fetch(`${url.origin}/robots.txt`, {
        allow_private: this.allow_private,
        timeout: 5000
      })
      if (reply.status === HTTP.OK) text = reply.body.slice(0, PAGE_LIMIT)
    } catch {}
    this.robots.set(url.origin, { text, at: this.now() })
    return text
  }

  async #firecrawl(url) {
    const reply = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.firecrawl_key}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true
      }),
      signal: AbortSignal.timeout(RENDER_TIMEOUT_MS)
    })
    const body = await reply.json().catch(() => ({}))
    if (!reply.ok || typeof body.data?.markdown !== 'string')
      throw new Error(body.error ?? `HTTP ${reply.status}`)
    return {
      markdown: body.data.markdown,
      title: body.data.metadata?.title ?? '',
      status: body.data.metadata?.statusCode ?? HTTP.OK
    }
  }

  async read(raw, { actor = null, fresh = false } = {}) {
    const url = check_url(raw).href
    const started = this.now()
    const file = this.page_file(url)
    const kept = read_json(file, null)
    const attempts = []
    const finish = (result, extra = {}) => {
      this.log({
        url: hash(url),
        site: hash(new URL(url).host),
        actor: actor ? hash(actor) : null,
        outcome: result.source,
        shared: extra.shared ?? false,
        ...(extra.time && { ttl_h: extra.time.hours, why: extra.time.why }),
        ...(extra.age_h !== null &&
          extra.age_h !== undefined && {
            age_h: Number(extra.age_h.toFixed(AGE_PLACES))
          }),
        ...(extra.changed !== null &&
          extra.changed !== undefined && { changed: extra.changed }),
        ...(extra.reuses !== null &&
          extra.reuses !== undefined && { reuses: extra.reuses }),
        attempts,
        ms: this.now() - started
      })
      return result
    }

    if (kept && !fresh) {
      const time = this.time(url, kept.headers, kept.learned_hours)
      const age_h = (this.now() - Date.parse(kept.fetched)) / HOUR
      const serve = source => {
        kept.read_at = new Date(this.now()).toISOString()
        kept.reuses = (kept.reuses ?? 0) + 1
        write_json(file, kept)
        return finish(
          {
            source,
            via: kept.method,
            kind: kept.kind,
            body: kept.body,
            title: kept.title,
            fetched: kept.fetched
          },
          { shared: true, reuses: kept.reuses, time, age_h }
        )
      }
      if (age_h < time.hours) return serve('cache')
      if (kept.headers.etag || kept.headers.last_modified)
        try {
          const check = await safe_fetch(url, {
            allow_private: this.allow_private,
            headers: {
              ...(kept.headers.etag && { 'if-none-match': kept.headers.etag }),
              ...(kept.headers.last_modified && {
                'if-modified-since': kept.headers.last_modified
              })
            }
          })
          attempts.push({
            method: 'static',
            outcome:
              check.status === HTTP.NOT_MODIFIED
                ? 'not-modified'
                : `HTTP ${check.status}`
          })
          if (check.status === HTTP.NOT_MODIFIED) {
            if (!['max-age', 'expires', 'revalidate'].includes(time.why))
              kept.learned_hours = learn(time.hours, false)
            kept.fetched = new Date(this.now()).toISOString()
            return serve('cache')
          }
        } catch (error) {
          attempts.push({ method: 'static', outcome: error.message })
        }

      if (age_h < time.hours + time.stale_hours) {
        if (!this.refreshing.has(url)) {
          const refresh = this.#read_now(url, kept)
            .catch(() => {})
            .finally(() => this.refreshing.delete(url))
          this.refreshing.set(url, refresh)
        }
        return serve('stale')
      }
    }
    if (this.refreshing.has(url) && !fresh) {
      await this.refreshing.get(url)
      if (read_json(file, null)) return this.read(url, { actor })
    }
    try {
      const got = await this.#read_now(url, fresh ? null : kept, attempts)
      return finish(
        {
          source: got.method,
          kind: got.kind,
          body: got.body,
          title: got.title,
          fetched: got.fetched
        },
        { shared: got.shared, time: got.time, changed: got.changed }
      )
    } catch (error) {
      finish({ source: 'failed' })
      throw error
    }
  }

  #changed(kept, got, digest) {
    if (!kept || !kept.hash || kept.method !== got.method) return null
    return kept.hash !== digest
  }

  #learned(url, kept, changed) {
    const hours = kept?.learned_hours ?? null
    if (changed === null || !kept) return hours
    return learn(hours ?? this.time(url, kept.headers).hours, changed)
  }

  async #try_render({ attempts, get_page, method, page_of, why_of }) {
    try {
      const page = await get_page()
      const gone = GONE.has(page.status) ? page.status : null
      const why = why_of(page)
      attempts.push({ method, outcome: why ?? 'ok' })
      return { gone, got: why ? null : page_of(page) }
    } catch (error) {
      attempts.push({ method, outcome: error.message })
      return { gone: null, got: null }
    }
  }

  /**
   * @param {string} url
   * @param {KeptPage | null} [kept] the cached page, which teaches the new time
   * @param {{ method: string, outcome: string }[]} [attempts]
   */
  async #read_now(url, kept = null, attempts = []) {
    /** @type {{ etag?: string | null, last_modified?: string | null, cache_control?: string | null }} */
    let headers = {}
    /** @type {number | null} */
    let gone = null
    /** @type {PageRead | null} */
    let got = null
    try {
      const reply = await safe_fetch(url, { allow_private: this.allow_private })
      ;({ headers } = reply)
      if (GONE.has(reply.status)) gone = reply.status
      const why = static_shortfall(reply)
      attempts.push({ method: 'static', outcome: why ?? 'ok' })
      if (!why) got = html_read('static', reply.body)
    } catch (error) {
      attempts.push({ method: 'static', outcome: error.message })
      if (/private address|credentials|only http/.test(error.message))
        throw error
    }
    const { render } = this
    if (!got && !gone && render) {
      const tried = await this.#try_render({
        attempts,
        get_page: () => render(url),
        method: 'chrome',
        page_of: page => html_read('chrome', page.html),
        why_of: page_shortfall
      })
      const { got: read, gone: was_gone } = tried
      got = read
      gone ??= was_gone
    }
    if (!got && !gone && this.firecrawl_key) {
      const tried = await this.#try_render({
        attempts,
        get_page: () => this.#firecrawl(url),
        method: 'firecrawl',
        page_of: page => ({
          method: 'firecrawl',
          kind: 'markdown',
          body: page.markdown,
          title: page.title
        }),
        why_of: markdown_shortfall
      })
      const { got: read, gone: was_gone } = tried
      got = read
      gone ??= was_gone
    }

    if (!got)
      throw new Error(
        `could not read ${url}: ${attempts.map(a => `${a.method}: ${a.outcome}`).join('; ') || 'no method'}`
      )

    const digest = hash(got.body)
    const changed = this.#changed(kept, got, digest)
    const learned_hours = this.#learned(url, kept, changed)
    const time = this.time(url, headers, learned_hours)

    const parsed = new URL(url)
    const never_kind = this.times.rules.some(
      r => r.kind === time.why && r.hours === 0
    )
    const shared =
      shareable_headers(headers) &&
      !never_kind &&
      robots_allows(await this.#robots(parsed), parsed.pathname + parsed.search)
    const fetched = new Date(this.now()).toISOString()
    const file = this.page_file(url)
    if (shared)
      write_json(file, {
        url,
        ...got,
        hash: digest,
        headers,
        fetched,
        read_at: fetched,
        reuses: 0,
        ...(learned_hours && { learned_hours })
      })
    else rm_sync(file, { force: true })
    return { ...got, fetched, shared, time, changed }
  }

  prune(options = {}) {
    let dropped = 0
    let files = []
    try {
      files = readdir_sync(join(this.root, 'pages')).filter(f =>
        f.endsWith('.json')
      )
    } catch {
      return 0
    }
    for (const f of files) {
      const page = read_json(join(this.root, 'pages', f), null)
      if (page && is_idle(page, { now: this.now(), ...options })) {
        rm_sync(join(this.root, 'pages', f), { force: true })
        dropped += 1
      }
    }
    return dropped
  }
}

export const engine_report = lines => {
  const by_outcome = {}
  for (const l of lines)
    by_outcome[l.outcome] = (by_outcome[l.outcome] ?? 0) + 1
  const reads = lines.length
  const hits = (by_outcome.cache ?? 0) + (by_outcome.stale ?? 0)
  const rendered = lines.filter(l =>
    l.attempts?.some(a => a.method !== 'static')
  ).length
  return {
    reads,
    hits,
    hit_rate: reads ? hits / reads : 0,
    rendered,
    by_outcome,
    actors: new Set(lines.map(l => l.actor)).size
  }
}
