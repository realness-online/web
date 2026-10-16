/**
 * Aggregate Firebase Hosting request logs for marketing page cold loads.
 *
 * Operator CLI (not a Cloud Function). Uses gcloud + a local JSONL archive so
 * later runs only fetch gaps: forward to now, and backward when --days deepens.
 *
 * Usage (from functions/):
 *   npm run traffic
 *   npm run traffic -- --days 30
 *   npm run traffic -- --cache-only
 *   npm run traffic -- --refresh
 */
import { spawnSync as spawn_sync } from 'node:child_process'
import { createHash as create_hash } from 'node:crypto'
import {
  appendFileSync as append_file_sync,
  existsSync as exists_sync,
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync,
  statSync as stat_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'

const script_path = file_url_to_path(import.meta.url)
const repo_root = path.resolve(path.dirname(script_path), '../..')
const harness_artifacts = path.resolve(repo_root, '..', '..', 'artifacts', 'realness-ops')

export const default_host = 'realness.online'
const default_days = 7
const default_buckets = 4
const default_page_size = 1000

const paint = (open, close) => (s, on) => (on ? `\u001b[${open}m${s}\u001b[${close}m` : s)
export const bold = paint(1, 22)
export const dim = paint(2, 22)
export const green = paint(32, 39)
export const yellow = paint(33, 39)

/**
 * Compact age, largest unit that keeps the number small: 12s, 4m, 3h, 2d.
 * @param {number} ms
 */
export const format_age = ms => {
  const s = Math.round(ms / 1000)
  if (s < 90) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 90) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 36) return `${h}h`
  return `${Math.round(h / 24)}d`
}

/** stream is colorable when it's a TTY and NO_COLOR isn't set. */
export const stream_color = stream => !process.env.NO_COLOR && stream.isTTY

/** Crawlable marketing / public document paths (realness robots.txt). */
export const marketing_paths = new Set([
  '/',
  '/about',
  '/docs',
  '/pricing',
  '/terms',
  '/privacy',
  '/llms.txt',
  '/documentation.md'
])

const bot_ua_re =
  /bot|crawler|spider|crawling|slurp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegram|preview|bytespider|gptbot|claudebot|anthropic|openai|perplexity|semrush|ahrefs|mj12|dotbot|petalbot|applebot|bingpreview|yandex|duckduck|ia_archiver|wget|curl\//i

const help_text = `Summarize Firebase Hosting HTTP traffic for Realness marketing pages.

Passive only: Cloud Logging via gcloud, archived locally as JSONL.
No in-app analytics. Lives in realness-functions (operator tooling).

Usage:
  npm run traffic
  npm run traffic -- --days 30
  npm run traffic -- --cache-only
  npm run traffic -- --refresh
  npm run traffic -- --sample 5

Options:
  --days N          Length of one reporting period (default: ${default_days})
  --buckets N       Periods to compare, including the current one
                    (default: ${default_buckets}); also sets how far to backfill
  --project ID      GCP project (default: production from .firebaserc)
  --host HOST       Hostname filter (default: ${default_host})
  --cache PATH      JSONL archive path (default under artifacts/)
  --cache-only      Report from local JSONL; do not call gcloud
  --refresh         Re-fetch the lookback window and rewrite the archive
  --include-bots    Keep known crawler / preview UAs in human counts
  --all-paths       Rank document-ish paths, not only marketing pages
  --pages           Add the per-path table (hits / bots / humans / ≈IPs)
  --by-day          Daily human hits for /, /about, /pricing
  --sample [N]      Print N simplified entries from the report set and exit
  --help            Show this help

Default view is three numbers across ${default_buckets} periods, because a count
with nothing to compare against is not a reading. Uncovered periods print '-';
they are unknown, not zero. Backfill spans days × buckets.

Cache grows by append (newer and older). Deduped by insertId / content hash.
Steady-state runs only pull the forward gap since the newest cached row.

What this measures well: whether anything out there is sending people here.
What it misses: PWA / service-worker sessions, unique people, most referrers.
`

/**
 * @param {string[]} argv
 */
