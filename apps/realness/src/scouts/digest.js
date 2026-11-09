import {
  rename,
  readFile as read_file,
  writeFile as write_file
} from 'node:fs/promises'
import { escape } from '#root/lib/items.js'

/** The score a lead is listed under; a whole number stays whole. */
const score_of = lead =>
  Number.isInteger(lead.score) ? String(lead.score) : lead.score.toFixed(1)

/** A lead's name: its org, else its title, else the host its link names. */
const name_of = lead => lead.org || lead.title || new URL(lead.url).host

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]

/** A day as the digest heads it: `Nov 8`, from an ISO date. */
export const day_label = date => {
  const [, month, day] = date.split('-').map(Number)
  return `${MONTHS[month - 1]} ${day}`
}

/** The leads the digest scores above the dimmed line. */
const SCORED = 6

/** One lead's row. */
const row = lead =>
  `<tr><td>${score_of(lead)}</td><td><a href="${escape(lead.url)}">${escape(name_of(lead))}</a></td><td>${escape(lead.reason)}</td></tr>`

/** One day of finds, as the plan's digest shows it. */
export const digest_block = ({ date, leads }) => {
  const above = leads.filter(lead => lead.score >= SCORED)
  const below = leads.filter(lead => lead.score < SCORED)
  const count = `${leads.length} ${leads.length === 1 ? 'lead' : 'leads'}`
  const bodies = [above, below]
    .filter(group => group.length)
    .map(group => `<tbody>\n${group.map(row).join('\n')}\n</tbody>`)
    .join('\n')
  const table = bodies
    ? `<table>\n<thead><tr><th>score</th><th>lead</th><th>why</th></tr></thead>\n${bodies}\n</table>\n`
    : ''
  return `<details>\n<summary><strong>${day_label(date)}</strong> <span>${count}</span></summary>\n${table}</details>`
}

const FINDS = /^### Finds\s*$/m

/** A day's block, as the plan already holds it, or null. */
const block_of = (markdown, date) =>
  (markdown.match(/<details>[\s\S]*?<\/details>/g) ?? []).find(block =>
    block.includes(`<summary><strong>${day_label(date)}</strong>`)
  ) ?? null

/**
 * The plan's markdown with one day's finds in its `### Finds` section, newest
 * first. A second run the same day replaces the day's block; every other day
 * stays as it was. A plan with no `### Finds` section keeps its text.
 * @param {string} markdown
 * @param {string} block
 * @param {string} date ISO date
 */
export const with_digest = (markdown, block, date) => {
  const heading = markdown.match(FINDS)
  if (!heading) return markdown
  const found = block_of(markdown, date)
  if (found) return markdown.replace(found, block)
  const start = (heading.index ?? 0) + heading[0].length
  const first = markdown.slice(start).indexOf('<details>')
  if (first === -1)
    return `${markdown.slice(0, start)}\n\n${block}\n${markdown.slice(start).trimStart()}`
  const at = start + first
  return `${markdown.slice(0, at)}${block}\n\n${markdown.slice(at)}`
}

/** Write a run's finds into its plan's digest, whole or not at all. */
export const save_digest = async (plan_path, { date, leads }) => {
  const markdown = await read_file(plan_path, 'utf8').catch(error => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (markdown === null) return false
  const next = with_digest(markdown, digest_block({ date, leads }), date)
  if (next === markdown) return false
  const tmp = `${plan_path}.tmp`
  await write_file(tmp, next)
  await rename(tmp, plan_path)
  return true
}
