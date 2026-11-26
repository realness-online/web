#!/usr/bin/env node
/**
 * What the planning stack cost, per node, from the session pages.
 *
 *     node .pi/bin/prewalk/spend.js
 *     node .pi/bin/prewalk/spend.js --since 2026-11-07
 *     node .pi/bin/prewalk/spend.js --file vault/Sessions/<session>.html
 *
 * A session page holds one item per turn: model, tokens, cache read, cache
 * write, and cost. Prewalk's log holds when each node entered and left `active`,
 * so each turn is charged to the node that was active when it ran. This is the
 * measurement b1 asks for.
 */
import {
  existsSync as exists_sync,
  readFileSync as read_file_sync,
  readdirSync as readdir_sync,
  statSync as stat_sync
} from 'node:fs'
import { gunzipSync as gunzip_sync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { product_import } from '../lib/product.js'

const { read_items } = await product_import('items')
const root = resolve(file_url_to_path(new URL('../../..', import.meta.url)))
const SESSIONS = join(root, 'vault/Sessions')
const LOG = join(root, 'vault/Projects/realness-planning-performance/escalations.html')
const DAYS = 7
const MS_PER_DAY = 86_400_000
/** Models that are the cheap tier, matched on the model id. */
const CHEAP = /deepseek|luna|flash|haiku|mini/i
const ARTICLE = /<article[^>]*itemscope[^>]*itemtype="\/(sessions|prewalk)\/[a-z_]+"[\s\S]*?<\/article>/g
const USAGE = /<div itemprop="usage"[^>]*>([\s\S]*?)<div itemprop="cost"/
const TOOL_CALL = /itemprop="name">(\w+)<\/span><div itemprop="arguments"/g
const COST = /<div itemprop="cost"[^>]*>([\s\S]*?)<\/div>/

/**
 * A turn that read little but wrote the cache rewrote what it had cached.
 * @param {number} read
 * @param {number} write
 * @param {number} fresh
 * @returns {boolean}
 */
export const cold_cache = (read, write, fresh) => write > fresh && read < write / 4

/** @param {string} html @param {string} name */
const value = (html, name) => {
  const match = html.match(new RegExp(`itemprop="${name}"[^>]*>([^<]*)<`))
  return match ? match[1] : ''
}

/** @param {string} html */
const numbers = html => {
  const found = [...html.matchAll(/itemprop="(\w+)" value="([\d.]+)"/g)]
  return Object.fromEntries(found.map(([, key, number]) => [key, Number(number)]))
}

/**
 * Every turn a session page records.
 * @param {string} html
 * A turn is cold when it wrote the conversation again instead of reading the cache.
 * @returns {{ at: string, provider: string, model: string, input: number, output: number, cache_read: number, cache_write: number, cost: number, cost_write: number, tools: string[], batched: number, cold: boolean }[]}
 */
export const turns_from = html =>
  [...html.matchAll(ARTICLE)]
    .filter(([, kind, name]) => kind === 'sessions')
    .map(([article]) => article)
    .filter(article => article.includes('itemprop="usage"'))
    .map(article => {
      const usage = numbers((article.match(USAGE) ?? ['', ''])[1])
      const cost = numbers((article.match(COST) ?? ['', ''])[1])
      return {
        at: value(article, 'timestamp'),
        provider: value(article, 'provider'),
        model: value(article, 'model') || value(article, 'modelId'),
        input: usage.input ?? 0,
        output: usage.output ?? 0,
        cache_read: usage.cacheRead ?? 0,
        cache_write: usage.cacheWrite ?? 0,
        cost: Object.values(cost).reduce((sum, part) => sum + part, 0),
        cost_write: cost.cacheWrite ?? 0,
        tools: [...article.matchAll(TOOL_CALL)].map(([, name]) => name),
        batched: batched_of(article),
        cold: cold_cache(usage.cacheRead ?? 0, usage.cacheWrite ?? 0, (usage.input ?? 0) + (usage.output ?? 0))
      }
    })

/**
 * Tool calls one codemode turn ran, which one turn would have taken otherwise.
 * @param {string} article
 * @returns {number}
 */
const batched_of = article => {
  const code = article.match(/itemprop="code">([\s\S]*?)<\/pre>/)?.[1] ?? ''
  return [...code.matchAll(/tools\.\w+\(/g)].length
}

/** @param {string} model */
export const tier_of = model => (CHEAP.test(model) ? 'cheap' : 'frontier')

/**
 * Prewalk's starts and outcomes, oldest first.
 * @param {string} html
 * @returns {{ kind: string, plan: string, node: string, at: string, model: string, status: string, spec: string, escalated: string }[]}
 */
export const events_from = html =>
  [
    ...read_items(html, 'prewalk/start').map(fields => ({ ...fields, kind: 'start' })),
    ...read_items(html, 'prewalk/outcome').map(fields => ({ ...fields, kind: 'outcome' }))
  ]
    .map(fields => ({
      kind: fields.kind,
      plan: fields.plan ?? '',
      node: fields.node ?? '',
      at: fields.at ?? '',
      model: fields.model ?? '',
      status: fields.status ?? '',
      spec: fields.spec ?? '',
      escalated: fields.escalated ?? ''
    }))
    .sort((a, b) => a.at.localeCompare(b.at))

/**
 * A node's time under `active`: from its start item to its outcome item.
 * @param {ReturnType<typeof events_from>} events
 */
export const intervals_of = events => {
  /** @type {Map<string, ReturnType<typeof events_from>[number]>} */
  const open = new Map()
  const found = []
  for (const event of events) {
    const key = `${event.plan}\u0000${event.node}`
    if (event.kind === 'start') {
      open.set(key, event)
      continue
    }
    const start = open.get(key)
    if (!start) continue
    open.delete(key)
    found.push({
      plan: event.plan,
      node: event.node,
      model: start.model,
      start: start.at,
      end: event.at,
      status: event.status,
      spec: event.spec,
      escalated: event.escalated
    })
  }
  return found
}

/**
 * Charge each turn to the node that was active when it ran.
 * @param {(ReturnType<typeof turns_from>[number] & { session: string })[]} rows
 * @param {ReturnType<typeof intervals_of>} intervals
 */
export const charge = (rows, intervals) =>
  rows.map(row => {
    const match = intervals
      .filter(interval => interval.start <= row.at && row.at < interval.end)
      .sort((a, b) => b.start.localeCompare(a.start))[0]
    return match
      ? {
          ...row,
          plan: match.plan,
          node: match.node,
          status: match.status,
          spec: match.spec,
          escalated: match.escalated
        }
      : { ...row, plan: '', node: '', status: '', spec: '', escalated: '' }
  })

/** @param {{ cost: number, cache_read: number, cache_write: number }[]} rows */
const total_of = rows =>
  rows.reduce(
    (sum, row) => ({
      cost: sum.cost + row.cost,
      cache_read: sum.cache_read + row.cache_read,
      cache_write: sum.cache_write + row.cache_write
    }),
    { cost: 0, cache_read: 0, cache_write: 0 }
  )

/**
 * Cost per session page, and the split between the frontier and cheap tiers.
 * @param {(ReturnType<typeof turns_from>[number] & { session: string })[]} rows
 */
export const summarize = rows => {
  /** @type {Map<string, (ReturnType<typeof turns_from>[number] & { session: string })[]>} */
  const by_session = new Map()
  for (const row of rows) by_session.set(row.session, [...(by_session.get(row.session) ?? []), row])
  const groups = [...by_session].map(([session, list]) => {
    const frontier = list.filter(row => tier_of(row.model) === 'frontier')
    return {
      node: session,
      turns: list.length,
      frontier_turns: frontier.length,
      ...total_of(list)
    }
  })
  const total = total_of(rows)
  const frontier_cost = total_of(rows.filter(row => tier_of(row.model) === 'frontier')).cost
  return {
    groups: groups.sort((a, b) => b.cost - a.cost),
    total,
    frontier_share: total.cost ? frontier_cost / total.cost : 0,
    cache_ratio: total.cache_write ? total.cache_read / total.cache_write : 0
  }
}

/**
 * Cost per plan node, with the node's spec result from its outcome.
 * @param {ReturnType<typeof charge>} rows
 */
export const summarize_nodes = rows => {
  /** @type {Map<string, ReturnType<typeof charge>>} */
  const by_node = new Map()
  for (const row of rows) {
    const key = `${row.plan}\u0000${row.node}`
    by_node.set(key, [...(by_node.get(key) ?? []), row])
  }
  const groups = [...by_node].map(([, list]) => {
    const first = list[0]
    const frontier_cost = total_of(list.filter(row => tier_of(row.model) === 'frontier')).cost
    const total = total_of(list)
    return {
      plan: first.plan,
      node: first.node || '(no active node)',
      status: first.status,
      spec: first.spec || 'none',
      escalated: first.escalated || 'no',
      turns: list.length,
      frontier_turns: list.filter(row => tier_of(row.model) === 'frontier').length,
      frontier_share: total.cost ? frontier_cost / total.cost : 0,
      ...total
    }
  })
  return { groups: groups.sort((a, b) => b.cost - a.cost), total: total_of(rows) }
}

/**
 * Cost per model.
 * @param {ReturnType<typeof charge>} rows
 */
export const summarize_models = rows => {
  /** @type {Map<string, ReturnType<typeof charge>>} */
  const by_model = new Map()
  for (const row of rows) by_model.set(row.model, [...(by_model.get(row.model) ?? []), row])
  const groups = [...by_model].map(([model, list]) => ({ model, turns: list.length, ...total_of(list) }))
  return { groups: groups.sort((a, b) => b.cost - a.cost), total: total_of(rows) }
}

/** @param {ReturnType<typeof summarize_nodes>} summary */
export const render_nodes = summary => {
  const percent = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '0%')
  const money = number => `$${number.toFixed(2)}`
  const rows = summary.groups.map(
    group =>
      `| ${group.plan || '-'} | ${group.node} | ${group.spec} | ${group.escalated} | ${group.turns} | ${percent(group.frontier_share, 1)} of cost | ${group.cache_write.toLocaleString('en-US')} | ${group.cache_read.toLocaleString('en-US')} | ${money(group.cost)} |`
  )
  const passing = summary.groups.filter(group => group.spec === 'passed')
  const passing_cost = passing.reduce((sum, group) => sum + group.cost, 0)
  return [
    '| plan | node | spec | escalated | turns | frontier | cache write | cache read | cost |',
    '| ---- | ---- | ---- | --------- | ----- | -------- | ----------- | ---------- | ---- |',
    ...rows,
    '',
    `Passing nodes: ${passing.length}. Cost per passing node: ${money(passing.length ? passing_cost / passing.length : 0)}.`
  ].join('\n')
}

/** @param {ReturnType<typeof summarize_models>} summary */
export const render_models = summary => {
  const money = number => `$${number.toFixed(2)}`
  const rows = summary.groups.map(
    group =>
      `| ${group.model || '-'} | ${tier_of(group.model)} | ${group.turns} | ${group.cache_write.toLocaleString('en-US')} | ${group.cache_read.toLocaleString('en-US')} | ${money(group.cost)} |`
  )
  return [
    '| model | tier | turns | cache write | cache read | cost |',
    '| ----- | ---- | ----- | ----------- | ---------- | ---- |',
    ...rows
  ].join('\n')
}

/** @param {ReturnType<typeof summarize>} summary */
export const render = summary => {
  const percent = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '0%')
  const money = number => `$${number.toFixed(2)}`
  const rows = summary.groups.map(
    group =>
      `| ${group.node} | ${group.turns} | ${percent(group.frontier_turns, group.turns)} | ${group.cache_write.toLocaleString('en-US')} | ${group.cache_read.toLocaleString('en-US')} | ${money(group.cost)} |`
  )
  return [
    '| session | turns | frontier | cache write | cache read | cost |',
    '| ---- | ----- | -------- | ----------- | ---------- | ---- |',
    ...rows,
    `| total | ${summary.groups.reduce((sum, group) => sum + group.turns, 0)} | ${percent(summary.frontier_share, 1)} of cost | ${summary.total.cache_write.toLocaleString('en-US')} | ${summary.total.cache_read.toLocaleString('en-US')} | ${money(summary.total.cost)} |`,
    '',
    `Cache read per write: ${summary.cache_ratio.toFixed(1)}x. Frontier share of cost: ${percent(summary.frontier_share, 1)}.`
  ].join('\n')
}

