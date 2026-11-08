import { join, relative } from 'node:path'
import { setTimeout as wait } from 'node:timers/promises'
import { MS_PER_MINUTE } from '#root/lib/units.js'
import { run_scout } from './run.js'
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
 * Run one scout in the halo: `run_scout` builds the brief and merges the
 * finds; its pi step is a one-shot loop actor that reads the brief from the
 * vault and stops when pi settles or the scout's minutes run out.
 * @param {object} options
 * @param {{ start: Function, loops: Record<string, { status: string, reason?: string }> }} options.loops
 * @param {string} options.parent the asking actor's id
 * @param {string} options.scout
 * @param {string} options.vault_dir this machine's vault
 * @param {string} options.person
 * @param {string} options.date
 * @param {number} [options.poll_ms]
 */
export const run_scout_loop = ({
  loops,
  parent,
  scout,
  vault_dir,
  person,
  date,
  poll_ms = POLL_MS
}) =>
  run_scout({
    scout,
    vault_dir,
    actor_vault: ACTOR_VAULT,
    person,
    date,
    spawn_pi: async (brief, run_dir, minutes) => {
      const goal = scout_goal(join(ACTOR_VAULT, relative(vault_dir, run_dir)))
      const { id } = await loops.start(parent, goal, {
        once: true,
        deadline_ms: minutes * MS_PER_MINUTE
      })
      const settled = async () => {
        if (loops.loops[id]?.status !== 'running')
          return loops.loops[id]?.reason
        await wait(poll_ms)
        return settled()
      }
      return (await settled()) === 'exited' ? 0 : 1
    }
  })
