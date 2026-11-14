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

/** One digest row, as the plan holds it: score, link, why. */
const ROW =
  /<tr><td>([^<]*)<\/td><td><a href="([^"]*)">([\s\S]*?)<\/a><\/td><td>([\s\S]*?)<\/td><\/tr>/g

/** A day's rows, read back out of its block. Text stays as the page escapes it. */
const digest_rows = block =>
  [...String(block ?? '').matchAll(ROW)].map(
    ([, score, url, name, reason]) => ({
      score,
      url,
      name,
      reason
    })
  )

/** A row as the plan holds it. */
const row_of = ({ score, url, name, reason }) =>
  `<tr><td>${score}</td><td><a href="${url}">${name}</a></td><td>${reason}</td></tr>`

/** A reason's first sentence, on one line. */
const one_line = reason =>
  String(reason)
    .split('\n')[0]
    .replace(/^(.+?[.!?])\s.*$/, '$1')
    .trim()

/** A lead as a row, with its text escaped once. */
const row_lead = lead => ({
  score: score_of(lead),
  url: escape(lead.url),
  name: escape(name_of(lead)),
  reason: escape(one_line(lead.reason))
})

/** One row per company: its best-scored opening. */
const best_per_company = rows => [
  ...rows
    .reduce((best, row) => {
      const kept = best.get(row.name)
      if (!kept || Number(row.score) > Number(kept.score))
        best.set(row.name, row)
      return best
    }, new Map())
    .values()
]

/** One day of finds, from rows already rendered. */
const block_of_rows = (date, all) => {
  const rows = best_per_company(all).sort(
    (left, right) => Number(right.score) - Number(left.score)
  )
  const above = rows.filter(row => Number(row.score) >= SCORED)
  const below = rows.filter(row => Number(row.score) < SCORED)
  const count = `${rows.length} ${rows.length === 1 ? 'lead' : 'leads'}`
  const bodies = [above, below]
    .filter((group, at) => group.length || (at === 0 && below.length))
    .map(group =>
      group.length
        ? `<tbody>\n${group.map(row_of).join('\n')}\n</tbody>`
        : '<tbody>\n</tbody>'
    )
    .join('\n')
  const table = bodies
    ? `<table>\n<thead><tr><th>score</th><th>lead</th><th>why</th></tr></thead>\n${bodies}\n</table>\n`
    : ''
  return `<details>\n<summary><strong>${day_label(date)}</strong> <span>${count}</span></summary>\n${table}</details>`
}

/** One day of finds, as the plan's digest shows it. */
export const digest_block = ({ date, leads }) =>
  block_of_rows(date, leads.map(row_lead))

/** A day's block with a run's leads merged in, one row per lead. */
const merge_block = (existing, { date, leads }) => {
  const rows = digest_rows(existing)
  for (const lead of leads) {
    const row = row_lead(lead)
    const at = rows.findIndex(older => older.url === row.url)
    if (at === -1) rows.push(row)
    else rows[at] = row
  }
  return block_of_rows(date, rows)
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
  const block = merge_block(block_of(markdown, date), { date, leads })
  const next = with_digest(markdown, block, date)
  if (next === markdown) return false
  const tmp = `${plan_path}.tmp`
  await write_file(tmp, next)
  await rename(tmp, plan_path)
  return true
}