export const parse_args = (argv = process.argv.slice(2)) => {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.info(help_text)
    process.exit(0)
  }

  /** @type {{ days: number, buckets: number, project: string | null, host: string, include_bots: boolean, all_paths: boolean, sample: number | null, cache: string | null, cache_only: boolean, refresh: boolean, by_day: boolean, pages: boolean }} */
  const opts = {
    days: default_days,
    buckets: default_buckets,
    project: null,
    host: default_host,
    include_bots: false,
    all_paths: false,
    sample: null,
    cache: null,
    cache_only: false,
    refresh: false,
    by_day: false,
    pages: false
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]
    if (arg === '--days' && next) opts.days = Number(argv[++i])
    else if (arg === '--buckets' && next) opts.buckets = Number(argv[++i])
    else if (arg === '--pages') opts.pages = true
    else if (arg === '--project' && next) opts.project = argv[++i]
    else if (arg === '--host' && next) opts.host = argv[++i]
    else if (arg === '--cache' && next) opts.cache = argv[++i]
    else if (arg === '--cache-only') opts.cache_only = true
    else if (arg === '--refresh') opts.refresh = true
    else if (arg === '--include-bots') opts.include_bots = true
    else if (arg === '--all-paths') opts.all_paths = true
    else if (arg === '--by-day') opts.by_day = true
    else if (arg === '--sample') {
      if (next && !next.startsWith('--')) opts.sample = Number(argv[++i])
      else opts.sample = 5
    } else throw new Error(`Unknown argument: ${arg}`)
  }

  if (!Number.isFinite(opts.days) || opts.days <= 0)
    throw new Error('--days must be a positive number')
  if (!Number.isFinite(opts.buckets) || opts.buckets < 1)
    throw new Error('--buckets must be at least 1')
  if (opts.sample !== null && (!Number.isFinite(opts.sample) || opts.sample < 0))
    throw new Error('--sample must be a non-negative number')
  if (opts.cache_only && opts.refresh)
    throw new Error('Use either --cache-only or --refresh, not both')

  return opts
}

export const default_project_id = () => {
  const firebaserc = JSON.parse(
    read_file_sync(path.join(repo_root, '.firebaserc'), 'utf8')
  )
  return (
    firebaserc.projects?.production ??
    firebaserc.projects?.default ??
    'realness-online'
  )
}

/**
 * @param {string} project
 * @param {string} host
 * @param {boolean} all_paths
 */
export const default_cache_path = (project, host, all_paths) => {
  const mode = all_paths ? 'all-paths' : 'marketing'
  const safe_host = host.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return path.join(
    harness_artifacts,
    'hosting-traffic',
    `${project}_${safe_host}_${mode}.jsonl`
  )
}

/**
 * @param {string | undefined | null} request_url
 * @returns {string}
 */
export const path_from_url = request_url => {
  if (!request_url || typeof request_url !== 'string') return ''
  try {
    const url = new URL(request_url)
    let pathname = url.pathname || '/'
    if (pathname.length > 1 && pathname.endsWith('/'))
      pathname = pathname.slice(0, -1)
    return pathname || '/'
  } catch {
    const cleaned = request_url.split('?')[0].split('#')[0]
    if (!cleaned.startsWith('/')) return ''
    if (cleaned.length > 1 && cleaned.endsWith('/')) return cleaned.slice(0, -1)
    return cleaned || '/'
  }
}

/**
 * @param {string | undefined | null} user_agent
 */
export const is_bot_ua = user_agent =>
  typeof user_agent === 'string' && bot_ua_re.test(user_agent)

/**
 * @param {Record<string, unknown> | undefined | null} http_request
 * @param {{ host: string, all_paths: boolean }} options
 */
export const is_document_hit = (http_request, { host, all_paths }) => {
  if (!http_request || typeof http_request !== 'object') return false
  if (http_request.requestMethod !== 'GET') return false

  const status = Number(http_request.status)
  if (Number.isFinite(status) && (status < 200 || status >= 400)) return false

  const request_url = String(http_request.requestUrl ?? '')
  if (host && request_url && !request_url.includes(host)) return false

  const doc_path = path_from_url(request_url)
  if (!doc_path) return false
  if (all_paths) {
    if (doc_path.startsWith('/assets/')) return false
    if (
      /\.(js|css|map|woff2?|png|jpe?g|gif|webp|svg|ico|wasm)(\?|$)/i.test(
        doc_path
      )
    )
      return false
    return true
  }
  return marketing_paths.has(doc_path)
}

/**
 * @param {unknown} entry
 */
export const http_request_from_entry = entry => {
  if (!entry || typeof entry !== 'object') return null
  const record = /** @type {Record<string, unknown>} */ (entry)
  const http =
    record.httpRequest ??
    record.http_request ??
    (record.protoPayload &&
    typeof record.protoPayload === 'object' &&
    /** @type {Record<string, unknown>} */ (record.protoPayload).httpRequest)
  if (!http || typeof http !== 'object') return null
  return /** @type {Record<string, unknown>} */ (http)
}

/**
 * @param {string | undefined | null} referer
 */
export const referer_host = referer => {
  if (!referer || typeof referer !== 'string' || !referer.trim()) return '(none)'
  try {
    const host = new URL(referer).host
    return /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? host : '(none)'
  } catch {
    return '(none)'
  }
}

/**
 * @param {Record<string, unknown>} http_request
 */
export const visitor_key = http_request => {
  const ip = String(http_request.remoteIp ?? '')
  const ua = String(http_request.userAgent ?? '').slice(0, 120)
  return create_hash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 12)
}

/**
 * @param {unknown} entry
 * @returns {string | null}
 */
