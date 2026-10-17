/**
 * hs-n4: stop a halo once its actors have moved.
 *
 * A move exports an actor, restores it on another halo, and reassigns the
 * person's placement. Only then may the old halo go. This refuses to do
 * anything while the halo still reports an actor, because an actor on the old
 * halo is work that has not moved, and losing it would be silent.
 *
 * Runs on the control plane. The halo has no credentials of its own, so the
 * delete comes from here, after the placement records no longer name it.
 */
import { note, step } from './exec.js'

class RetireError extends Error {}

/**
 * @param {{ call: (path: string) => Promise<string> }} api the old halo's API
 * @param {{ release: (halo: string) => Promise<number> }} placements
 * @param {{ stop: (name: string) => Promise<void>, drop: (name: string) => Promise<void> }} halo
 * @param {string} name
 * @param {{ delete?: boolean }} [options]
 */
export const retire = async (
  api,
  placements,
  halo,
  name,
  { delete: drop = false } = {}
) => {
  const listing = JSON.parse((await api.call('/v1/actors')) || '{}')
  const actors = listing.actors ?? []
  const alive = actors.filter(actor => actor.state !== 'incomplete')
  if (alive.length)
    throw new RetireError(
      `${name} still holds ${alive.length} actor(s): ${alive.map(actor => actor.id).join(', ')}`
    )

  step(`release placements on ${name}`)
  const released = await placements.release(name)
  note(
    `${released} placements released, ${actors.length - alive.length} incomplete`
  )

  if (drop) {
    step(`delete ${name}`)
    await halo.drop(name)
  } else {
    step(`stop ${name}`)
    await halo.stop(name)
  }
  return { halo: name, actors: actors.length, released, deleted: drop }
}

export { RetireError }
