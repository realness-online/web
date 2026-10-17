import { readFile as read_file } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const default_timeout_s = 120
const max_timeout_s = 1800

export const prepare_workloads = (workloads, config_file) => {
  const inputs = new Map()
  return Promise.all(
    workloads.map(async workload => {
      if (!workload.stdin_file) return { ...workload }
      const path = resolve(dirname(resolve(config_file)), workload.stdin_file)
      if (!inputs.has(path)) inputs.set(path, read_file(path))
      return {
        ...workload,
        stdin_b64: (await inputs.get(path)).toString('base64')
      }
    })
  )
}

export const workload_timeout = stage => {
  const timeout_s = stage.timeout_s ?? default_timeout_s
  if (
    !Number.isFinite(timeout_s) ||
    timeout_s <= 0 ||
    timeout_s > max_timeout_s
  )
    throw new Error(
      'workload timeout must be above zero and at most 1800 seconds'
    )
  return timeout_s
}
