// m7: which hosts have stopped reporting. Sync holds every host's record and
// lives outside the host's failure domain, so a host cannot hide going quiet.
// The answer is derived at read time; nothing extra is stored.
import { read_status } from "./host-status.js"

// Four 30-second report intervals (host/src/status.js STATUS_MS). Past this a
// host is quiet: a record kept past its life is the only thing left to read.
export const QUIET_AFTER_MS = 120_000

const HOST = /^[a-z0-9][a-z0-9-]{0,62}$/

/**
 * Hosts whose last record is older than `quiet_ms`, oldest first. A record
 * that cannot be parsed is quiet too: an unreadable timestamp is not proof
 * of life. A list failure is an empty list, not a crash.
 */
export const quiet_hosts = async (storage, { now = Date.now(), quiet_ms = QUIET_AFTER_MS } = {}) => {
  const folders = (await storage.list("hosts/")).folders ?? []
  const quiet = []
  for (const name of folders) {
    if (!HOST.test(name)) continue
    const file = await storage.get(`hosts/${name}/status.html`)
    const checked = file ? read_status(file.body.toString("utf8")).host?.checked ?? "" : ""
    const at = Date.parse(checked)
    const age_s = Number.isFinite(at) ? Math.max(0, Math.floor((now - at) / 1000)) : null
    if (age_s === null || age_s * 1000 > quiet_ms) quiet.push({ name, checked, age_s })
  }
  return quiet.sort((a, b) => (b.age_s ?? Infinity) - (a.age_s ?? Infinity))
}

/** The derived answer, as JSON: what a reader sees without polling the host. */
export const host_health = async (storage, { now = Date.now(), quiet_ms = QUIET_AFTER_MS } = {}) => {
  return { checked: new Date(now).toISOString(), quiet_ms, quiet: await quiet_hosts(storage, { now, quiet_ms }) }
}