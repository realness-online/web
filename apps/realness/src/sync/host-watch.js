import { read_host_state } from './host-lifecycle.js'
import { with_causes } from './host-power.js'
import { MS_PER_SECOND } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- hosts are read one at a time to keep storage reads low */

export const QUIET_AFTER_MS = 120_000

const HOST = /^[a-z0-9][a-z0-9-]{0,62}$/

/**
 * Every host with its state: parked, starting, running, stopping, or failed.
 * An unreadable report time is not proof of life. A list failure is an
 * empty list, not a crash.
 */
export const host_states = async (
  storage,
  { now = Date.now(), quiet_ms = QUIET_AFTER_MS } = {}
) => {
  const folders = (await storage.list('hosts/')).folders ?? []
  const hosts = []
  for (const name of folders) {
    if (!HOST.test(name)) continue
    const { checked, state } = await read_host_state(storage, name, {
      now,
      quiet_ms
    })
    const at = Date.parse(checked)
    const age_s = Number.isFinite(at)
      ? Math.max(0, Math.floor((now - at) / MS_PER_SECOND))
      : null
    hosts.push({ name, checked, age_s, state })
  }
  return hosts
}

const failed = hosts =>
  hosts
    .filter(host => host.state === 'failed')
    .map(({ name, checked, age_s }) => ({ name, checked, age_s }))
    .sort((a, b) => (b.age_s ?? Infinity) - (a.age_s ?? Infinity))

/**
 * Failed hosts only, oldest first, each with its provider cause. Planned
 * parking and bounded stops never alert.
 * @param {object} storage
 * @param {{ now?: number, quiet_ms?: number, statuses?: (() => Promise<Map<string, string>>) | null }} [options]
 */
export const quiet_hosts = async (
  storage,
  { statuses = null, ...options } = {}
) => with_causes(failed(await host_states(storage, options)), statuses)

/** The derived answer, as JSON: what a reader sees without polling the host. */
export const host_health = async (
  storage,
  { now = Date.now(), quiet_ms = QUIET_AFTER_MS, statuses = null } = {}
) => {
  const hosts = await host_states(storage, { now, quiet_ms })
  return {
    checked: new Date(now).toISOString(),
    quiet_ms,
    quiet: await with_causes(failed(hosts), statuses),
    hosts: hosts.map(({ name, state }) => ({ name, state }))
  }
}
