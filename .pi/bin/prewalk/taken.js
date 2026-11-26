#!/usr/bin/env node
/**
 * Work prewalk took from Anthropic, per week: DeepSeek tokens in the sessions
 * prewalk ran, as a share of Anthropic tokens, and how many tool calls went
 * through codemode, how many sessions a session gap started, how many turns
 * there were, how much of Claude's cache writing rewrote a cold cache, and the
 * tokens session gaps saved. Tokens are weighted as the cap counts them.
 * Weeks run Tuesday 10 am to Tuesday 10 am, Pacific, when the cap resets.
 *
 *     node .pi/bin/prewalk/taken.js
 *     node .pi/bin/prewalk/taken.js --since 2026-11-03
 */
import { readdirSync as readdir_sync, readFileSync as read_file_sync } from 'node:fs'
import { gunzipSync as gunzip_sync } from 'node:zlib'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { turns_from } from './spend.js'

const root = resolve(file_url_to_path(new URL('../../..', import.meta.url)))
const SESSIONS = join(root, 'vault/Sessions')
const LOG = join(root, 'vault/Projects/realness-planning-performance/escalations.html')
const PACIFIC = 8 * 3_600_000
const RESET = 10 * 3_600_000
const MS_PER_DAY = 86_400_000
const ANTHROPIC = /claude|opus|fable|sonnet|mythos/i
const CHEAP = /deepseek/i
const READ = 0.1
const WRITE = 1.25

/** @param {{ input: number, output: number, cache_read: number, cache_write: number }} turn */
export const weighted = turn => turn.input + turn.output + READ * turn.cache_read + WRITE * turn.cache_write

/**
 * A moment as the clock of the cap's week: Pacific, shifted so Tuesday 10 am,
 * when the cap resets, reads as the week's first moment.
 * @param {number} at
 */
export const local_of = at => new Date(at - PACIFIC - RESET)

/** @param {Date} local */
export const week_of = local =>
  new Date(local.getTime() - ((local.getUTCDay() + 5) % 7) * MS_PER_DAY).toISOString().slice(0, 10)

/**
 * When prewalk first took each session, from its log.
 * @param {string} log
 */
export const starts_from = log => {
  /** @type {Map<string, number>} */
  const starts = new Map()
  for (const [article] of log.matchAll(/<article[\s\S]*?<\/article>/g)) {
    const session = article.match(/itemprop="session">([^<]+)</)?.[1]
    const at = Date.parse(article.match(/datetime="([^"]+)"/)?.[1] ?? '')
    if (session && at) starts.set(session, Math.min(at, starts.get(session) ?? at))
  }
  return starts
}

/**
 * When prewalk first marked a session page, or 0.
 * @param {string} html
 */
export const marked_at = html =>
  Date.parse(
    html.match(
      /itemtype="\/sessions\/custom"[^>]*><span itemprop="customType">prewalk<[\s\S]*?itemprop="timestamp">([^<]+)</
    )?.[1] ?? ''
  ) || 0

/**
 * Anthropic's weekly meter marks on a session page, in order.
 * @param {string} html
 */
export const meters_from = html =>
  [
    ...html.matchAll(/itemtype="\/sessions\/custom"[^>]*><span itemprop="customType">cap-meter<([\s\S]*?)<\/article>/g)
  ].map(([, body]) => ({
    at: Date.parse(body.match(/itemprop="timestamp">([^<]+)</)?.[1] ?? ''),
    billing: body.match(/itemprop="billing"[^>]*>([^<]*)</)?.[1],
    used: Number(body.match(/itemprop="used"[^>]*value="([^"]*)"/)?.[1] ?? NaN),
    reset: body.match(/itemprop="reset"[^>]*value="([^"]*)"/)?.[1] ?? ''
  }))

/**
 * Cap used across a week's meters: the highest reading of each meter, added.
 * A reset starts a new meter, so a week with one reads above 100%.
 * @param {Record<string, number>} highs
 */
export const cap_of = highs => Object.values(highs).reduce((sum, high) => sum + high, 0)

