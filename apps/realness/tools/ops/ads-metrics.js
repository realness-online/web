/**
 * Pull daily OpenAI Ads metrics (impressions, clicks, spend) and line them up
 * against Realness marketing-page traffic from hosting-traffic.js.
 *
 * Operator CLI (not a Cloud Function). Requires OPENAI_ADS_API_KEY, issued in
 * Ads Manager (ads.openai.com) under Settings, scoped to one ad account.
 * Metrics only -- no Conversions API / pixel involved.
 *
 * Usage (from repo root):
 *   npm run ads
 *   npm run ads -- --days 30
 *   npm run ads -- --cache-only   (traffic side reads its local archive only)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import {
  aggregate_by_day,
  bold,
  by_day_paths,
  default_cache_path,
  default_host,
  default_project_id,
  dim,
  each_utc_day,
  format_age,
  green,
  http_request_from_entry,
  is_bot_ua,
  is_document_hit,
  stream_color,
  sync_traffic_cache,
  yellow
} from './hosting-traffic.js'

const script_path = file_url_to_path(import.meta.url)
const ads_api_base = 'https://api.ads.openai.com/v1'
const default_days = 7
const default_topic_param = 'topic'
const raw_metric_fields = ['impressions', 'clicks', 'spend']

const help_text = `Line up OpenAI Ads daily metrics against Realness marketing-page traffic.

Ads API: account-level insights (impressions, clicks, spend, ctr, cpc, cpm).
Traffic: Firebase Hosting logs for /, /about, /pricing (via hosting-traffic.js).
No Conversions API / pixel here -- metrics-only tracking.

Requires OPENAI_ADS_API_KEY (Ads Manager -> Settings -> API key).

Usage:
  npm run ads
  npm run ads -- --days 30
  npm run ads -- --cache-only
  npm run ads -- --help

Options:
  --days N          Lookback window in days (default: ${default_days})
  --project ID      GCP project for the traffic side (default: production from .firebaserc)
  --host HOST       Hostname filter for the traffic side (default: ${default_host})
  --topic-param P   Query param that marks ad-driven landings (default: ${default_topic_param})
  --cache-only      Traffic side reads its local JSONL archive; skips gcloud
  --refresh         Traffic side re-fetches the lookback window fully
  --help            Show this help
`

/**
 * @param {string[]} argv
 */
export const parse_args = (argv = process.argv.slice(2)) => {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.info(help_text)
    process.exit(0)
  }

  /** @type {{ days: number, project: string | null, host: string, topic_param: string, cache_only: boolean, refresh: boolean }} */
  const opts = {
    days: default_days,
    project: null,
    host: default_host,
    topic_param: default_topic_param,
    cache_only: false,
    refresh: false
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]
    if (arg === '--days' && next) opts.days = Number(argv[++i])
    else if (arg === '--project' && next) opts.project = argv[++i]
    else if (arg === '--host' && next) opts.host = argv[++i]
    else if (arg === '--topic-param' && next) opts.topic_param = argv[++i]
    else if (arg === '--cache-only') opts.cache_only = true
    else if (arg === '--refresh') opts.refresh = true
    else throw new Error(`Unknown argument: ${arg}`)
  }

  if (!Number.isFinite(opts.days) || opts.days <= 0)
    throw new Error('--days must be a positive number')
  if (opts.cache_only && opts.refresh)
    throw new Error('Use either --cache-only or --refresh, not both')

  return opts
}

/**
 * YYYY-MM-DD, UTC. The ads request pins timezone to UTC so these line up
 * with hosting-traffic.js, which buckets days in UTC.
 * @param {Date} date
 */
const utc_date_str = date => date.toISOString().slice(0, 10)

/**
 * @param {Record<string, unknown>} row
 * @param {string} name
 */
const metric_value = (row, name) => {
  const raw =
    row[name] ?? row[`ad_account.${name}`] ?? row[`ad_account_${name}`]
  const num = Number(raw)
  return Number.isFinite(num) ? num : 0
}

/**
 * @param {string} api_key
 * @returns {Promise<string>} IANA timezone, e.g. "America/Los_Angeles"
 */
