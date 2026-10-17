/**
 * hs-n5: before a halo goes, say where each of its actors came back.
 *
 * Draining proves a bundle reached the bucket. It does not prove the actor
 * works somewhere else. This compares the actor list on the halo being drained
 * against the actors the rest of the fleet reports, from sync's halo status,
 * and names anything that has no home yet.
 *
 * The fleet is an input, not a lookup, so this runs and is tested without a
 * live halo. Reading it is the operator's step.
 */
import { HTTP } from '#root/lib/http.js'

class ConfirmError extends Error {}

/**
 * @param {string} name the halo being drained
 * @param {{ actors: { id: string, state: string }[] }} leaving its API listing
 * @param {{ name: string, actors: { id: string, state: string }[] }[]} fleet the other halos
 * @returns {{ confirmed: { id: string, on: string }[], lost: string[], skipped: string[] }}
 */
export const confirm = (name, leaving, fleet) => {
  const others = fleet.filter(halo => halo.name !== name)
  const found = new Map()
  for (const halo of others)
    for (const actor of halo.actors ?? [])
      if (actor.state !== 'incomplete') found.set(actor.id, halo.name)

  const confirmed = []
  const lost = []
  const skipped = []
  for (const actor of leaving.actors ?? []) {
    if (actor.state === 'incomplete') {
      skipped.push(actor.id)
      continue
    }
    const on = found.get(actor.id)
    if (on) confirmed.push({ id: actor.id, on })
    else lost.push(actor.id)
  }
  return { confirmed, lost, skipped }
}

/**
 * Refuse to let the halo go while any actor has no home, and name the ones
 * that do. A person's placement follows the actor, so a lost actor is also a
 * person whose next request would land on the wrong halo.
 *
 * @param {string} name
 * @param {{ actors: { id: string, state: string }[] }} leaving
 * @param {{ name: string, actors: { id: string, state: string }[] }[]} fleet
 */
export const require_homes = (name, leaving, fleet) => {
  const result = confirm(name, leaving, fleet)
  if (result.lost.length)
    throw new ConfirmError(
      `${name} still owns ${result.lost.length} actor(s) with no home: ${result.lost.join(', ')}`
    )
  return result
}

export const confirm_text = name => result => {
  const lines = [
    `${name}: ${result.confirmed.length} confirmed, ${result.skipped.length} incomplete`
  ]
  for (const actor of result.confirmed)
    lines.push(`  ${actor.id} on ${actor.on}`)
  for (const id of result.skipped) lines.push(`  ${id} has no disk, not moved`)
  return lines.join('\n').slice(0, HTTP.BAD_REQUEST)
}

export { ConfirmError }
