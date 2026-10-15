/**
 * hs-hot: stop one busy person from starving their neighbours.
 *
 * A host is shared, so a person whose actor burns CPU or memory slows everyone
 * else on it. Two things follow from that:
 *
 * - A host that is over its limits should be relieved before it becomes
 *   unreliable, and the actors to move are the ones doing the work, not the
 *   quiet ones.
 * - A person may need more than one host. Their actor still belongs to one
 *   host at a time (hs-n2), so this moves the actor, and later a second actor
 *   for the same person can be placed separately.
 *
 * This decides only. Moving is hs-n3's `move`, so a decision cannot half-apply.
 */

class HotError extends Error {}

/** The host's own report, or what the operator measured: the first limit it crossed. */
const over = (host, limits) => {
  if (host.cpu_fraction !== null && host.cpu_fraction >= limits.cpu_fraction)
    return 'cpu'
  if (
    host.mem_used_fraction !== null &&
    host.mem_used_fraction >= limits.mem_used_fraction
  )
    return 'memory'
  if (host.actors >= limits.actors) return 'actors'
  return null
}

/** How far past its limit a host is, so the worst comes first. */
const over_by = (host, because, limits) => {
  if (because === 'actors') return host.actors / limits.actors
  if (because === 'cpu') return (host.cpu_fraction ?? 0) / limits.cpu_fraction
  return (host.mem_used_fraction ?? 0) / limits.mem_used_fraction
}

/**
 * @param {{ name: string, cpu_fraction: number | null, mem_used_fraction: number | null, actors: number }[]} hosts
 * @param {{ cpu_fraction: number, mem_used_fraction: number, actors: number }} limits
 * @param {string[]} [only] names to consider; empty means every host
 * @returns {{ host: string, because: string, move: string[] }[]}
 */
export const hot_hosts = (hosts, limits, only = []) => {
  const wanted = only.length
    ? hosts.filter(host => only.includes(host.name))
    : hosts
  const hot = []
  for (const host of wanted) {
    const because = over(host, limits)
    if (!because) continue
    hot.push({
      host: host.name,
      because,
      over_by: Number(over_by(host, because, limits).toFixed(3)),
      move: []
    })
  }
  return hot.sort(
    (left, right) =>
      right.over_by - left.over_by || left.host.localeCompare(right.host)
  )
}

/**
 * Which actors to take off a hot host: the busiest, until the host is under
 * its limit. A quiet actor left behind keeps the host's memory steady, and
 * moving the busy ones is what actually relieves it.
 *
 * @param {{ id: string, owner: string, cpu_fraction?: number | null, mem_mib?: number | null }[]} actors
 * @param {number} count how many to move
 */
export const busiest = (actors, count) =>
  [...actors]
    .sort(
      (left, right) =>
        (right.cpu_fraction ?? 0) - (left.cpu_fraction ?? 0) ||
        (right.mem_mib ?? 0) - (left.mem_mib ?? 0) ||
        left.id.localeCompare(right.id)
    )
    .slice(0, count)

/**
 * Plan relief for one account: how many actors to move, and to where.
 * Destinations are the coolest hosts, so relief does not create a new hotspot.
 *
 * @param {{ name: string, cpu_fraction: number | null, mem_used_fraction: number | null, actors: number }[]} fleet
 * @param {{ cpu_fraction: number, mem_used_fraction: number, actors: number }} limits
 * @param {{ host: string, actors: { id: string, owner: string, cpu_fraction?: number | null, mem_mib?: number | null }[] }} crowded
 * @param {string} owner the person to relieve
 * @param {number} [move] how many of their actors to move; one by default
 */
export const relieve = (fleet, limits, crowded, owner, move = 1) => {
  if (crowded.host === undefined) throw new HotError('relieve needs a host')
  const on_host = fleet.find(host => host.name === crowded.host)
  if (!on_host) throw new HotError(`no reading for ${crowded.host}`)
  const mine = crowded.actors.filter(actor => actor.owner === owner)
  if (!mine.length)
    throw new HotError(`${owner} has no actor on ${crowded.host}`)
  const chosen = busiest(mine, Math.min(move, mine.length))

  const elsewhere = fleet.filter(
    host => host.name !== crowded.host && !over(host, limits)
  )
  if (!elsewhere.length)
    throw new HotError(
      `every other host is at its limit; add a host instead of moving ${owner}`
    )
  const ranked = [...elsewhere].sort(
    (left, right) =>
      right.actors - left.actors ||
      (right.cpu_fraction ?? 0) - (left.cpu_fraction ?? 0) ||
      left.name.localeCompare(right.name)
  )
  return {
    owner,
    from: crowded.host,
    because: over(on_host, limits) ?? 'planned',
    to: ranked[0].name,
    actors: chosen.map(actor => actor.id)
  }
}

export const hot_text = plans => {
  const lines = []
  for (const plan of plans)
    lines.push(
      `${plan.owner}: move ${plan.actors.join(', ')} from ${plan.from} to ${plan.to} (${plan.because})`
    )
  return lines.join('\n')
}

export { HotError }
