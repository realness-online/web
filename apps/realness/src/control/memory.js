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
import { setTimeout as delay } from 'node:timers/promises'
import { note, step } from './exec.js'
import { workload_timeout } from './capacity-workloads.js'
/* eslint-disable no-await-in-loop -- stages run in order: each one changes what the next measures */

class MemoryError extends Error {}

const sample_interval_ms = 1000
const max_timer_ms = 2147483647

/**
 * @typedef {{ name: string, run?: string, argv?: string[], cwd?: string, stdin_b64?: string, timeout_s?: number }} MemoryStage
 */
/**
 * @param {{ actor: string, stages: MemoryStage[], sample_ms?: number, run: (argv: string[], stage: MemoryStage) => Promise<unknown>, sample: (actor: string) => Promise<{ halo_mib: number, guest_used_mib: number, top: string[] }> }} options
 */
export const measure = async ({
  actor,
  stages,
  run,
  sample,
  sample_ms = sample_interval_ms
}) => {
  if (!actor) throw new MemoryError('measure needs an actor')
  if (!stages.length) throw new MemoryError('measure needs at least one stage')
  if (
    !Number.isInteger(sample_ms) ||
    sample_ms <= 0 ||
    sample_ms > max_timer_ms
  )
    throw new MemoryError('sample interval must be a positive integer timer')
  for (const stage of stages) {
    workload_timeout(stage)
    if (
      !stage.name ||
      (stage.argv !== undefined &&
        (!Array.isArray(stage.argv) ||
          !stage.argv.length ||
          stage.argv.some(arg => typeof arg !== 'string')))
    )
      throw new MemoryError('stages need a name and valid argv')
  }
  const rows = []
  for (const stage of stages) {
    step(stage.name)
    const readings = []
    const record = async () => {
      const reading = await sample(actor)
      for (const field of ['halo_mib', 'guest_used_mib'])
        if (!Number.isFinite(reading[field]) || reading[field] < 0)
          throw new MemoryError(`unknown memory: ${field}`)
      readings.push(reading)
    }
    const argv = stage.argv ?? (stage.run ? stage.run.split(' ') : null)
    if (argv) {
      const controller = new AbortController()
      const monitoring = (async () => {
        while (!controller.signal.aborted) {
          try {
            await delay(sample_ms, undefined, { signal: controller.signal })
          } catch (error) {
            if (controller.signal.aborted) return
            throw error
          }
          await record()
        }
      })()
      const results = await Promise.allSettled([
        Promise.resolve()
          .then(() => run(argv, stage))
          .finally(() => controller.abort()),
        monitoring
      ])
      const failed = results.find(result => result.status === 'rejected')
      if (failed) throw failed.reason
    }
    await record()
    const reading = readings.reduce((largest, current) =>
      current.guest_used_mib > largest.guest_used_mib ? current : largest
    )
    rows.push({
      stage: stage.name,
      ...reading,
      halo_mib: peak(readings),
      samples: readings.length
    })
    note(
      `halo ${peak(readings)} MiB, guest ${reading.guest_used_mib} MiB, top ${reading.top[0] ?? '-'}`
    )
  }
  return { actor, rows, peak: peak(rows), floor_mib: floor(rows), sample_ms }
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