export const entry_timestamp = entry => {
  if (!entry || typeof entry !== 'object') return null
  const ts = /** @type {Record<string, unknown>} */ (entry).timestamp
  if (typeof ts === 'string' && ts) return ts
  if (ts && typeof ts === 'object') {
    const seconds = /** @type {Record<string, unknown>} */ (ts).seconds
    if (typeof seconds === 'number' || typeof seconds === 'string') {
      const ms = Number(seconds) * 1000
      if (Number.isFinite(ms)) return new Date(ms).toISOString()
    }
  }
  return null
}

/**
 * Stable id for dedupe across append directions.
 * @param {unknown} entry
 */
export const entry_id = entry => {
  if (!entry || typeof entry !== 'object') return ''
  const record = /** @type {Record<string, unknown>} */ (entry)
  if (typeof record.insertId === 'string' && record.insertId)
    return record.insertId
  const ts = entry_timestamp(entry) ?? ''
  const http = http_request_from_entry(entry)
  const url = String(http?.requestUrl ?? '')
  const ip = String(http?.remoteIp ?? '')
  const ua = String(http?.userAgent ?? '')
  return create_hash('sha256')
    .update(`${ts}|${url}|${ip}|${ua}`)
    .digest('hex')
    .slice(0, 24)
}

/**
 * Slim row stored in JSONL.
 * @param {unknown} entry
 */
export const compact_entry = entry => {
  const http = http_request_from_entry(entry)
  const record = /** @type {Record<string, unknown>} */ (entry)
  return {
    insertId:
      typeof record.insertId === 'string' ? record.insertId : entry_id(entry),
    timestamp: entry_timestamp(entry),
    httpRequest: http
  }
}

/**
 * @param {string} cache_path
 * @returns {ReturnType<typeof compact_entry>[]}
 */
export const read_jsonl_cache = cache_path => {
  if (!exists_sync(cache_path)) return []
  const text = read_file_sync(cache_path, 'utf8')
  if (!text.trim()) return []
  /** @type {ReturnType<typeof compact_entry>[]} */
  const rows = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    rows.push(JSON.parse(trimmed))
  }
  return rows
}

/**
 * @param {string} cache_path
 * @param {ReturnType<typeof compact_entry>[]} rows
 */
export const append_jsonl_cache = (cache_path, rows) => {
  if (!rows.length) return
  mkdir_sync(path.dirname(cache_path), { recursive: true })
  const body = rows.map(row => JSON.stringify(row)).join('\n') + '\n'
  append_file_sync(cache_path, body, 'utf8')
}

/**
 * @param {string} cache_path
 * @param {ReturnType<typeof compact_entry>[]} rows
 */
export const rewrite_jsonl_cache = (cache_path, rows) => {
  mkdir_sync(path.dirname(cache_path), { recursive: true })
  if (!rows.length) {
    write_file_sync(cache_path, '', 'utf8')
    return
  }
  const body = rows.map(row => JSON.stringify(row)).join('\n') + '\n'
  write_file_sync(cache_path, body, 'utf8')
}

/**
 * @param {ReturnType<typeof compact_entry>[]} rows
 * @returns {{ oldest: string | null, newest: string | null }}
 */
export const cache_bounds = rows => {
  /** @type {string | null} */
  let oldest = null
  /** @type {string | null} */
  let newest = null
  for (const row of rows) {
    const ts = row.timestamp
    if (typeof ts !== 'string' || !ts) continue
    if (!oldest || ts < oldest) oldest = ts
    if (!newest || ts > newest) newest = ts
  }
  return { oldest, newest }
}

/**
 * @param {unknown[]} entries
 * @param {{ host: string, include_bots: boolean, all_paths: boolean }} options
 */
export const aggregate_entries = (
  entries,
  { host, include_bots, all_paths }
) => {
  /** @type {Map<string, { hits: number, bots: number, humans: number, visitor_keys: Set<string> }>} */
  const by_path = new Map()
  /** @type {Map<string, number>} */
  const referers = new Map()
  let scanned = 0
  let matched = 0
  let bots = 0

  for (const entry of entries) {
    scanned++
    const http_request = http_request_from_entry(entry)
    if (!http_request) continue
    if (!is_document_hit(http_request, { host, all_paths })) continue
    matched++

    const doc_path = path_from_url(String(http_request.requestUrl ?? ''))
    const bot = is_bot_ua(String(http_request.userAgent ?? ''))
    if (bot) bots++

    const count_as_human = include_bots || !bot
    let row = by_path.get(doc_path)
    if (!row) {
      row = { hits: 0, bots: 0, humans: 0, visitor_keys: new Set() }
      by_path.set(doc_path, row)
    }
    row.hits++
    if (bot) row.bots++
    else row.humans++

    if (count_as_human) {
      row.visitor_keys.add(visitor_key(http_request))
      const ref = referer_host(
        /** @type {string | undefined} */ (http_request.referer)
      )
      referers.set(ref, (referers.get(ref) ?? 0) + 1)
    }
  }

  const paths = [...by_path.entries()]
    .map(([doc_path, row]) => ({
      path: doc_path,
      hits: row.hits,
      bots: row.bots,
      humans: row.humans,
      approx_visitors: row.visitor_keys.size
    }))
    .sort((a, b) => b.hits - a.hits || a.path.localeCompare(b.path))

  const top_referers = [...referers.entries()]
    .map(([host_name, count]) => ({ host: host_name, count }))
    .sort((a, b) => b.count - a.count || a.host.localeCompare(b.host))
    .slice(0, 15)

  const approx_visitors = new Set()
  for (const row of by_path.values())
    for (const key of row.visitor_keys) approx_visitors.add(key)

  return {
    scanned,
    matched,
    bots,
    paths,
    top_referers,
    approx_visitors: approx_visitors.size
  }
}

