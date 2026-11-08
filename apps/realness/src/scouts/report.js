import { join } from 'node:path'
import { DRAFT_MIN, RESEARCH_MIN } from './leads.js'

/** @typedef {import('./leads.js').Lead} Lead */

/** The note a run writes: one per scout per day, replaced by a later run. */
export const report_path = (scout_dir, date) =>
  join(scout_dir, 'Leads', `${date}.md`)

/** The scout's finds page: the seen store, one `/find` item per find. */
export const finds_path = scout_dir => join(scout_dir, 'Finds', 'finds.html')

/** The scout's rundir: one dated folder per run, beside the report. */
export const run_folder = (scout_dir, stamp) => join(scout_dir, 'Runs', stamp)

/** The scout's runs page: one `/run` item per run. */
export const runs_path = scout_dir => join(scout_dir, 'Runs', 'runs.html')

/** @param {number} value */
const score = value => value.toFixed(1)

/** @param {Lead} lead */
const lead_body = lead => {
  const lines = [`- ${lead.url}`]
  if (lead.source) lines.push(`- source: ${lead.source}`)
  lines.push(`- why: ${lead.reason}`)
  if (lead.research) lines.push(`- research: ${lead.research}`)
  return lines.join('\n')
}

/** @param {Lead} lead */
const lead_heading = lead =>
  `## ${score(lead.score)} - ${lead.org || lead.title || new URL(lead.url).host}`

/** @param {Lead} lead */
const draft_section = lead => {
  const body = lead.draft
    .trim()
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n')
  return `### ${lead.org || lead.title || new URL(lead.url).host}\n\n${body}`
}

/**
 * The dated report note. New leads first, with their drafts; then the repeats
 * the seen store caught, the leads below the research line, and any record the
 * run got wrong.
 * @param {object} run
 * @param {string} run.label the scout, as a person reads it
 * @param {string} run.date ISO date
 * @param {number} run.found how many leads the run wrote
 * @param {Lead[]} run.fresh
 * @param {Lead[]} run.repeats
 * @param {{ item: number, problem: string }[]} run.problems
 * @param {number} run.seen how many URLs the store held before this run
 */
export const report_note = ({
  label,
  date,
  found,
  fresh,
  repeats,
  problems,
  seen
}) => {
  const lines = [
    `# ${label} leads, ${date}`,
    '',
    `${found} found, ${fresh.length} new, ${repeats.length} already seen. The store held ${seen} leads before this run.`,
    ''
  ]
  const above = fresh.filter(lead => lead.score >= RESEARCH_MIN)
  const below = fresh.filter(lead => lead.score < RESEARCH_MIN)
  const drafted = above.filter(lead => lead.score >= DRAFT_MIN && lead.draft)
  if (!fresh.length) lines.push('No new leads.', '')
  if (above.length) {
    lines.push('## Leads', '')
    for (const lead of above)
      lines.push(lead_heading(lead), '', lead_body(lead), '')
  }
  if (drafted.length) {
    lines.push('## Drafts', '')
    for (const lead of drafted) lines.push(draft_section(lead), '')
  }
  if (below.length) {
    lines.push(
      '## Below the line',
      '',
      '| score | lead | why |',
      '| --- | --- | --- |'
    )
    for (const lead of below)
      lines.push(
        `| ${score(lead.score)} | ${lead.org || lead.title || new URL(lead.url).host} | ${lead.reason} |`
      )
    lines.push('')
  }
  if (repeats.length) {
    lines.push('## Already seen', '')
    for (const lead of repeats) lines.push(`- ${score(lead.score)} ${lead.url}`)
    lines.push('')
  }
  if (problems.length) {
    lines.push('## Records the run wrote wrong', '')
    for (const problem of problems)
      lines.push(`- item ${problem.item}: ${problem.problem}`)
    lines.push('')
  }
  return `${lines.join('\n').trimEnd()}\n`
}
