/**
 * Why a failed halo is quiet, from the provider's own record of it.
 * `off` means powered off or gone; `frozen` means the machine runs but its
 * reports stopped. Anything else is `unknown`: never guess a cause.
 */
const OFF = new Set([
  'TERMINATED',
  'STOPPED',
  'STOPPING',
  'SUSPENDED',
  'SUSPENDING',
  'MISSING'
])

/** @param {string | undefined} status a Compute Engine instance status */
export const power_cause = status => {
  if (status === 'RUNNING') return 'frozen'
  return OFF.has(status ?? '') ? 'off' : 'unknown'
}

export const CAUSE_TEXT = {
  off: 'powered off',
  frozen: 'running but silent',
  unknown: 'cause unknown'
}

/**
 * One read-only listing of every instance in the project, by name. The
 * account needs `compute.instances.list` and nothing more.
 * @param {{ project: string, token: () => Promise<string>, fetcher?: typeof fetch }} options
 * @returns {() => Promise<Map<string, string>>}
 */
export const gce_statuses =
  ({ project, token, fetcher = fetch }) =>
  async () => {
    const url = `https://compute.googleapis.com/compute/v1/projects/${project}/aggregated/instances?fields=items/*/instances(name,status)`
    const reply = await fetcher(url, {
      headers: { authorization: `Bearer ${await token()}` }
    })
    if (!reply.ok) throw new Error(`instance list refused: ${reply.status}`)
    const { items = {} } = await reply.json()
    const statuses = new Map()
    for (const zone of Object.values(items))
      for (const { name, status } of zone.instances ?? [])
        statuses.set(name, status)
    return statuses
  }

/**
 * Label each failed halo. A listing failure labels every halo unknown.
 * @param {{ name: string }[]} halos
 * @param {(() => Promise<Map<string, string>>) | null} statuses
 */
export const with_causes = async (halos, statuses) => {
  if (!halos.length) return halos
  /** @type {Map<string, string> | null} */
  let known = null
  if (statuses)
    try {
      known = await statuses()
    } catch {
      known = null
    }
  return halos.map(halo => ({
    ...halo,
    cause: known ? power_cause(known.get(halo.name) ?? 'MISSING') : 'unknown'
  }))
}