/**
 * Session pages, newest first, from a date.
 * @param {string} dir
 * @param {string} since an ISO date
 */
export const pages = (dir, since) =>
  readdir_sync(dir)
    .filter(name => /\.html(\.gz)?$/.test(name) && !name.startsWith('collision-'))
    .map(name => join(dir, name))
    .filter(path => stat_sync(path).mtime.toISOString().slice(0, 10) >= since)

/** @param {string} path */
export const read_page = path => {
  const bytes = read_file_sync(path)
  const html = /\.gz$/.test(path) ? gunzip_sync(bytes).toString('utf8') : bytes.toString('utf8')
  return html
}

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const args = process.argv.slice(2)
  const at = args.indexOf('--since')
  const since = at >= 0 ? args[at + 1] : new Date(Date.now() - DAYS * MS_PER_DAY).toISOString().slice(0, 10)
  const file = args.includes('--file') ? args[args.indexOf('--file') + 1] : null
  const paths = file ? [resolve(file)] : pages(SESSIONS, since)
  const rows = paths.flatMap(path => {
    const session = path
      .split('/')
      .pop()
      .replace(/\.html(\.gz)?$/, '')
    return turns_from(read_page(path)).map(turn => ({ ...turn, session }))
  })
  const events = exists_sync(LOG) ? events_from(read_page(LOG)) : []
  const charged = charge(rows, intervals_of(events))
  process.stdout.write(`Sessions since ${since}: ${paths.length}; turns: ${rows.length}\n\n`)
  process.stdout.write(`## Sessions\n\n${render(summarize(rows))}\n\n`)
  process.stdout.write(`## Nodes\n\n${render_nodes(summarize_nodes(charged))}\n\n`)
  process.stdout.write(`## Models\n\n${render_models(summarize_models(rows))}\n`)
}
