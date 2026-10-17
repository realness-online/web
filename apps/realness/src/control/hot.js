/**
 * hs-hot: stop one busy person from starving their neighbours.
 *
 * A halo is shared, so a person whose actor burns CPU or memory slows everyone
 * else on it. Two things follow from that:
 *
 * - A halo that is over its limits should be relieved before it becomes
 *   unreliable, and the actors to move are the ones doing the work, not the
 *   quiet ones.
 * - A person may need more than one halo. Their actor still belongs to one
 *   halo at a time (hs-n2), so this moves the actor, and later a second actor
 *   for the same person can be placed separately.
 *
 * This decides only. Moving is hs-n3's `move`, so a decision cannot half-apply.
 */

class HotError extends Error {}

/** The halo's own report, or what the operator measured: the first limit it crossed. */
const over = (halo, limits) => {
  if (halo.cpu_fraction !== null && halo.cpu_fraction >= limits.cpu_fraction)
    return 'cpu'
  if (
    halo.mem_used_fraction !== null &&
    halo.mem_used_fraction >= limits.mem_used_fraction
  )
    return 'memory'
  if (halo.actors >= limits.actors) return 'actors'
  return null
}

/** How far past its limit a halo is, so the worst comes first. */
const over_by = (halo, because, limits) => {
  if (because === 'actors') return halo.actors / limits.actors
  if (because === 'cpu') return (halo.cpu_fraction ?? 0) / limits.cpu_fraction
  return (halo.mem_used_fraction ?? 0) / limits.mem_used_fraction
}

/**
 * @param {{ name: string, cpu_fraction: number | null, mem_used_fraction: number | null, actors: number }[]} halos
 * @param {{ cpu_fraction: number, mem_used_fraction: number, actors: number }} limits
 * @param {string[]} [only] names to consider; empty means every halo
 * @returns {{ halo: string, because: string, move: string[] }[]}
 */
export const hot_halos = (halos, limits, only = []) => {
  const wanted = only.length
    ? halos.filter(halo => only.includes(halo.name))
    : halos
  const hot = []
  for (const halo of wanted) {
    const because = over(halo, limits)
    if (!because) continue
    hot.push({
      halo: halo.name,
      because,
      over_by: Number(over_by(halo, because, limits).toFixed(3)),
      move: []
    })
  }
  return hot.sort(
    (left, right) =>
      right.over_by - left.over_by || left.halo.localeCompare(right.halo)
  )
}

/**
 * Which actors to take off a hot halo: the busiest, until the halo is under
 * its limit. A quiet actor left behind keeps the halo's memory steady, and
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
 * Destinations are the coolest halos, so relief does not create a new hotspot.
 *
 * @param {{ name: string, cpu_fraction: number | null, mem_used_fraction: number | null, actors: number }[]} fleet
 * @param {{ cpu_fraction: number, mem_used_fraction: number, actors: number }} limits
 * @param {{ halo: string, actors: { id: string, owner: string, cpu_fraction?: number | null, mem_mib?: number | null }[] }} crowded
 * @param {string} owner the person to relieve
 * @param {number} [move] how many of their actors to move; one by default
 */
export const relieve = (fleet, limits, crowded, owner, move = 1) => {
  if (crowded.halo === undefined) throw new HotError('relieve needs a halo')
  const on_halo = fleet.find(halo => halo.name === crowded.halo)
  if (!on_halo) throw new HotError(`no reading for ${crowded.halo}`)
  const mine = crowded.actors.filter(actor => actor.owner === owner)
  if (!mine.length)
    throw new HotError(`${owner} has no actor on ${crowded.halo}`)
  const chosen = busiest(mine, Math.min(move, mine.length))

  const elsewhere = fleet.filter(
    halo => halo.name !== crowded.halo && !over(halo, limits)
  )
  if (!elsewhere.length)
    throw new HotError(
      `every other halo is at its limit; add a halo instead of moving ${owner}`
    )
  const ranked = [...elsewhere].sort(
    (left, right) =>
      right.actors - left.actors ||
      (right.cpu_fraction ?? 0) - (left.cpu_fraction ?? 0) ||
      left.name.localeCompare(right.name)
  )
  return {
    owner,
    from: crowded.halo,
    because: over(on_halo, limits) ?? 'planned',
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
