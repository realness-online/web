import {
  mkdir,
  readFile as read_file,
  writeFile as write_file
} from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { save_digest } from './digest.js'
import { read_leads } from './leads.js'
import { load_finds, save_finds, split_fresh, with_finds } from './seen.js'
import {
  finds_path,
  report_note,
  report_path,
  run_folder,
  runs_path
} from './report.js'
import { with_lock } from './lock.js'
import { load_runs, run_item, save_runs, with_run } from './runs.js'
import { STAGES_PAGE, pi_stages, read_stages } from './stages.js'
import { scout_pages, find_scout } from './scout.js'
import {
  find_source,
  source_problem,
  source_sections,
  source_urls
} from './sources.js'
import { scout_prompt } from './prompt.js'
import { scout_nodes } from './nodes.js'
import { dead_source } from './source.js'

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
 * @param {(brief: string, run_dir: string, staged: Function, allowed: string[]) => Promise<number | void>} options.spawn_pi
 *   `allowed` is the source's own URLs: a run reads those and no other page
 * @param {string} options.person the owner's itemid root, like `/+14155551234`
 * @param {() => number} [options.clock]
 * @param {boolean} [options.dry_run] return the brief and write nothing
 * @param {() => Promise<unknown>} [options.preflight] gates checked before pi
 * @param {string} [options.source] the one source this run reads
 * @param {typeof scout_prompt} [options.prompt] writes the brief
 */
export const run_scout = async ({
  scout,
  vault_dir,
  actor_vault = vault_dir,
  date,
  spawn_pi,
  person,
  clock = Date.now,
  dry_run = false,
  preflight,
  source = '',
  prompt = scout_prompt
}) => {
  const page = find_scout(scout_pages(vault_dir), scout)
  const label = page.path.split('/').at(-1) ?? page.path
  if (page.status !== 'active')
    throw new Error(`${label} is ${page.status || 'missing a status'}`)
  const scout_vault = page.folder
  const stages = []
  const open = (name, kind) => {
    const stage = {
      name,
      kind,
      started: new Date(clock()).toISOString(),
      ended: ''
    }
    stages.push(stage)
    return stage
  }
  const close = stage => {
    stage.ended = new Date(clock()).toISOString()
  }
  const staged = async (name, kind, work) => {
    const stage = open(name, kind)
    try {
      return await work()
    } finally {
      close(stage)
    }
  }
  const now = clock()
  const run_id = source ? `${now}-${source}` : String(now)
  const stamp = `${date}-${run_id}`
  const run_dir = run_folder(scout_vault, stamp)
  const { brief, page_path, seen, one, allowed } = await staged(
    'brief',
    'work',
    async () => {
      const profile = await read_or_throw(
        join(scout_vault, 'Profile.md'),
        'the profile'
      )
      const sources_doc = await read_or_throw(
        join(scout_vault, 'Sources.md'),
        'the sources'
      )
      const sections = source_sections(sources_doc)
      const one = source ? find_source(sections, source) : null
      const undecided = (one ? [one] : sections).find(page =>
        source_problem(page)
      )
      if (undecided) throw new Error(source_problem(undecided))
      const sources = one ? one.text : sources_doc
      const page_path = finds_path(scout_vault)
      const seen = (await load_finds(page_path)).map(find => find.url)
      const brief = prompt({
        label,
        profile,
        sources,
        source: one,
        seen,
        nodes: scout_nodes(scout_vault, join(vault_dir, 'Projects')),
        run_dir: join(actor_vault, relative(vault_dir, run_dir)),
        vault_dir: actor_vault,
        folder: page.path
      })
      return {
        brief,
        page_path,
        seen,
        one,
        allowed: source_urls(one ? one.text : sources_doc)
      }
    }
  )
  if (dry_run) return { brief, run_dir }
  if (preflight) await staged('check', 'wait', () => preflight())
  await mkdir(run_dir, { recursive: true })
  await write_file(join(run_dir, 'goal.md'), brief)
  const started = new Date(clock()).toISOString()
  const runs = runs_path(scout_vault)
  const run = {
    itemid: `${person}/runs/${run_id}`,
    scout: label,
    started,
    source: one?.key ?? ''
  }
  const pi = open('pi', 'work')
  const start_lock = open('lock', 'wait')
  await with_lock(scout_vault, async () => {
    close(start_lock)
    await save_runs(
      runs,
      label,
      with_run(await load_runs(runs), run_item({ ...run, stages, stage: pi }))
    )
  })
  const code = (await spawn_pi(brief, run_dir, staged, allowed)) ?? 0
  close(pi)
  const records = await read_stages(join(run_dir, STAGES_PAGE))
  const steps = pi_stages(records, Date.parse(pi.ended))
  if (steps.length) stages.splice(stages.indexOf(pi), 1, ...steps)
  const ended = new Date(clock()).toISOString()
  const log = join(run_dir, 'pi.log')
  const dead = dead_source(
    await read_file(log, 'utf8').catch(error => {
      if (error.code === 'ENOENT') return ''
      throw error
    })
  )
  const leads_file = await read_file(join(run_dir, 'finds.html'), 'utf8').catch(
    error => {
      if (error.code === 'ENOENT') return ''
      throw error
    }
  )
  const { leads, problems } = read_leads(leads_file)
  if (!leads_file.trim())
    problems.push({ item: 0, problem: 'the run wrote no finds.html' })
  else if (code !== 0)
    problems.push({
      item: 0,
      problem: `pi exited ${code} after writing its leads`
    })
  if (dead) problems.push({ item: 0, problem: dead })
  const plan_page = join(scout_vault, 'index.md')
  const path = report_path(scout_vault, date, run.source)
  const write_lock = open('lock', 'wait')
  const { fresh, repeats } = await with_lock(scout_vault, async () => {
    close(write_lock)
    const split = await staged('write', 'work', async () => {
      const finds = await load_finds(page_path)
      const split = split_fresh(finds, leads)
      await mkdir(dirname(path), { recursive: true })
      await write_file(
        path,
        report_note({
          label,
          date,
          found: leads.length,
          fresh: split.fresh,
          repeats: split.repeats,
          problems,
          seen: seen.length
        })
      )
      await save_finds(
        page_path,
        label,
        with_finds(finds, split.fresh, { person, now })
      )
      await save_digest(plan_page, { date, leads })
      return split
    })
    await save_runs(
      runs,
      label,
      with_run(
        await load_runs(runs),
        run_item({
          ...run,
          ended,
          exit: code,
          leads,
          fresh: split.fresh,
          repeats: split.repeats,
          problems,
          stages
        })
      )
    )
    return split
  })
  if (dead)
    throw new Error(`a login source was unreadable: ${dead}; read ${log}`)
  if (!leads.length && code !== 0)
    throw new Error(`the run failed: pi exited ${code}; read ${log}`)
  return { path, runs, leads, fresh, repeats, problems, run_dir, log }
}
