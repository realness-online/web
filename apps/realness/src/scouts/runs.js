import {
  mkdir,
  readFile as read_file,
  rename,
  writeFile as write_file
} from 'node:fs/promises'
import { dirname } from 'node:path'
import { escape, item_html, read_items } from '#root/lib/items.js'
import { MS_PER_SECOND } from '#root/lib/units.js'

/** @typedef {import('./leads.js').Lead} Lead */

/**
 * One run on the scout's page: what it did and where its files are.
 * @typedef {Record<string, string>} Run
 */

/**
 * Every run this scout has made, oldest first. A missing page is a scout that
 * has not run yet.
 * @param {string} path
 * @returns {Promise<Run[]>}
 */
export const load_runs = async path => {
  const html = await read_file(path, 'utf8').catch(error => {
    if (error.code === 'ENOENT') return ''
    throw error
  })
  return read_items(html, 'run')
}

/** One stage as a page line: its name, whether it waited, and when it ran. */
const stage_text = stage =>
  `${stage.name} ${stage.kind} ${stage.started} ${stage.ended}`.trim()

/** The seconds the stages of one kind took, added up. */
const seconds_of = (stages, kind) => {
  const ms = stages
    .filter(one => one.kind === kind && one.ended)
    .reduce(
      (sum, one) => sum + Date.parse(one.ended) - Date.parse(one.started),
      0
    )
  return `${(ms / MS_PER_SECOND).toFixed(1)}s`
}

/** A run's page fields: counts, problems, and the files beside it. A run still
 * in flight has no end and no exit, and no leads yet. */
/**
 * One run row, from the fields a run leaves behind.
 * @param {{
 *   itemid: string,
 *   scout: string,
 *   source?: string,
 *   started: string,
 *   ended?: string,
 *   exit?: string | number,
 *   leads?: unknown[],
 *   fresh?: unknown[],
 *   repeats?: unknown[],
 *   problems?: { item: number, problem: string }[],
 *   stages?: { name: string, kind: string, started: string, ended: string }[],
 *   stage?: { name: string, kind: string, started: string } | null
 * }} fields
 */
export const run_item = ({
  itemid,
  scout,
  source = '',
  started,
  ended = '',
  exit = '',
  leads = [],
  fresh = [],
  repeats = [],
  problems = [],
  stages = [],
  stage = null
}) => ({
  itemid,
  scout,
  source,
  started,
  ended,
  exit: exit === '' ? '' : String(exit),
  stage: stage ? `${stage.name} ${stage.kind} since ${stage.started}` : '',
  stages: stages
    .filter(one => one.ended)
    .map(stage_text)
    .join('; '),
  waited: seconds_of(stages, 'wait'),
  worked: seconds_of(stages, 'work'),
  found: String(leads.length),
  fresh: String(fresh.length),
  repeats: String(repeats.length),
  problems: problems
    .map(problem => `item ${problem.item}: ${problem.problem}`)
    .join('; '),
  goal: 'goal.md',
  log: 'pi.log',
  finds: 'finds.html'
})

/** A run in its place on the page: one row per run, kept in the order it started. */
export const with_run = (runs, run) => [
  ...runs.filter(older => older.itemid !== run.itemid),
  run
]

/** The runs page: a titled document of `/run` items. */
export const runs_page = (label, runs) =>
  `<!doctype html>\n<title>${escape(label)} runs</title>\n${runs
    .map(run => item_html('run', run, { links: ['goal', 'log', 'finds'] }))
    .join('')}`

/** Written whole, then moved into place, so a crash never leaves half a page. */
export const save_runs = async (path, label, runs) => {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await write_file(tmp, runs_page(label, runs))
  await rename(tmp, path)
}
