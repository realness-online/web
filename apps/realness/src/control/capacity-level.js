import { check_capacity_result } from './capacity-result.js'
import { execution_interval, workload_overlap } from './capacity-evidence.js'

const percentile = 0.95
const guest_step_mib = 64

/** @typedef {{ count: number, workloads: { name: string, samples: number, p95_ms: number, max_ms: number | undefined }[], max_workload_overlap: number, max_guest_overlap: number, guest_peak_mib: number, guest_floor_mib: number }} CapacityLevel */

/* eslint-disable no-await-in-loop -- Each actor runs one workload at a time; rounds and levels stay ordered. */
export const run_level = async ({
  config,
  count,
  actors,
  request,
  checkpoint,
  journal,
  controller,
  signal
}) => {
  /** @type {CapacityLevel} */
  const level = {
    count,
    workloads: [],
    max_workload_overlap: 0,
    max_guest_overlap: 0,
    guest_peak_mib: 0,
    guest_floor_mib: 0
  }
  const intervals = []
  const groups = config.mixed
    ? [config.workloads]
    : config.workloads.map(workload => [workload])
  for (const group of groups) {
    const measurements = new Map(group.map(workload => [workload.name, []]))
    for (
      let repetition = 1;
      repetition <= (config.repetitions ?? 1);
      repetition++
    ) {
      let next = 0
      const active = new Map()
      const workers = Array.from(
        { length: Math.min(config.concurrency, count) },
        async () => {
          while (next < count && !signal.aborted) {
            const actor_index = next++
            const id = actors[actor_index]
            for (let index = 0; index < group.length; index++) {
              signal.throwIfAborted()
              const workload = group[(actor_index + index) % group.length]
              const started = performance.now()
              active.set(workload.name, (active.get(workload.name) ?? 0) + 1)
              level.max_workload_overlap = Math.max(
                level.max_workload_overlap,
                active.size
              )
              try {
                const result = await request(
                  'POST',
                  `/v1/actors/${encodeURIComponent(id)}/exec`,
                  {
                    argv: workload.argv,
                    timeout: workload.timeout_s,
                    ...(workload.cwd ? { cwd: workload.cwd } : {}),
                    ...(workload.stdin_b64
                      ? { stdin_b64: workload.stdin_b64 }
                      : {})
                  }
                )
                const ended = performance.now()
                const elapsed_ms = ended - started
                const evidence = check_capacity_result(workload, result)
                if (elapsed_ms > workload.max_ms)
                  throw new Error(`${workload.name}: response limit exceeded`)
                const interval = evidence
                  ? execution_interval(started, ended, evidence.elapsed_ms)
                  : null
                if (evidence)
                  level.guest_peak_mib = Math.max(
                    level.guest_peak_mib,
                    evidence.guest_peak_mib
                  )
                intervals.push({ name: workload.name, interval })
                measurements.get(workload.name).push(elapsed_ms)
                await journal({
                  type: 'workload',
                  name: workload.name,
                  id,
                  count,
                  repetition,
                  elapsed_ms,
                  guest_interval_ms: interval
                })
              } catch (error) {
                controller.abort(error)
                throw error
              } finally {
                const remaining = active.get(workload.name) - 1
                if (remaining) active.set(workload.name, remaining)
                else active.delete(workload.name)
              }
            }
          }
        }
      )
      const results = await Promise.allSettled(workers)
      const failed = results.find(result => result.status === 'rejected')
      if (failed) throw failed.reason
      signal.throwIfAborted()
      await checkpoint()
    }
    for (const workload of group) {
      const timings = measurements.get(workload.name)
      timings.sort((left, right) => left - right)
      level.workloads.push({
        name: workload.name,
        samples: timings.length,
        p95_ms: timings[Math.ceil(timings.length * percentile) - 1],
        max_ms: timings.at(-1)
      })
    }
  }
  level.guest_floor_mib =
    Math.ceil(level.guest_peak_mib / guest_step_mib) * guest_step_mib
  level.max_guest_overlap = workload_overlap(intervals)
  if (level.max_guest_overlap < (config.min_guest_overlap ?? 0))
    throw new Error('insufficient guest execution overlap')
  return level
}
