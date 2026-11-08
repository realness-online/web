import {
  mkdir,
  readFile as read_file,
  writeFile as write_file
} from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { read_leads } from './leads.js'
import { load_finds, save_finds, split_fresh, with_finds } from './seen.js'
import {
  finds_path,
  report_note,
  report_path,
  run_folder,
  runs_path
} from './report.js'
import { load_runs, run_item, save_runs } from './runs.js'
import { scout_pages, find_scout } from './scout.js'
import { scout_prompt } from './prompt.js'
import { scout_nodes } from './nodes.js'

const MINUTES = 30

const read_or_throw = (path, what) =>
  read_file(path, 'utf8').catch(error => {
    if (error.code === 'ENOENT') throw new Error(`${what} is missing: ${path}`)
    throw error
  })

/**
 * One scout run: read the profile and the finds page, hand pi the brief, read
 * back its finds, write the dated report note, then add the fresh finds to the
 * page. The page moves only after the report is written, so a failed run
 * repeats nothing and loses nothing.
 * @param {object} options
 * @param {string} options.scout the plan folder's name, or its path below `Projects`
 * @param {string} options.vault_dir
 * @param {string} [options.actor_vault] the vault as pi sees it, when pi runs elsewhere
 * @param {string} options.date ISO date
 * @param {(brief: string, run_dir: string, minutes: number) => Promise<number | void>} options.spawn_pi
 * @param {string} options.person the owner's itemid root, like `/+14155551234`
 * @param {number} [options.minutes] overrides the scout page's own deadline
 * @param {() => number} [options.clock]
 * @param {boolean} [options.dry_run] return the brief and write nothing
 */
export const run_scout = async ({
  scout,
  vault_dir,
  actor_vault = vault_dir,
  date,
  spawn_pi,
  person,
  minutes,
  clock = Date.now,
  dry_run = false
}) => {
  const page = find_scout(scout_pages(vault_dir), scout)
  const label = page.path.split('/').at(-1) ?? page.path
  if (page.status !== 'active')
    throw new Error(`${label} is ${page.status || 'missing a status'}`)
  const scout_vault = page.folder
  const deadline = minutes ?? page.minutes ?? MINUTES
  const profile = await read_or_throw(
    join(scout_vault, 'Profile.md'),
    'the profile'
  )
  const sources = await read_or_throw(
    join(scout_vault, 'Sources.md'),
    'the sources'
  )
  const page_path = finds_path(scout_vault)
  const finds = await load_finds(page_path)
  const seen = finds.map(find => find.url)
  const now = clock()
  const stamp = `${date}-${now}`
  const run_dir = run_folder(scout_vault, stamp)
  const brief = scout_prompt({
    label,
    profile,
    sources,
    seen,
    nodes: scout_nodes(scout_vault, join(vault_dir, 'Projects')),
    run_dir: join(actor_vault, relative(vault_dir, run_dir)),
    vault_dir: actor_vault,
    folder: page.path,
    minutes: deadline
  })
  if (dry_run) return { brief, run_dir }
  await mkdir(run_dir, { recursive: true })
  await write_file(join(run_dir, 'goal.md'), brief)
  const started = new Date(clock()).toISOString()
  const code = (await spawn_pi(brief, run_dir, deadline)) ?? 0
  const ended = new Date(clock()).toISOString()
  const leads_file = await read_file(join(run_dir, 'finds.html'), 'utf8').catch(
    error => {
      if (error.code === 'ENOENT') return ''
      throw error
    }
  )
  if (!leads_file.trim() && code !== 0)
    throw new Error(
      `the run failed: pi exited ${code}; read ${join(run_dir, 'pi.log')}`
    )
  const { leads, problems } = read_leads(leads_file)
  if (!leads_file.trim())
    problems.push({ item: 0, problem: 'the run wrote no finds.html' })
  else if (code !== 0)
    problems.push({
      item: 0,
      problem: `pi exited ${code} after writing its leads`
    })
  const { fresh, repeats } = split_fresh(finds, leads)
  const note = report_note({
    label,
    date,
    found: leads.length,
    fresh,
    repeats,
    problems,
    seen: seen.length
  })
  const path = report_path(scout_vault, date)
  await mkdir(dirname(path), { recursive: true })
  await write_file(path, note)
  await save_finds(page_path, label, with_finds(finds, fresh, { person, now }))
  const log = join(run_dir, 'pi.log')
  const runs = runs_path(scout_vault)
  await save_runs(runs, label, [
    ...(await load_runs(runs)),
    run_item({
      itemid: `${person}/runs/${now}`,
      scout: label,
      started,
      ended,
      exit: code,
      leads,
      fresh,
      repeats,
      problems
    })
  ])
  return { path, runs, leads, fresh, repeats, problems, run_dir, log }
}
