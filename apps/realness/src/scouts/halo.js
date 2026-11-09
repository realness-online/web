import { copyFile as copy_file } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { setTimeout as wait } from 'node:timers/promises'
import { ISO_DATE, MS_PER_DAY, MS_PER_MINUTE } from '#root/lib/units.js'
import { runs_path } from './report.js'
import { run_scout } from './run.js'
import { load_runs } from './runs.js'
import { scout_pages } from './scout.js'

/** Where the owner's box mounts this machine's vault. */
export const ACTOR_VAULT = '/realness/vault'
const POLL_MS = 15_000

/** @param {string} actor_run_dir */
export const scout_goal = actor_run_dir =>
  `Read ${actor_run_dir}/goal.md and do all of it. Write ${actor_run_dir}/finds.html before you stop.`

/**
 * The scouts a batch run starts: every active page below `Projects`, in folder
 * order. A paused scout is left out.
 * @param {string} vault_dir
 * @returns {import('./scout.js').Scout[]}
 */
export const active_scouts = vault_dir =>
  scout_pages(vault_dir).filter(page => page.status === 'active')

/**
 * Whether the timer may start this scout now: it is active, it has runs left in
 * today's budget, a day's pace has passed since its last run, and no run of it
 * is already in flight. A page without `per_day` gets one run a day.
 * @param {import('./scout.js').Scout} page
 * @param {import('./runs.js').Run[]} runs
 * @param {{ date: string, now?: number, running?: boolean }} options
 */
export const scout_due = (
  page,
  runs,
  { date, now = Date.now(), running = false }
) => {
  if (running || page.status !== 'active') return false
  const per_day = page.per_day || 1
  const today = runs.filter(
    run => (run.started ?? '').slice(0, ISO_DATE) === date
  )
  if (today.length >= per_day) return false
  const last = Date.parse(runs.at(-1)?.started ?? '')
  return !Number.isFinite(last) || now - last >= MS_PER_DAY / per_day
}

/**
 * The scouts the timer may start now, each one's runs page read to see what it
 * already spent today.
 * @param {string} vault_dir
 * @param {{ date: string, now?: number, running?: Set<string> }} options
 * @returns {Promise<import('./scout.js').Scout[]>}
 */
export const due_scouts = async (
  vault_dir,
  { date, now = Date.now(), running = new Set() }
) => {
  const checked = await Promise.all(
    active_scouts(vault_dir).map(async page => ({
      page,
      due: scout_due(page, await load_runs(runs_path(page.folder)), {
        date,
        now,
        running: running.has(page.path)
      })
    }))
  )
  return checked.filter(entry => entry.due).map(entry => entry.page)
}

/**
 * Run one scout in the halo: `run_scout` builds the brief and merges the
 * finds; its pi step is a one-shot loop actor that reads the brief from the
 * vault and stops when pi settles or the scout's minutes run out.
 * @param {object} options
 * @param {{ start: Function, log_path: (id: string) => string, loops: Record<string, { status: string, reason?: string }> }} options.loops
 * @param {string} options.parent the asking actor's id
 * @param {string} options.scout
 * @param {string} options.vault_dir this machine's vault
 * @param {string} options.person
 * @param {string} options.date
 * @param {number} [options.poll_ms]
 * @param {() => Promise<unknown>} [options.preflight] gates checked before pi starts
 */
export const run_scout_loop = ({
  loops,
  parent,
  scout,
  vault_dir,
  person,
  date,
  poll_ms = POLL_MS,
  preflight
}) =>
  run_scout({
    scout,
    vault_dir,
    actor_vault: ACTOR_VAULT,
    person,
    date,
    preflight,
    spawn_pi: async (brief, run_dir, minutes) => {
      const goal = scout_goal(join(ACTOR_VAULT, relative(vault_dir, run_dir)))
      const { id } = await loops.start(parent, goal, {
        once: true,
        deadline_ms: minutes * MS_PER_MINUTE,
        session_dir: join(ACTOR_VAULT, relative(vault_dir, run_dir), 'sessions')
      })
      const settled = async () => {
        if (loops.loops[id]?.status !== 'running')
          return loops.loops[id]?.reason
        await wait(poll_ms)
        return settled()
      }
      const reason = await settled()
      await copy_file(loops.log_path(id), join(run_dir, 'pi.log'))
      return reason === 'exited' ? 0 : 1
    }
  })
