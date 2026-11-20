#!/usr/bin/env node
/**
 * Work prewalk took from Anthropic, per week: DeepSeek tokens in the sessions
 * prewalk ran, as a share of Anthropic tokens, and how many tool calls went
 * through codemode, how many sessions a session gap started, how many turns
 * there were, how much of Claude's cache writing rewrote a cold cache, and the
 * tokens session gaps saved. Weeks start at Tuesday's reset;
 * Monday 3 pm to Tuesday 10 am, Pacific, is left out.
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
const LOG = join(root, 'artifacts/prewalk/escalations.html')
const PACIFIC = 8 * 3_600_000
const MS_PER_DAY = 86_400_000
const ANTHROPIC = /claude|opus|fable|sonnet|mythos/i
const CHEAP = /deepseek/i

/** @param {Date} local */
export const in_burn = local =>
  (local.getUTCDay() === 1 && local.getUTCHours() >= 15) || (local.getUTCDay() === 2 && local.getUTCHours() < 10)

/** @param {Date} local */
export const week_of = local =>
  new Date(local.getTime() - ((local.getUTCDay() + 5) % 7) * MS_PER_DAY).toISOString().slice(0, 10)

/** @param {string} since */
export const taken = since => {
  const prewalked = new Set(
    [...read_file_sync(LOG, 'utf8').matchAll(/itemprop="session">([^<]+)</g)].map(match => match[1])
  )
  /** @type {Record<string, { anthropic: number, prewalk: number, other: number, calls: number, codemode: number, gaps: number, turns: number, anthropic_write: number, cold_writes: number, anthropic_read: number, anthropic_turns: number, prunes: number, cold_turns: number, saved_gap: number, saved_prewalk: number, saved_codemode: number }>} */
  const weeks = {}
  const all = readdir_sync(SESSIONS)
  /** @param {string} path */
  const last_context = path => {
    const stem = basename(path).replace(/\.html(\.gz)?$|\.jsonl$/, '')
    const name = all.find(file => file.startsWith(`${stem}.`))
    if (!name) return 0
    const raw = read_file_sync(join(SESSIONS, name))
    const turn = turns_from((name.endsWith('.gz') ? gunzip_sync(raw) : raw).toString()).at(-1)
    return turn ? turn.input + turn.output + turn.cache_read + turn.cache_write : 0
  }
  const files = all.filter(name => name >= since && /\.html(\.gz)?$/.test(name))
  for (const name of files) {
    const session = name.replace(/\.html(\.gz)?$/, '').split('_')[1]
    const raw = read_file_sync(join(SESSIONS, name))
    const html = (name.endsWith('.gz') ? gunzip_sync(raw) : raw).toString()
    const before = html.match(/itemprop="customType">session-gap<[\s\S]*?This session continues (\S+?),/)?.[1]
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
      const local = new Date(at - PACIFIC)
      if (in_burn(local) || local.toISOString().slice(0, 10) < since) continue
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
        saved_codemode: 0
      })
      if (gap) {
        week.gaps++
        week.saved_gap += Math.max(0, stale - turn.input - turn.cache_write)
      }
      gap = false
      week.turns++
      week.calls += turn.tools.length
      week.codemode += turn.tools.filter(tool => tool === 'codemode').length
      const tokens = turn.input + turn.output + turn.cache_read + turn.cache_write
      if (ANTHROPIC.test(turn.model)) {
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
        const cheap = prewalked.has(session) ? 'prewalk' : 'other'
        week[cheap] += tokens
        if (cheap === 'prewalk') week.saved_prewalk += tokens
      }
    }
    for (const at of edits) {
      const local = new Date(Date.parse(at) - PACIFIC)
      if (in_burn(local) || local.toISOString().slice(0, 10) < since) continue
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
