import { createHmac as create_hmac } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { check_capacity_result } from './capacity-result.js'

const ms_per_second = 1000
const ms_per_hour = 3600000
const max_timer_ms = 2147483647
const max_guest_seconds = 1800
const minimum_secret_length = 32
const pass_lifetime_seconds = 240
const no_content_status = 204
const percentile = 0.95

const positive = (value, name) => {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${name} must be positive`)
}

export const validate_capacity = config => {
  const url = new URL(config.api)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error('api must be an HTTP URL without credentials')
  if (!/^\+\d{8,15}$/.test(config.owner))
    throw new Error('explicit test owner required')
  for (const name of [
    'duration_ms',
    'request_ms',
    'sample_ms',
    'min_memory_bytes',
    'min_disk_bytes',
    'max_cpu_fraction',
    'hourly_cost',
    'budget',
    'concurrency'
  ])
    positive(config[name], name)
  for (const name of ['duration_ms', 'request_ms', 'sample_ms'])
    if (!Number.isInteger(config[name]) || config[name] > max_timer_ms)
      throw new Error(`${name} must be an integer timer within 2147483647 ms`)
  if (!Number.isInteger(config.concurrency) || config.max_cpu_fraction > 1)
    throw new Error('invalid concurrency or CPU fraction')
  if (
    !Array.isArray(config.levels) ||
    !config.levels.length ||
    config.levels.some(
      (n, i) => !Number.isInteger(n) || n <= (config.levels[i - 1] ?? 0)
    )
  )
    throw new Error('levels must be increasing positive integers')
  if (!Array.isArray(config.workloads) || !config.workloads.length)
    throw new Error('workloads required')
  const names = new Set()
  for (const workload of config.workloads) {
    if (!workload.name || names.has(workload.name))
      throw new Error('unique workload names required')
    names.add(workload.name)
    if (
      workload.pi_reply !== undefined &&
      (typeof workload.pi_reply !== 'string' || !workload.pi_reply.trim())
    )
      throw new Error('pi_reply must be a nonempty string')
    if (
      !Array.isArray(workload.argv) ||
      !workload.argv.length ||
      workload.argv.some(arg => typeof arg !== 'string')
    )
      throw new Error('workload argv required')
    positive(workload.max_ms, 'workload max_ms')
    positive(workload.timeout_s, 'workload timeout_s')
    if (
      workload.timeout_s > max_guest_seconds ||
      workload.timeout_s * ms_per_second >= config.request_ms
    )
      throw new Error(
        'guest timeout must be below request timeout and at most 1800 seconds'
      )
  }
  if (
    ((config.duration_ms + config.request_ms * config.levels.at(-1)) /
      ms_per_hour) *
      config.hourly_cost >
    config.budget
  )
    throw new Error('duration plus cleanup reserve exceeds estimated budget')
  return config
}

/* eslint-disable no-await-in-loop -- Sampling, staged creation, worker queues, and reverse cleanup require ordered awaits. */
export const run_capacity = async (
  config,
  { secret, sample, journal, signal }
) => {
  validate_capacity(config)
  if (
    typeof secret !== 'string' ||
    secret.trim().length < minimum_secret_length
  )
    throw new Error('secret file must contain at least 32 characters')
  const started = Date.now()
  const controller = new AbortController()
  const run_signal = AbortSignal.any([
    controller.signal,
    AbortSignal.timeout(config.duration_ms),
    ...(signal ? [signal] : [])
  ])
  /** @type {{ levels: Array<{ count: number, workloads: Array<{ name: string, samples: number, p95_ms: number, max_ms: number | undefined }> }>, actors: string[], cleanup_failures: Array<{ id: string, error: string }>, uncertain_create: boolean, stop: string | null, safe_count: null, elapsed_ms?: number, estimated_compute_cost?: number, complete?: boolean }} */
  const report = {
    levels: [],
    actors: [],
    cleanup_failures: [],
    uncertain_create: false,
    stop: null,
    safe_count: null
  }
  const checkpoint = async () => {
    run_signal.throwIfAborted()
    const metrics = await sample(run_signal)
    run_signal.throwIfAborted()
    await journal({
      type: 'sample',
      elapsed_ms: Date.now() - started,
      ...metrics
    })
    for (const key of ['memory_bytes', 'disk_bytes', 'cpu_fraction'])
      if (!Number.isFinite(metrics[key]) || metrics[key] < 0)
        throw new Error(`unknown resource: ${key}`)
    if (metrics.memory_bytes < config.min_memory_bytes)
      throw new Error('memory reserve reached')
    if (metrics.disk_bytes < config.min_disk_bytes)
      throw new Error('disk reserve reached')
    if (metrics.cpu_fraction > config.max_cpu_fraction)
      throw new Error('CPU ceiling reached')
  }
  const request = async (method, path, body, cleanup = false) => {
    const payload = Buffer.from(
      JSON.stringify({
        aud: 'realness-host',
        phone: config.owner,
        exp: Math.floor(Date.now() / ms_per_second) + pass_lifetime_seconds
      })
    ).toString('base64url')
    const signature = create_hmac('sha256', secret.trim())
      .update(payload)
      .digest('base64url')
    const response = await fetch(new URL(path, config.api), {
      method,
      headers: {
        authorization: `Bearer ${payload}.${signature}`,
        'content-type': 'application/json'
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: 'error',
      signal: cleanup
        ? AbortSignal.timeout(config.request_ms)
        : AbortSignal.any([run_signal, AbortSignal.timeout(config.request_ms)])
    })
    if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`)
    return response.status === no_content_status ? null : response.json()
  }
  const monitor = async () => {
    try {
      while (true) {
        await delay(config.sample_ms, undefined, { signal: run_signal })
        await checkpoint()
      }
    } catch (error) {
      if (!run_signal.aborted) controller.abort(error)
    }
  }
  let monitoring
  try {
    await journal({ type: 'start', owner: config.owner, levels: config.levels })
    await checkpoint()
    const health = await request('GET', '/v1/health')
    if (!health.ok || !health.seed?.matches)
      throw new Error('host seed is not ready')
    monitoring = monitor()
    for (const count of config.levels) {
      while (report.actors.length < count) {
        await checkpoint()
        report.uncertain_create = true
        const actor = await request('POST', '/v1/actors', {})
        if (typeof actor?.id !== 'string' || !actor.id)
          throw new Error('create returned no actor ID')
        report.actors.push(actor.id)
        report.uncertain_create = false
        await journal({ type: 'created', id: actor.id })
      }
      /** @type {{ count: number, workloads: Array<{ name: string, samples: number, p95_ms: number, max_ms: number | undefined }> }} */
      const level = { count, workloads: [] }
      report.levels.push(level)
      for (const workload of config.workloads) {
        let next = 0
        const measurements = []
        const workers = Array.from(
          { length: Math.min(config.concurrency, count) },
          async () => {
            while (next < count && !run_signal.aborted) {
              const id = report.actors[next++]
              const at = Date.now()
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
                const elapsed_ms = Date.now() - at
                check_capacity_result(workload, result)
                if (elapsed_ms > workload.max_ms)
                  throw new Error(`${workload.name}: response limit exceeded`)
                measurements.push(elapsed_ms)
                await journal({
                  type: 'workload',
                  name: workload.name,
                  id,
                  count,
                  elapsed_ms
                })
              } catch (error) {
                controller.abort(error)
                throw error
              }
            }
          }
        )
        const results = await Promise.allSettled(workers)
        const failed = results.find(result => result.status === 'rejected')
        if (failed) throw failed.reason
        run_signal.throwIfAborted()
        measurements.sort((a, b) => a - b)
        level.workloads.push({
          name: workload.name,
          samples: measurements.length,
          p95_ms: measurements[Math.ceil(measurements.length * percentile) - 1],
          max_ms: measurements.at(-1)
        })
        await checkpoint()
      }
    }
  } catch (error) {
    report.stop = String(run_signal.reason?.message ?? error.message)
  } finally {
    controller.abort()
    await monitoring
    for (const id of report.actors.toReversed())
      try {
        await request(
          'DELETE',
          `/v1/actors/${encodeURIComponent(id)}`,
          undefined,
          true
        )
        await journal({ type: 'deleted', id })
      } catch (error) {
        report.cleanup_failures.push({ id, error: error.message })
      }
  }
  report.elapsed_ms = Date.now() - started
  report.estimated_compute_cost =
    (report.elapsed_ms / ms_per_hour) * config.hourly_cost
  report.complete =
    !report.stop && !report.uncertain_create && !report.cleanup_failures.length
  await journal({ type: 'report', ...report })
  return report
}
