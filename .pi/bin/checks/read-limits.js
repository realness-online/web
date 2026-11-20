#!/usr/bin/env node
/**
 * Read limits: counts direct reads taken whole and direct `cat` calls, per week,
 * from the session pages. Cache reads are most of every turn, so a whole file
 * read once costs its size on every later turn of that session.
 *
 *     node .pi/bin/checks/read-limits.js
 *     node .pi/bin/checks/read-limits.js --since 2026-11-03
 */
import { readdirSync as readdir_sync, readFileSync as read_file_sync } from 'node:fs'
import { gunzipSync as gunzip_sync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'

const root = resolve(file_url_to_path(new URL('../../..', import.meta.url)))
const SESSIONS = join(root, 'vault/Sessions')
const MS_PER_DAY = 86_400_000
const PACIFIC = 8 * 3_600_000
const CALL = /<span itemprop="name">(\w+)<\/span><div itemprop="arguments" itemscope>([\s\S]*?)<\/div><\/div>/g
const STAMP = /<span itemprop="timestamp">([^<]+)<\/span>/

/** @param {Date} local */
export const week_of = local =>
  new Date(local.getTime() - ((local.getUTCDay() + 5) % 7) * MS_PER_DAY).toISOString().slice(0, 10)

/**
 * One tool call, as the page records it.
 * @param {string} name
 * @param {string} args
 */
export const flag_of = (name, args) => {
  if (name === 'read') return /itemprop="limit" value="\d+"/.test(args) ? null : 'whole file'
  if (name !== 'bash') return null
  const command = args.match(/<pre itemprop="command">([\s\S]*?)<\/pre>/)?.[1] ?? ''
  return /(^|[;&|]\s*)cat\s/.test(command.replace(/&#10;/g, '\n')) ? 'cat' : null
}

/**
 * Flagged calls per week, oldest first.
 * @param {string} since
 */
export const counted = since => {
  const weeks = {}
  for (const name of readdir_sync(SESSIONS).filter(file => file >= since && /\.html(\.gz)?$/.test(file))) {
    const raw = read_file_sync(join(SESSIONS, name))
    const html = (name.endsWith('.gz') ? gunzip_sync(raw) : raw).toString()
    const at = html.match(STAMP)?.[1] ?? ''
    const local = new Date(Date.parse(at) - PACIFIC)
    if (!at || local.toISOString().slice(0, 10) < since) continue
    const week = (weeks[week_of(local)] ??= { calls: 0, reads: 0, whole: 0, cat: 0 })
    for (const [, call, args] of html.matchAll(CALL)) {
      week.calls++
      const flag = flag_of(call, args)
      if (call === 'read') week.reads++
      if (flag === 'whole file') week.whole++
      if (flag === 'cat') week.cat++
    }
  }
  return weeks
}

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const args = process.argv.slice(2)
  const at = args.indexOf('--since')
  const since = at >= 0 ? args[at + 1] : new Date(Date.now() - 28 * MS_PER_DAY).toISOString().slice(0, 10)
  const weeks = Object.entries(counted(since)).sort()
  const total = weeks.reduce((sum, [, v]) => sum + v.whole + v.cat, 0)
  console.log('| week from | tool calls | whole-file reads | cat calls |')
  console.log('| --- | --- | --- | --- |')
  for (const [week, v] of weeks) console.log(`| ${week} | ${v.calls} | ${v.whole} | ${v.cat} |`)
  console.log(`${total} flagged call(s) since ${since}.`)
}