/**
 * Where a hit came from, relative to our own site.
 * `internal` is one of our pages linking to another — a click, not a discovery.
 * @param {string | undefined | null} referer
 * @param {string} host
 * @returns {'direct' | 'internal' | 'external'}
 */
export const classify_referer = (referer, host) => {
  const ref_host = referer_host(referer)
  if (ref_host === '(none)') return 'direct'
  const bare = s => s.replace(/^www\./i, '').toLowerCase()
  if (bare(ref_host) === bare(host)) return 'internal'
  return 'external'
}

/**
 * A single address is a burst when it carries an implausible share of a
 * period. Real visitors do not produce a fifth of a week's traffic; a spam
 * or scan run does, and it rotates user agents so ≈IPs cannot see it.
 * Both conditions must hold, so a quiet period cannot trip on a handful of hits.
 */
export const burst_share = 0.2
export const burst_min_hits = 20

/**
 * Addresses whose volume disqualifies them from the headline numbers.
 * @param {Map<string, number>} hits_by_ip
 * @param {number} total
 * @returns {Set<string>}
 */
export const burst_ips = (hits_by_ip, total) => {
  const flagged = new Set()
  if (total <= 0) return flagged
  for (const [ip, hits] of hits_by_ip)
    if (hits >= burst_min_hits && hits / total >= burst_share) flagged.add(ip)
  return flagged
}

/**
 * The three numbers that can actually move: how many people arrived from
 * somewhere else, how many landed, how many read past the homepage.
 *
 * `deeper` is a subset of `landed`: only visitors who saw the homepage and
 * then went somewhere else. Someone who arrives on a deep link never saw the
 * homepage, so they are not part of the ratio.
 *
 * Burst addresses are held out and reported separately rather than dropped
 * quietly — the exclusion is part of the reading.
 *
 * @param {unknown[]} entries
 * @param {{ host: string, include_bots: boolean, all_paths: boolean }} options
 */
export const aggregate_window = (
  entries,
  { host, include_bots, all_paths }
) => {
  /** @type {Map<string, number>} */
  const hits_by_ip = new Map()
  let countable = 0
  for (const entry of entries) {
    const http_request = http_request_from_entry(entry)
    if (!http_request) continue
    if (!is_document_hit(http_request, { host, all_paths })) continue
    if (!include_bots && is_bot_ua(String(http_request.userAgent ?? ''))) continue
    countable++
    const ip = String(http_request.remoteIp ?? '')
    hits_by_ip.set(ip, (hits_by_ip.get(ip) ?? 0) + 1)
  }
  const flagged = burst_ips(hits_by_ip, countable)

  const landed_keys = new Set()
  const inner_keys = new Set()
  /** @type {Map<string, { kind: string, host: string }>} */
  const arrivals = new Map()
  let bots = 0
  let burst_hits = 0

  const ordered = [...entries].sort((a, b) =>
    String(entry_timestamp(a) ?? '').localeCompare(String(entry_timestamp(b) ?? ''))
  )

  for (const entry of ordered) {
    const http_request = http_request_from_entry(entry)
    if (!http_request) continue
    if (!is_document_hit(http_request, { host, all_paths })) continue

    const bot = is_bot_ua(String(http_request.userAgent ?? ''))
    if (bot) bots++
    if (bot && !include_bots) continue

    if (flagged.has(String(http_request.remoteIp ?? ''))) {
      burst_hits++
      continue
    }

    const doc_path = path_from_url(String(http_request.requestUrl ?? ''))
    const key = visitor_key(http_request)
    if (doc_path === '/') landed_keys.add(key)
    else inner_keys.add(key)

    if (arrivals.has(key)) continue
    const referer = /** @type {string | undefined} */ (http_request.referer)
    arrivals.set(key, {
      kind: classify_referer(referer, host),
      host: referer_host(referer)
    })
  }

  const arrived = [...arrivals.values()]
  /** @type {Map<string, number>} */
  const sources = new Map()
  for (const arrival of arrived)
    if (arrival.kind === 'external')
      sources.set(arrival.host, (sources.get(arrival.host) ?? 0) + 1)

  return {
    outside: arrived.filter(arrival => arrival.kind === 'external').length,
    landed: landed_keys.size,
    deeper: [...inner_keys].filter(key => landed_keys.has(key)).length,
    direct: arrived.filter(arrival => arrival.kind === 'direct').length,
    internal: arrived.filter(arrival => arrival.kind === 'internal').length,
    bots,
    burst_hits,
    burst_ips: [...flagged],
    sources: [...sources.entries()]
      .map(([source_host, count]) => ({ host: source_host, count }))
      .sort((a, b) => b.count - a.count || a.host.localeCompare(b.host))
  }
}

