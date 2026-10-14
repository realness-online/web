import { read_status } from './host-status.js'
import { MS_PER_SECOND } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- hosts are read one at a time to keep storage reads low */

export const QUIET_AFTER_MS = 120_000

const HOST = /^[a-z0-9][a-z0-9-]{0,62}$/

/**
 * Hosts whose last record is older than `quiet_ms`, oldest first. A record
 * that cannot be parsed is quiet too: an unreadable timestamp is not proof
 * of life. A list failure is an empty list, not a crash.
 */
export const quiet_hosts = async (
  storage,
  { now = Date.now(), quiet_ms = QUIET_AFTER_MS } = {}
) => {
  const folders = (await storage.list('hosts/')).folders ?? []
  const quiet = []
  for (const name of folders) {
    if (!HOST.test(name)) continue
    const file = await storage.get(`hosts/${name}/status.html`)
    const checked = file
      ? (read_status(file.body.toString('utf8')).host?.checked ?? '')
      : ''
    const at = Date.parse(checked)
    const age_s = Number.isFinite(at)
      ? Math.max(0, Math.floor((now - at) / MS_PER_SECOND))
      : null
    if (age_s === null || age_s * MS_PER_SECOND > quiet_ms)
      quiet.push({ name, checked, age_s })
  }
  return quiet.sort((a, b) => (b.age_s ?? Infinity) - (a.age_s ?? Infinity))
}

/** The derived answer, as JSON: what a reader sees without polling the host. */
export const host_health = async (
  storage,
  { now = Date.now(), quiet_ms = QUIET_AFTER_MS } = {}
) => ({
  checked: new Date(now).toISOString(),
  quiet_ms,
  quiet: await quiet_hosts(storage, { now, quiet_ms })
})
