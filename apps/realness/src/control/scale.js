/**
 * hs-d1: one host, or a swarm.
 *
 * The question is not which is nicer. It is which limit binds first, and what
 * that costs. Three things can run out:
 *
 * - Memory: actors are what fill a host, and the memory guard stops creation
 *   before the host is exhausted.
 * - Addresses: one host has 254 actor TAPs (hs-tap), so 200 actors is a hard
 *   ceiling whatever the machine size.
 * - Budget: a second host is a second hourly bill, and the plan's ceiling is
 *   $100 a month.
 *
 * The answer is a written choice with the binding limit named, so a later
 * reader can check the arithmetic instead of trusting the conclusion. This
 * takes the measured numbers as arguments; the run that produces them is
 * hs-cap, and nothing here invents one.
 */

/** The plan's compute ceiling, in dollars a month. */
export const BUDGET_USD = 100

/** Actor TAPs one host can address; hs-tap raised the old 63 to this. */
export const ACTOR_TAPS = 254

class ScaleError extends Error {}

/**
 * @param {object} options
 * @param {number} options.actors_per_host measured actors one host held under representative work
 * @param {number} options.hourly_cost one host's price in dollars an hour
 * @param {number} [options.budget_usd] monthly ceiling
 * @param {number} [options.taps] actor addresses on one host
 * @param {number} [options.demand] actors needed now; defaults to what one host holds
 */
export const scale_choice = ({
  actors_per_host,
  hourly_cost,
  budget_usd = BUDGET_USD,
  taps = ACTOR_TAPS,
  demand = actors_per_host
}) => {
  if (!(actors_per_host > 0))
    throw new ScaleError('scale needs a measured actor count above zero')
  if (!(hourly_cost > 0)) throw new ScaleError('scale needs an hourly price')
  if (demand > taps)
    throw new ScaleError(
      `one host cannot address ${demand} actors: ${taps} TAPs is the ceiling`
    )

  const hosts = Math.max(1, Math.ceil(demand / actors_per_host))
  const monthly = hosts * hourly_cost * HOURS
  const room = Math.floor(budget_usd / (hourly_cost * HOURS))

  /** What runs out first, in the order a host would hit it. Memory is what fills a host, so it comes before the budget; addresses are per host, so they come last. */
  const binding = first_limit({ demand, actors_per_host, hosts, room, taps })

  return {
    hosts,
    actors_per_host,
    demand,
    monthly_usd: round(monthly),
    budget_room_hosts: room,
    taps,
    binding,
    choice:
      hosts === 1
        ? `one host: no second host earns its bill yet (${binding} binds first)`
        : `${hosts} hosts: ${demand} actors need more than ${
            actors_per_host
          } each (${binding} binds first)`,
    because: [
      `${demand} actors / ${actors_per_host} per host = ${hosts} host(s)`,
      `$${round(monthly)} a month at $${hourly_cost}/hour, ceiling $${budget_usd}`,
      `${
        binding === 'none today'
          ? 'no measured limit binds at this demand'
          : `${binding} is the next limit`
      }`
    ]
  }
}

export const HOURS = 730
const DEMAND_MARGIN = 10
const CENTS = 100
/** Money to the cent, so a printed price is not a long fraction. */
const round = value => Math.round(value * CENTS) / CENTS

/** The limit a host hits first, in the order it would hit them. */
const first_limit = ({ demand, actors_per_host, hosts, room, taps }) => {
  if (demand > actors_per_host) return 'memory'
  if (hosts > room) return 'budget'
  if (taps - demand <= DEMAND_MARGIN) return 'addresses'
  return 'none today'
}

export const scale_text = choice => {
  const lines = [`${choice.choice}`]
  for (const line of choice.because) lines.push(`  ${line}`)
  if (choice.binding === 'addresses')
    lines.push(
      `  ${choice.taps} TAPs is per host: more actors need another host, not a bigger one`
    )
  return lines.join('\n')
}

export { ScaleError }
