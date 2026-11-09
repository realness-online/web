import { readdir, readFile as read_file } from 'node:fs/promises'
import { join } from 'node:path'
import { MS_PER_DAY } from '#root/lib/units.js'
import { active_scouts } from './halo.js'
import { read_leads, RESEARCH_MIN } from './leads.js'
import { runs_path } from './report.js'
import { load_runs, save_runs } from './runs.js'
/* eslint-disable no-await-in-loop -- pages and runs are read in order */

/** Who the digest goes to. */
export const DIGEST_TO = 'scott@realness.online'

/** @typedef {import('./runs.js').Run} Run */

/**
 * Runs the digest still owes: no `mailed` stamp, started within the last day.
 * Older runs predate the digest and stay unmailed.
 * @param {Run[]} runs
 * @param {number} now
 */
export const unmailed = (runs, now) =>
  runs.filter(
    run => !run.mailed && now - Date.parse(run.started ?? '') < MS_PER_DAY
  )

/** The run folder a run item names: `Runs/<date>-<ms>`, the ms ending its itemid. */
const run_folder_of = async (scout_dir, run) => {
  const ms = String(run.itemid ?? '')
    .split('/')
    .at(-1)
  const names = await readdir(join(scout_dir, 'Runs')).catch(() => [])
  const name = names.find(entry => entry.endsWith(`-${ms}`))
  return name ? join(scout_dir, 'Runs', name) : null
}

/** The leads a run scored at or above the research line, best first. */
const scored_leads = async folder => {
  if (!folder) return []
  const html = await read_file(join(folder, 'finds.html'), 'utf8').catch(
    () => ''
  )
  return read_leads(html).leads.filter(lead => lead.score >= RESEARCH_MIN)
}

/**
 * One run's section of the digest: its counts, then each scored lead.
 * @param {string} path the scout's plan folder below `Projects`
 * @param {Run} run
 * @param {import('./leads.js').Lead[]} leads
 */
export const run_section = (path, run, leads) =>
  [
    `${path}: ${run.fresh ?? 0} new, ${run.repeats ?? 0} seen`,
    ...(run.problems ? [`  problems: ${run.problems}`] : []),
    ...leads.map(
      lead =>
        `  ${lead.score} ${lead.org || lead.title || lead.url}\n    ${lead.url}`
    )
  ].join('\n')

/**
 * Every run not yet mailed, as one digest: a subject naming the count, and a
 * body holding each run's section.
 * @param {{ vault_dir: string, now?: number }} options
 */
export const digest_of = async ({ vault_dir, now = Date.now() }) => {
  /** @type {{ page: import('./scout.js').Scout, path: string, runs: Run[], due: Run[] }[]} */
  const owed = []
  for (const page of active_scouts(vault_dir)) {
    const path = runs_path(page.folder)
    const runs = await load_runs(path)
    const due = unmailed(runs, now)
    if (due.length) owed.push({ page, path, runs, due })
  }
  const sections = []
  for (const { page, due } of owed)
    for (const run of due)
      sections.push(
        run_section(
          page.path,
          run,
          await scored_leads(await run_folder_of(page.folder, run))
        )
      )
  const count = sections.length
  return {
    count,
    subject: `Scouts: ${count} run${count === 1 ? '' : 's'}`,
    body: sections.join('\n\n'),
    owed
  }
}

/**
 * Mail one digest of every run not yet mailed, then stamp those runs
 * `mailed`. The stamp lands only after the send, so a failed send repeats.
 * @param {object} options
 * @param {string} options.vault_dir
 * @param {(subject: string, body: string) => Promise<void>} options.send
 * @param {number} [options.now]
 * @returns {Promise<number>} how many runs it mailed
 */
export const mail_digest = async ({ vault_dir, send, now = Date.now() }) => {
  const { count, subject, body, owed } = await digest_of({ vault_dir, now })
  if (!count) return 0
  await send(subject, body)
  const stamp = new Date(now).toISOString()
  for (const { page, path, runs, due } of owed)
    await save_runs(
      path,
      page.path.split('/').at(-1) ?? page.path,
      runs.map(run => (due.includes(run) ? { ...run, mailed: stamp } : run))
    )
  return count
}