/** @param {string} since */
export const taken = since => {
  const starts = starts_from(read_file_sync(LOG, 'utf8'))
  /** @type {Record<string, { anthropic: number, prewalk: number, other: number, calls: number, codemode: number, gaps: number, turns: number, anthropic_write: number, cold_writes: number, anthropic_read: number, anthropic_turns: number, prunes: number, cold_turns: number, saved_gap: number, saved_prewalk: number, saved_codemode: number, credits: number, highs: Record<string, number> }>} */
  const weeks = {}
  const all = readdir_sync(SESSIONS)
  /** @param {string} path */
  const last_context = path => {
    const stem = basename(path).replace(/\.html(\.gz)?$|\.jsonl$/, '')
    const name = all.find(file => file.startsWith(`${stem}.`))
    if (!name) return 0
    const raw = read_file_sync(join(SESSIONS, name))
    const turn = turns_from((name.endsWith('.gz') ? gunzip_sync(raw) : raw).toString()).at(-1)
    return turn ? turn.input + turn.cache_read + turn.cache_write : 0
  }
  const files = all.filter(name => name >= since && /\.html(\.gz)?$/.test(name))
  for (const name of files) {
    const session = name.replace(/\.html(\.gz)?$/, '').split('_')[1]
    const raw = read_file_sync(join(SESSIONS, name))
    const html = (name.endsWith('.gz') ? gunzip_sync(raw) : raw).toString()
    const before = html.match(/itemprop="customType">session-gap<[\s\S]*?This session continues (\S+?),/)?.[1]
    const took = marked_at(html) || starts.get(session) || Infinity
    const meters = meters_from(html)
    let gap = Boolean(before)
    const stale = before ? last_context(before) : 0
    const edits = [
      ...html.matchAll(
        /<article itemscope itemtype="\/sessions\/context_edit"[^>]*>[\s\S]*?<span itemprop="timestamp">([^<]+)<\/span>[\s\S]*?<\/article>/g
      )
    ]
      .filter(([article]) => article.includes('output pruned'))
      .map(([, at]) => at)
    for (const turn of turns_from(html)) {
      const at = Date.parse(turn.at)
      if (!at) continue
      const local = local_of(at)
      if (local.toISOString().slice(0, 10) < since) continue
      const week = (weeks[week_of(local)] ??= {
        anthropic: 0,
        prewalk: 0,
        other: 0,
        calls: 0,
        codemode: 0,
        gaps: 0,
        turns: 0,
        anthropic_write: 0,
        anthropic_read: 0,
        anthropic_turns: 0,
        cold_writes: 0,
        prunes: 0,
        cold_turns: 0,
        saved_gap: 0,
        saved_prewalk: 0,
        saved_codemode: 0,
        credits: 0,
        highs: {}
      })
      if (gap) {
        week.gaps++
        week.saved_gap += Math.max(0, WRITE * stale - turn.input - WRITE * turn.cache_write)
      }
      gap = false
      week.turns++
      week.calls += turn.tools.length
      week.codemode += turn.tools.filter(tool => tool === 'codemode').length
      const tokens = weighted(turn)
      if (ANTHROPIC.test(turn.model)) {
        const meter = meters.findLast(mark => mark.at <= at)
        if (meter?.billing === 'credits') {
          week.credits += tokens
          continue
        }
        if (meter && Number.isFinite(meter.used))
          week.highs[meter.reset] = Math.max(week.highs[meter.reset] ?? 0, meter.used)
        week.anthropic += tokens
        week.anthropic_write += turn.cache_write
        week.anthropic_read += turn.cache_read
        week.anthropic_turns++
        week.saved_codemode += Math.max(0, turn.batched - 1) * tokens
        if (turn.cold) {
          week.cold_writes += turn.cache_write
          week.cold_turns++
        }
      } else if (CHEAP.test(turn.model)) {
        const cheap = at >= took ? 'prewalk' : 'other'
        week[cheap] += tokens
        if (cheap === 'prewalk') week.saved_prewalk += tokens
      }
    }
    for (const at of edits) {
      const local = local_of(Date.parse(at))
      if (local.toISOString().slice(0, 10) < since) continue
      const week = weeks[week_of(local)]
      if (week) week.prunes++
    }
  }
  return weeks
}

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const args = process.argv.slice(2)
  const at = args.indexOf('--since')
  const since = at >= 0 ? args[at + 1] : new Date(Date.now() - 28 * MS_PER_DAY).toISOString().slice(0, 10)
  const millions = n => `${Math.round(n / 1e6)}M`
  console.log('| week from | Anthropic | DeepSeek via prewalk | other DeepSeek | extra work |')
  console.log('| --- | --- | --- | --- | --- |')
  for (const [week, v] of Object.entries(taken(since)).sort())
    console.log(
      `| ${week} | ${millions(v.anthropic)} | ${millions(v.prewalk)} | ${millions(v.other)} | ${v.anthropic ? Math.round((100 * v.prewalk) / v.anthropic) : 0}% |`
    )
}