/**
 * Consecutive windows of `days` each, oldest first, the last ending at `now`.
 * @param {Date | string | number} now
 * @param {number} days
 * @param {number} buckets
 */
export const bucket_windows = (now, days, buckets) => {
  const span = days * 24 * 60 * 60 * 1000
  const end = new Date(now).getTime()
  const out = []
  for (let i = buckets - 1; i >= 0; i--)
    out.push({
      start: new Date(end - (i + 1) * span).toISOString(),
      end: new Date(end - i * span).toISOString()
    })
  return out
}

/**
 * Same window aggregate, repeated over consecutive periods so a number has
 * something to be compared against. `covered` is false when the archive does
 * not reach back that far — an uncovered bucket is unknown, not zero.
 *
 * @param {{ timestamp?: string | null }[]} rows
 * @param {{ host: string, include_bots: boolean, all_paths: boolean, days: number, buckets: number, now?: Date | string | number, oldest?: string | null }} options
 */
export const aggregate_trend = (
  rows,
  {
    host,
    include_bots,
    all_paths,
    days,
    buckets,
    now = new Date(),
    oldest = null
  }
) =>
  bucket_windows(now, days, buckets).map(window => {
    const entries = rows.filter(
      row =>
        typeof row.timestamp === 'string' &&
        row.timestamp >= window.start &&
        row.timestamp < window.end
    )
    return {
      ...window,
      covered: !oldest || oldest <= window.start,
      ...aggregate_window(entries, { host, include_bots, all_paths })
    }
  })

/**
 * One period per column, right-aligned so the series reads as a shape without
 * needing block glyphs — those fuse into an unreadable smear in most terminal
 * fonts. Unknown periods print '-'.
 * @param {(number | null)[]} values
 */
export const format_series = values => {
  const cells = values.map(value =>
    typeof value === 'number' ? String(value) : '-'
  )
  const width = Math.max(3, ...cells.map(cell => cell.length))
  return cells.map(cell => cell.padStart(width)).join('  ')
}

/** Signed delta, or a dash when there is nothing to compare against. */
export const format_delta = (current, previous) => {
  if (typeof previous !== 'number') return '-'
  const diff = current - previous
  if (diff === 0) return '0'
  return diff > 0 ? `+${diff}` : String(diff)
}

/**
 * Below this many arrivals a week, period-to-period movement is mostly
 * sampling noise and the delta should not be read as a trend.
 */
export const noise_floor = 30

/**
 * A plain-language read of the most recent period. No trend, no series, no
 * delta column - just the three numbers that move, written as sentences so
 * the scale of each is obvious. `landed`/`deeper` are distinct ≈visitors
 * (hashed IP+UA); `outside` is raw hits with an external referer.
 *
 * @param {ReturnType<typeof aggregate_trend>} trend
 * @param {{ days: number, color?: boolean }} meta
 */
export const format_insight = (trend, { days, color = false }) => {
  const current = trend[trend.length - 1]
  const lines = []

  if (current.landed === 0) {
    lines.push(dim('  no visitor data for this period yet', color))
    return lines.join('\n')
  }
  if (!current.covered)
    lines.push(dim('  partial period: logs start after the window opens', color))

  const count = value => bold(green(String(value), color), color)
  const ratio = Math.round((current.deeper / current.landed) * 100)
  lines.push(
    `  ${count(current.landed)} people visited the homepage` +
      dim(`  (${days}d, distinct visitors)`, color)
  )
  lines.push(
    `  ${count(current.deeper)} of them went past the homepage ` +
      dim(`(${ratio}%)`, color)
  )

  if (current.outside === 0) lines.push(dim('  none came from another site', color))
  else {
    lines.push(`  ${count(current.outside)} came from another site`)
    const width = Math.max(
      ...current.sources.map(source => String(source.count).length)
    )
    for (const source of current.sources)
      lines.push(
        `    ${green(String(source.count).padStart(width), color)}  ${source.host}`
      )
  }

  return lines.join('\n')
}

/** Funnel paths for --by-day (ads → about → use → pricing). */
export const by_day_paths = ['/', '/about', '/pricing']

