import {
  mkdir,
  readFile as read_file,
  rename,
  writeFile as write_file
} from 'node:fs/promises'
import { dirname } from 'node:path'
import { escape, item_html, read_items } from '#root/lib/items.js'

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

/** A run's page fields: counts, problems, and the files beside it. */
export const run_item = ({
  itemid,
  scout,
  started,
  ended,
  exit,
  leads,
  fresh,
  repeats,
  problems
}) => ({
  itemid,
  scout,
  started,
  ended,
  exit: String(exit),
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
