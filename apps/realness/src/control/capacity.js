import { createHmac as create_hmac } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { run_level } from './capacity-level.js'
import { workload_timeout } from './capacity-workloads.js'

const ms_per_second = 1000
const ms_per_hour = 3600000
const max_timer_ms = 2147483647
const minimum_secret_length = 32
const pass_lifetime_seconds = 240
const no_content_status = 204
const max_repetitions = 100

const authorization = (owner, secret) => {
  const payload = Buffer.from(
    JSON.stringify({
      aud: 'realness-halo',
      phone: owner,
      exp: Math.floor(Date.now() / ms_per_second) + pass_lifetime_seconds
    })
  ).toString('base64url')
  const signature = create_hmac('sha256', secret.trim())
    .update(payload)
    .digest('base64url')
  return `Bearer ${payload}.${signature}`
}

const positive = (value, name) => {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${name} must be positive`)
}

const validate_rounds = config => {
  for (const name of ['mixed', 'verify_cleanup'])
    if (config[name] !== undefined && typeof config[name] !== 'boolean')
      throw new Error(`${name} must be a boolean`)
  const repetitions = config.repetitions ?? 1
  if (
    !Number.isInteger(repetitions) ||
    repetitions < 1 ||
    repetitions > max_repetitions
  )
    throw new Error('repetitions must be an integer from 1 to 100')
  if (
    config.min_guest_overlap !== undefined &&
    (!Number.isInteger(config.min_guest_overlap) ||
      config.min_guest_overlap < 1 ||
      config.min_guest_overlap >
        Math.min(
          config.concurrency,
          config.levels[0],
          config.workloads.length
        ) ||
      !config.mixed ||
      config.workloads.some(workload => workload.guest_evidence !== true))
  )
    throw new Error(
      'guest overlap requires mixed, evidenced workloads and enough actors and concurrency'
    )
}

const verify_actor_cleanup = async request => {
  const remaining = await request('GET', '/v1/actors', undefined, true)
  if (
    !Array.isArray(remaining?.actors) ||
    remaining.actors.some(actor => typeof actor.id !== 'string')
  )
    throw new Error('invalid cleanup actor listing')
  const cleanup_remaining = remaining.actors.map(actor => actor.id)
  return { cleanup_remaining, cleanup_verified: cleanup_remaining.length === 0 }
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
  validate_rounds(config)
  const names = new Set()
  for (const workload of config.workloads) {
    if (!workload.name || names.has(workload.name))
      throw new Error('unique workload names required')
    names.add(workload.name)
    if (
      workload.guest_evidence !== undefined &&
      typeof workload.guest_evidence !== 'boolean'
    )
      throw new Error('guest_evidence must be a boolean')
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
    if (workload_timeout(workload) * ms_per_second >= config.request_ms)
      throw new Error('guest timeout must be below request timeout')
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
  /** @type {{ build_id: string | null, levels: import('./capacity-level.js').CapacityLevel[], actors: string[], cleanup_failures: Array<{ id: string, error: string }>, uncertain_create: boolean, cleanup_verified: boolean | null, cleanup_remaining: string[], stop: string | null, safe_count: null, elapsed_ms?: number, estimated_compute_cost?: number, complete?: boolean }} */
  const report = {
    build_id: config.build_id ?? null,
    levels: [],
    actors: [],
    cleanup_failures: [],
    uncertain_create: false,
    cleanup_verified: null,
    cleanup_remaining: [],
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
    const response = await fetch(new URL(path, config.api), {
      method,
      headers: {
        authorization: authorization(config.owner, secret),
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
    await journal({
      type: 'start',
      owner: config.owner,
      levels: config.levels,
      build_id: report.build_id
    })
    await checkpoint()
    const health = await request('GET', '/v1/health')
    if (!health.ok || !health.seed?.matches)
      throw new Error('halo seed is not ready')
    if (config.verify_cleanup) {
      const before = await request('GET', '/v1/actors')
      if (!Array.isArray(before?.actors) || before.actors.length)
        throw new Error('capacity requires an empty dedicated test identity')
    }
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
      report.levels.push(
        await run_level({
          config,
          count,
          actors: report.actors,
          request,
          checkpoint,
          journal,
          controller,
          signal: run_signal
        })
      )
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
  if (config.verify_cleanup)
    try {
      Object.assign(report, await verify_actor_cleanup(request))
    } catch (error) {
      report.cleanup_verified = false
      report.stop ??= `cleanup verification: ${error.message}`
    }
  report.elapsed_ms = Date.now() - started
  report.estimated_compute_cost =
    (report.elapsed_ms / ms_per_hour) * config.hourly_cost
  report.complete =
    !report.stop &&
    !report.uncertain_create &&
    !report.cleanup_failures.length &&
    report.cleanup_verified !== false
  await journal({ type: 'report', ...report })
  return report
}
