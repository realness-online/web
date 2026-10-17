/**
 * hs-mem: what one actor really costs, by stage.
 *
 * Two numbers matter and they are not the same:
 *
 * - The halo's cost is the resident memory of the actor's Firecracker process,
 *   because that is what a halo cannot give to another actor. A guest can free
 *   memory and the halo may not get it back.
 * - The guest's use is what the actor itself holds, and it is what the
 *   configured size has to cover.
 *
 * The measurement is staged so the answer can say which part is which: a bare
 * actor, an actor with Pi running, and an actor after a page has been fetched
 * and converted. Stages are commands, so this runs against any halo.
 */
import { note, step } from './exec.js'
/* eslint-disable no-await-in-loop -- stages run in order: each one changes what the next measures */

class MemoryError extends Error {}

/**
 * @param {{ actor: string, stages: { name: string, run: string }[], run: (argv: string[]) => Promise<string>, sample: (actor: string) => Promise<{ halo_mib: number, guest_used_mib: number, top: string[] }> }} options
 */
export const measure = async ({ actor, stages, run, sample }) => {
  if (!actor) throw new MemoryError('measure needs an actor')
  if (!stages.length) throw new MemoryError('measure needs at least one stage')
  const rows = []
  for (const stage of stages) {
    step(stage.name)
    if (stage.run) await run(stage.run.split(' '))
    const reading = await sample(actor)
    rows.push({ stage: stage.name, ...reading })
    note(
      `halo ${reading.halo_mib} MiB, guest ${reading.guest_used_mib} MiB, top ${reading.top[0] ?? '-'}`
    )
  }
  return { actor, rows, peak: peak(rows), floor_mib: floor(rows) }
}

/** The most the halo gave up at any stage, which is what a halo must hold. */
const peak = rows => Math.max(...rows.map(row => row.halo_mib))

/**
 * The floor is the largest guest use seen, rounded up to a size an actor can
 * actually be configured with. A floor below the guest's own use is a promise
 * the halo cannot keep.
 */
const floor = rows => round_up(Math.max(...rows.map(row => row.guest_used_mib)))

const STEP_MIB = 64
const round_up = mib => Math.ceil(mib / STEP_MIB) * STEP_MIB

export const memory_text = result => {
  const lines = [
    `actor ${result.actor}: peak halo ${result.peak} MiB, floor ${result.floor_mib} MiB`
  ]
  for (const row of result.rows)
    lines.push(
      `  ${row.stage}: halo ${row.halo_mib} MiB, guest ${row.guest_used_mib} MiB (${row.top.slice(0, 2).join(', ')})`
    )
  return lines.join('\n')
}

export { MemoryError }
