#!/usr/bin/env node
/**
 * Cold turns by cause, from the cold-watch page: a cold turn after a changed
 * request shape is ours, after the same shape it is the provider's.
 *
 *     node .pi/bin/prewalk/cold.js
 *     node .pi/bin/prewalk/cold.js --since 2026-11-17
 */
import { existsSync as exists_sync, readFileSync as read_file_sync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { product_import } from '../lib/product.js'

const { read_items } = await product_import('items')
const root = resolve(file_url_to_path(new URL('../../..', import.meta.url)))
const FILE = join(root, 'artifacts/prewalk/cold.html')

/**
 * Cold turns per day: whose they are, and the write tokens they paid.
 * @param {string} html
 * @param {string} since
 */
export const summary = (html, since = '') => {
  const days = {}
  for (const item of read_items(html, 'cold-watch/turn')) {
    const day = (item.at ?? '').slice(0, 10)
    if (!day || day < since) continue
    const counts = (days[day] ??= { changed: 0, same: 0, written: 0 })
    if (item.cold !== 'yes') continue
    counts.written += Number(item.write ?? 0)
    if (item.shape === 'changed') counts.changed++
    else counts.same++
  }
  return days
}

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const args = process.argv.slice(2)
  const at = args.indexOf('--since')
  const since = at >= 0 ? args[at + 1] : ''
  if (!exists_sync(FILE)) {
    console.log('No cold turns recorded yet; the page appears on the first one.')
    process.exit(0)
  }
  const days = Object.entries(summary(read_file_sync(FILE, 'utf8'), since)).sort()
  console.log('| day | ours | provider | write tokens |')
  console.log('| --- | --- | --- | --- |')
  for (const [day, counts] of days)
    console.log(`| ${day} | ${counts.changed} | ${counts.same} | ${Math.round(counts.written / 1e3)}k |`)
  console.log(`${days.length} day(s) recorded.`)
}