/**
 * @param {string | null | undefined} timestamp
 * @returns {string | null} UTC calendar day YYYY-MM-DD
 */
export const utc_day = timestamp => {
  if (typeof timestamp !== 'string' || timestamp.length < 10) return null
  const day = timestamp.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return day
}

/**
 * Inclusive UTC day list from since through until (default: now).
 * @param {string} since_iso
 * @param {string} [until_iso]
 * @returns {string[]}
 */
export const each_utc_day = (
  since_iso,
  until_iso = new Date().toISOString()
) => {
  const start = utc_day(since_iso)
  const end = utc_day(until_iso)
  if (!start || !end) return []
  const out = []
  const cursor = new Date(`${start}T00:00:00.000Z`)
  const last = new Date(`${end}T00:00:00.000Z`)
  while (cursor <= last) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

/**
 * Daily human hits + ≈IPs for focus paths (default /, /about, /pricing).
 *
 * @param {unknown[]} entries
 * @param {{ host: string, include_bots: boolean, all_paths: boolean, since: string, paths?: string[] }} options
 */
export const aggregate_by_day = (
  entries,
  { host, include_bots, all_paths, since, paths = by_day_paths }
) => {
  /** @type {Map<string, Map<string, { humans: number, visitor_keys: Set<string> }>>} */
  const by_day = new Map()

  for (const entry of entries) {
    const http_request = http_request_from_entry(entry)
    if (!http_request) continue
    if (!is_document_hit(http_request, { host, all_paths })) continue

    const bot = is_bot_ua(String(http_request.userAgent ?? ''))
    if (bot && !include_bots) continue

    const doc_path = path_from_url(String(http_request.requestUrl ?? ''))
    if (!paths.includes(doc_path)) continue

    const day =
      utc_day(entry_timestamp(entry)) ??
      utc_day(/** @type {{ timestamp?: string }} */ (entry).timestamp)
    if (!day) continue

    let path_map = by_day.get(day)
    if (!path_map) {
      path_map = new Map()
      by_day.set(day, path_map)
    }
    let row = path_map.get(doc_path)
    if (!row) {
      row = { humans: 0, visitor_keys: new Set() }
      path_map.set(doc_path, row)
    }
    row.humans++
    row.visitor_keys.add(visitor_key(http_request))
  }

  const day_list = each_utc_day(since)
  return day_list.map(day => {
    const path_map = by_day.get(day)
    /** @type {Record<string, { humans: number, approx_visitors: number }>} */
    const cols = {}
    for (const doc_path of paths) {
      const row = path_map?.get(doc_path)
      cols[doc_path] = {
        humans: row?.humans ?? 0,
        approx_visitors: row?.visitor_keys.size ?? 0
      }
    }
    return { day, paths: cols }
  })
}

/**
 * @param {ReturnType<typeof aggregate_by_day>} rows
 * @param {string[]} [paths]
 */
export const format_by_day = (rows, paths = by_day_paths, { color = false } = {}) => {
  const lines = []
  lines.push(dim('By day (human hits / ≈IPs, UTC):', color))
  const short = {
    '/': 'home',
    '/about': 'about',
    '/pricing': 'price'
  }
  const header =
    'Day         ' +
    paths
      .map(doc_path => {
        const label = short[doc_path] ?? doc_path
        return `${label.padStart(5)} ${'≈'.padStart(4)}`
      })
      .join('  ')
  lines.push(bold(header, color))
  lines.push(dim('-'.repeat(header.length), color))
  for (const row of rows) {
    const cells = paths.map(doc_path => {
      const col = row.paths[doc_path]
      return `${String(col.humans).padStart(5)} ${String(col.approx_visitors).padStart(4)}`
    })
    lines.push(`${row.day}  ${cells.join('  ')}`)
  }
  return lines.join('\n')
}

/**
 * Per-path detail, behind --pages. The default view deliberately omits this:
 * the ranking never changes, so it answers nothing on a weekly read.
 *
 * @param {ReturnType<typeof aggregate_entries>} report
 * @param {{ color?: boolean }} [meta]
 */
export const format_report = (report, meta = {}) => {
  const color = meta.color ?? false
  const lines = []

  if (!report.paths.length) {
    lines.push('No matching document requests in this window.')
    lines.push(dim(`(scanned ${report.scanned} cached rows in lookback)`, color))
    return lines.join('\n')
  }

  const path_width = Math.max(12, ...report.paths.map(row => row.path.length))
  const header = [
    'Path'.padEnd(path_width),
    'Hits'.padStart(6),
    'Bots'.padStart(6),
    'Human'.padStart(6),
    '≈IPs'.padStart(6)
  ].join('  ')
  lines.push(bold(header, color))
  lines.push(dim('-'.repeat(header.length), color))
  for (const row of report.paths)
    lines.push(
      [
        row.path.padEnd(path_width),
        String(row.hits).padStart(6),
        String(row.bots).padStart(6),
        String(row.humans).padStart(6),
        String(row.approx_visitors).padStart(6)
      ].join('  ')
    )

  lines.push('')
  lines.push(
    dim(
      `≈IPs is hashed IP+UA, humans only, and does not sum across rows.`,
      color
    )
  )
  return lines.join('\n')
}

/**
 * Escape a hostname for use inside a Cloud Logging RE2 pattern.
 * @param {string} host
 */
export const escape_re2_host = host =>
  host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * @param {{ host: string, since: string, until?: string | null, all_paths?: boolean }} options
 */
export const build_logging_filter = ({
  host,
  since,
  until = null,
  all_paths = false
}) => {
  const parts = [
    'resource.type="firebase_domain"',
    `timestamp>="${since}"`,
    'httpRequest.requestMethod="GET"'
  ]
  if (until) parts.push(`timestamp<"${until}"`)

  if (all_paths) parts.push(`httpRequest.requestUrl:"${host}"`)
  else {
    const escaped = escape_re2_host(host)
    const path_alt = [...marketing_paths]
      .filter(doc_path => doc_path !== '/')
      .map(doc_path =>
        doc_path
          .replace(/^\//, '')
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      )
      .join('|')
    parts.push(
      `httpRequest.requestUrl=~"${escaped}/?(?:\\?|#|$)|${escaped}/(?:${path_alt})(?:/|\\?|#|$)"`
    )
  }

  return parts.join(' AND ')
}

/**
 * @param {{ project: string, filter: string, limit: number }} options
 * @returns {unknown[]}
 */
const gcloud_logging_read = ({ project, filter, limit }) => {
  const result = spawn_sync(
    'gcloud',
    [
      'logging',
      'read',
      filter,
      `--project=${project}`,
      `--limit=${limit}`,
      '--format=json',
      '--order=desc'
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  )

  if (result.error) {
    if (/** @type {NodeJS.ErrnoException} */ (result.error).code === 'ENOENT')
      throw new Error(
        'gcloud not found. Install Google Cloud SDK and run gcloud auth login.'
      )
    throw result.error
  }

  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim()
    throw new Error(err || `gcloud exited with status ${result.status}`)
  }

  const stdout = (result.stdout || '').trim()
  if (!stdout || stdout === '[]') return []
  return JSON.parse(stdout)
}

/**
 * Page a half-open time range [since, until) newest-first. No total cap.
 *
 * @param {{ project: string, host: string, since: string, until?: string | null, all_paths?: boolean, page_size?: number }} options
 * @returns {{ entries: unknown[], pages: number }}
 */
export const fetch_log_range = options => {
  const page_size = options.page_size ?? default_page_size
  const all_paths = Boolean(options.all_paths)
  /** @type {unknown[]} */
  const entries = []
  /** @type {string | null} */
  let until = options.until ?? null
  let pages = 0

  while (true) {
    const filter = build_logging_filter({
      host: options.host,
      since: options.since,
      until,
      all_paths
    })
    const batch = gcloud_logging_read({
      project: options.project,
      filter,
      limit: page_size
    })
    pages++
    if (!batch.length) break

    entries.push(...batch)
    if (batch.length < page_size) break

    const oldest = entry_timestamp(batch[batch.length - 1])
    if (!oldest || oldest <= options.since) break
    if (until && oldest >= until) break
    until = oldest
  }

  return { entries, pages }
}

/**
 * Merge fetched rows into the archive (append-only unless refresh).
 *
 * @param {{
 *   cache_path: string
 *   project: string
 *   host: string
 *   days: number
 *   all_paths: boolean
 *   cache_only?: boolean
 *   refresh?: boolean
 *   page_size?: number
 * }} options
 */
export const sync_traffic_cache = options => {
  const since = new Date(
    Date.now() - options.days * 24 * 60 * 60 * 1000
  ).toISOString()
  const existing = options.refresh ? [] : read_jsonl_cache(options.cache_path)
  const by_id = new Map(existing.map(row => [entry_id(row), row]))
  const bounds = cache_bounds(existing)

  let pages = 0
  /** @type {ReturnType<typeof compact_entry>[]} */
  const incoming = []

  if (!options.cache_only) {
    if (!bounds.newest || options.refresh) {
      const filled = fetch_log_range({
        project: options.project,
        host: options.host,
        since,
        until: null,
        all_paths: options.all_paths,
        page_size: options.page_size
      })
      pages += filled.pages
      for (const entry of filled.entries) incoming.push(compact_entry(entry))
    } else {
      const forward = fetch_log_range({
        project: options.project,
        host: options.host,
        since: bounds.newest,
        until: null,
        all_paths: options.all_paths,
        page_size: options.page_size
      })
      pages += forward.pages
      for (const entry of forward.entries) incoming.push(compact_entry(entry))

      if (bounds.oldest && bounds.oldest > since) {
        const backward = fetch_log_range({
          project: options.project,
          host: options.host,
          since,
          until: bounds.oldest,
          all_paths: options.all_paths,
          page_size: options.page_size
        })
        pages += backward.pages
        for (const entry of backward.entries) incoming.push(compact_entry(entry))
      }
    }
  }

  /** @type {ReturnType<typeof compact_entry>[]} */
  const novel = []
  for (const row of incoming) {
    const id = entry_id(row)
    if (!id || by_id.has(id)) continue
    by_id.set(id, row)
    novel.push(row)
  }

  if (options.refresh) rewrite_jsonl_cache(options.cache_path, [...by_id.values()])
  else if (novel.length) append_jsonl_cache(options.cache_path, novel)

  const all_rows = [...by_id.values()]
  const lookback_rows = all_rows.filter(
    row => typeof row.timestamp === 'string' && row.timestamp >= since
  )

  return {
    since,
    pages,
    added: novel.length,
    entries: lookback_rows,
    all_entries: all_rows,
    cache_total: all_rows.length,
    bounds: cache_bounds(all_rows)
  }
}

/**
 * @param {unknown} entry
 */
export const simplify_entry = entry => {
  const http_request = http_request_from_entry(entry)
  if (!http_request) return { timestamp: null, note: 'no httpRequest' }
  const record = /** @type {Record<string, unknown>} */ (entry)
  return {
    timestamp: record.timestamp ?? null,
    method: http_request.requestMethod,
    url: http_request.requestUrl,
    path: path_from_url(String(http_request.requestUrl ?? '')),
    status: http_request.status,
    referer: http_request.referer || '(none)',
    user_agent: http_request.userAgent,
    cache_hit: http_request.cacheHit ?? null,
    bot: is_bot_ua(String(http_request.userAgent ?? ''))
  }
}

const main = async () => {
  const args = parse_args()
  const project = args.project ?? default_project_id()
  const cache_path =
    args.cache ?? default_cache_path(project, args.host, args.all_paths)

  const err_color = stream_color(process.stderr)
  const host_flag =
    args.host === default_host
      ? green(args.host, err_color)
      : yellow(args.host, err_color)
  const flags = [
    `${args.days}d × ${args.buckets}`,
    args.all_paths ? 'all paths' : 'marketing',
    ...(args.include_bots ? ['bots counted'] : [])
  ].join(' · ')
  console.error(`Traffic  ${host_flag}   ${dim(flags, err_color)}`)

  const synced = sync_traffic_cache({
    cache_path,
    project,
    host: args.host,
    days: args.days * args.buckets,
    all_paths: args.all_paths,
    cache_only: args.cache_only,
    refresh: args.refresh
  })

  const span =
    synced.bounds.oldest && synced.bounds.newest
      ? `${synced.bounds.oldest.slice(0, 10)} → ${synced.bounds.newest.slice(0, 10)}`
      : 'empty'
  const age = exists_sync(cache_path)
    ? `synced ${format_age(Date.now() - stat_sync(cache_path).mtimeMs)} ago`
    : 'no cache yet'
  console.error(dim(`${synced.cache_total} rows · ${span}`, err_color))
  console.error(
    dim(
      `${age} · +${synced.added} new · ${synced.pages} page(s)${args.cache_only ? ' · cache-only' : ''}`,
      err_color
    )
  )

  if (args.sample !== null) {
    const sample = synced.entries.slice(0, args.sample).map(simplify_entry)
    console.log(JSON.stringify(sample, null, 2))
    return
  }

  const color = stream_color(process.stdout)
  const now = new Date()
  const trend = aggregate_trend(synced.all_entries, {
    host: args.host,
    include_bots: args.include_bots,
    all_paths: args.all_paths,
    days: args.days,
    buckets: args.buckets,
    now,
    oldest: synced.bounds.oldest
  })

  console.log('')
  console.log(
    bold(`  ${args.host}`, color) +
      dim(`   ${args.days}d ending ${now.toISOString().slice(0, 10)}`, color)
  )
  console.log('')
  console.log(format_insight(trend, { days: args.days, color }))

  if (args.pages) {
    const current_since = trend[trend.length - 1].start
    const report = aggregate_entries(
      synced.all_entries.filter(
        row => typeof row.timestamp === 'string' && row.timestamp >= current_since
      ),
      {
        host: args.host,
        include_bots: args.include_bots,
        all_paths: args.all_paths
      }
    )
    console.log('')
    console.log(format_report(report, { color }))
  }

  if (args.by_day) {
    const by_day_rows = aggregate_by_day(synced.entries, {
      host: args.host,
      include_bots: args.include_bots,
      all_paths: args.all_paths,
      since: synced.since
    })
    console.log('')
    console.log(format_by_day(by_day_rows, undefined, { color }))
  }
}

const is_main =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(script_path)

if (is_main)
  try {
    await main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
