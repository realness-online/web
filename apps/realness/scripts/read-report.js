#!/usr/bin/env node
/**
 * `npm run read:report [day]` counts this Mac's realness-read log by outcome.
 * `npm run read:prune` drops pages unread for 30 days.
 */
import {
  readdirSync as read_dir_sync,
  readFileSync as read_file_sync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { WebEngine, engine_report } from '../src/halo/web-engine.js'
import { run_entry } from './lib/entry.js'

const DAY_LENGTH = 10

const root = resolve(
  dirname(file_url_to_path(import.meta.url)),
  '../../../artifacts/realness-read'
)

/** @param {string[]} [args] */
export const main = (args = process.argv.slice(2)) => {
  if (args.includes('--prune')) {
    process.stdout.write(
      `realness-read prune: dropped ${new WebEngine({ root }).prune()} pages\n`
    )
    return
  }
  const day =
    args.find(arg => !arg.startsWith('--')) ??
    new Date().toISOString().slice(0, DAY_LENGTH)
  const files = read_dir_sync(join(root, 'log')).filter(file =>
    file.startsWith(day)
  )
  const lines = files.flatMap(file =>
    read_file_sync(join(root, 'log', file), 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line))
  )
  process.stdout.write(`${JSON.stringify(engine_report(lines), null, 2)}\n`)
}

await run_entry(import.meta.url, main)
