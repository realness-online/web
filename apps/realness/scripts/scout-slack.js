#!/usr/bin/env node
/**
 * Post a scout's strong finds that no post has carried yet to its Slack
 * channel, then stamp them `posted` on the finds page. Silent when none wait.
 *
 *     node scripts/scout-slack.js seeq-leads
 *     node scripts/scout-slack.js seeq-leads --dry
 *
 * The webhook comes from SLACK_WEBHOOK_URL in `.env.local`.
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { load_finds, save_finds } from '../src/scouts/seen.js'
import { finds_path } from '../src/scouts/report.js'
import { find_scout, scout_pages } from '../src/scouts/scout.js'
import {
  mark_posted,
  post_slack,
  slack_text,
  unposted_finds
} from '../src/scouts/slack.js'
import { run_entry } from './lib/entry.js'

const here = resolve(dirname(file_url_to_path(import.meta.url)), '..')
const DATE_LENGTH = 10

/** @param {string} line */
const say = line => process.stdout.write(`${line}\n`)

await run_entry(import.meta.url, async () => {
  const args = process.argv.slice(2)
  const dry = args.includes('--dry')
  const [scout] = args.filter(arg => arg !== '--dry')
  if (!scout) throw new Error('Name the scout, like: seeq-leads')
  const page = find_scout(scout_pages(resolve(here, '../../vault')), scout)
  const label = page.path.split('/').at(-1) ?? page.path
  const path = finds_path(page.folder)
  const finds = await load_finds(path)
  const waiting = unposted_finds(finds)
  const text = slack_text(label, waiting)
  if (!text) return say('Nothing new to post.')
  if (dry) return say(text)
  process.loadEnvFile(resolve(here, '.env.local'))
  const webhook = process.env.SLACK_WEBHOOK_URL?.trim()
  if (!webhook) throw new Error('Add SLACK_WEBHOOK_URL to .env.local')
  await post_slack(webhook, text)
  const date = new Date().toISOString().slice(0, DATE_LENGTH)
  await save_finds(path, label, mark_posted(finds, waiting, date))
  say(`Posted ${waiting.length} finds.`)
})