export const fetch_ad_account_timezone = async api_key => {
  const response = await fetch(`${ads_api_base}/ad_account`, {
    headers: { Authorization: `Bearer ${api_key}`, Accept: 'application/json' }
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Ads API ${response.status}: ${body || response.statusText}`
    )
  }
  const payload = await response.json()
  return payload.timezone || 'UTC'
}

/**
 * Calendar day (YYYY-MM-DD) a Unix-seconds timestamp falls on, in tz.
 * @param {number} unix_seconds
 * @param {string} tz
 */
const day_in_tz = (unix_seconds, tz) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(
    new Date(unix_seconds * 1000)
  )

/**
 * @param {string | undefined} request_url
 * @param {string} param_name
 */
const query_param_value = (request_url, param_name) => {
  if (!request_url) return null
  try {
    return new URL(request_url).searchParams.get(param_name)
  } catch {
    return null
  }
}

/**
 * @param {unknown} entry
 */
const record_day = entry => {
  const record = /** @type {Record<string, unknown>} */ (entry)
  const ts = record.timestamp
  return typeof ts === 'string' ? ts.slice(0, 10) : null
}

/**
 * Human hits on any marketing page per UTC day that carry `topic_param` in
 * the query string -- i.e. landings traceable back to an ad via its
 * landing-page query parameter, regardless of which page they hit.
 *
 * @param {unknown[]} entries
 * @param {{ host: string, topic_param: string, since: string }} options
 * @returns {Map<string, number>} keyed by YYYY-MM-DD (UTC)
 */
export const aggregate_topic_hits_by_day = (
  entries,
  { host, topic_param, since }
) => {
  /** @type {Map<string, number>} */
  const by_day = new Map()
  for (const day of each_utc_day(since)) by_day.set(day, 0)

  for (const entry of entries) {
    const http_request = http_request_from_entry(entry)
    if (!http_request) continue
    if (!is_document_hit(http_request, { host, all_paths: false })) continue
    if (is_bot_ua(String(http_request.userAgent ?? ''))) continue
    if (!query_param_value(String(http_request.requestUrl ?? ''), topic_param))
      continue

    const day = record_day(entry)
    if (day && by_day.has(day)) by_day.set(day, (by_day.get(day) ?? 0) + 1)
  }

  return by_day
}

/**
 * Fetch hourly ad_account insights and sum them into UTC calendar days --
 * matching how hosting-traffic.js buckets site traffic. Hour boundaries are
 * absolute (Unix seconds), so this sidesteps the account-timezone seam
 * daily-granularity rows would otherwise introduce.
 *
 * @param {{ api_key: string, since: string, until: string }} options
 * @returns {Promise<Map<string, Record<string, number>>>} keyed by YYYY-MM-DD (UTC)
 */
export const fetch_ads_daily_metrics = async ({ api_key, since, until }) => {
  /** @type {Map<string, { impressions: number, clicks: number, spend: number }>} */
  const raw_by_utc_day = new Map()
  let after = null

  while (true) {
    const params = new URLSearchParams()
    params.append('time_granularity', 'hourly')
    params.append('aggregation_level', 'ad_account')
    for (const field of raw_metric_fields)
      params.append('fields[]', `ad_account.${field}`)
    params.append(
      'time_ranges[]',
      JSON.stringify({ type: 'date_range', since, until })
    )
    params.append('limit', '500')
    if (after) params.append('after', after)

    const response = await fetch(
      `${ads_api_base}/ad_account/insights?${params}`,
      {
        headers: {
          Authorization: `Bearer ${api_key}`,
          Accept: 'application/json'
        }
      }
    )

    if (!response.ok) {
      const body = await response.text()
      throw new Error(
        `Ads API ${response.status}: ${body || response.statusText}`
      )
    }

    const payload = await response.json()
    for (const row of payload.data ?? []) {
      if (typeof row.start_time !== 'number') continue
      const date = day_in_tz(row.start_time, 'UTC')
      const existing = raw_by_utc_day.get(date) ?? {
        impressions: 0,
        clicks: 0,
        spend: 0
      }
      existing.impressions += metric_value(row, 'impressions')
      existing.clicks += metric_value(row, 'clicks')
      existing.spend += metric_value(row, 'spend')
      raw_by_utc_day.set(date, existing)
    }

    if (!payload.has_more) break
    after = payload.last_id
  }

  /** @type {Map<string, Record<string, number>>} */
  const by_date = new Map()
  for (const [date, totals] of raw_by_utc_day)
    by_date.set(date, {
      ...totals,
      ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      cpm:
        totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
    })

  return by_date
}

/**
 * @param {Map<string, Record<string, number>>} ads_by_date
 * @param {ReturnType<typeof aggregate_by_day>} traffic_rows
 * @param {Map<string, number>} topic_by_date
 * @param {string} topic_param
 */
export const format_combined_report = (
  ads_by_date,
  traffic_rows,
  topic_by_date,
  topic_param,
  { color = false } = {}
) => {
  const site_labels = by_day_paths.map(p => (p === '/' ? 'home' : p.slice(1)))
  const headers = [
    'Day',
    'Impr',
    'Clicks',
    'Spend',
    'CTR',
    'CPC',
    'CPM',
    ...site_labels,
    `${topic_param}=`
  ]

  const rows = traffic_rows.map(row => {
    const ads = ads_by_date.get(row.day) ?? {}
    return [
      row.day,
      String(ads.impressions ?? 0),
      String(ads.clicks ?? 0),
      (ads.spend ?? 0).toFixed(2),
      `${((ads.ctr ?? 0) * 100).toFixed(2)}%`,
      (ads.cpc ?? 0).toFixed(2),
      (ads.cpm ?? 0).toFixed(2),
      ...by_day_paths.map(p => String(row.paths[p]?.humans ?? 0)),
      String(topic_by_date.get(row.day) ?? 0)
    ]
  })

  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => r[i].length))
  )
  const render = cells =>
    cells
      .map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i])))
      .join('  ')

  const lines = [
    bold(render(headers), color),
    dim(widths.map(w => '-'.repeat(w)).join('  '), color)
  ]
  for (const row of rows) lines.push(render(row))
  lines.push('')
  lines.push(
    dim(
      `${site_labels.join('/')} = human page hits, bots excluded.  ${topic_param}= = hits carrying ?${topic_param}=.`,
      color
    )
  )
  return lines.join('\n')
}

const main = async () => {
  const args = parse_args()
  const api_key = process.env.OPENAI_ADS_API_KEY
  if (!api_key)
    throw new Error(
      'OPENAI_ADS_API_KEY is not set. Generate one in Ads Manager (ads.openai.com) -> Settings.'
    )

  const project = args.project ?? default_project_id()
  const cache_path = default_cache_path(project, args.host, false)

  const ads_tz = await fetch_ad_account_timezone(api_key)
  const day_ms = 24 * 60 * 60 * 1000
  const today_tz = day_in_tz(Date.now() / 1000, ads_tz)
  const today_tz_utc_midnight = new Date(`${today_tz}T00:00:00Z`).getTime()
  const until = utc_date_str(new Date(today_tz_utc_midnight - day_ms))
  const since = utc_date_str(
    new Date(today_tz_utc_midnight - (args.days + 1) * day_ms)
  )

  const err_color = stream_color(process.stderr)
  const host_flag =
    args.host === default_host
      ? green(args.host, err_color)
      : yellow(args.host, err_color)

  console.error(
    `Ads  ${since}..${until}  ${dim(`(UTC days · acct tz ${ads_tz})`, err_color)}`
  )
  const ads_by_date = await fetch_ads_daily_metrics({ api_key, since, until })

  console.error(`Traffic  ${host_flag}`)
  const synced = sync_traffic_cache({
    cache_path,
    project,
    host: args.host,
    days: args.days,
    all_paths: false,
    cache_only: args.cache_only,
    refresh: args.refresh
  })

  const synced_age = fs.existsSync(cache_path)
    ? `synced ${format_age(Date.now() - fs.statSync(cache_path).mtimeMs)} ago`
    : 'no cache yet'
  console.error(
    dim(
      `${synced_age}  ·  ${synced.added} new, ${synced.cache_total} cached`,
      err_color
    )
  )
  const traffic_rows = aggregate_by_day(synced.entries, {
    host: args.host,
    include_bots: false,
    all_paths: false,
    since: synced.since
  })
  const topic_by_date = aggregate_topic_hits_by_day(synced.entries, {
    host: args.host,
    topic_param: args.topic_param,
    since: synced.since
  })

  const out_color = stream_color(process.stdout)
  console.log(
    format_combined_report(
      ads_by_date,
      traffic_rows,
      topic_by_date,
      args.topic_param,
      { color: out_color }
    )
  )
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
