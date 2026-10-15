/**
 * hs-f3: recover a failed host's actors on the hosts that are still up.
 *
 * A host that stopped answering cannot be asked to export anything, so the
 * actors come back from the bundles drain already shipped to the bucket. The
 * order matters twice:
 *
 * 1. Authority goes first (hs-f2). The old host may still be running
 *    somewhere, and if it wakes up after its actors have been recreated it
 *    would write over them. Revoking before any restore closes that window.
 * 2. The placement moves only after the restored actor is confirmed, so the
 *    gate never sends a person to an actor that is not there yet.
 *
 * Nothing here decides that a host has failed. Detection is hs-m7b's quiet
 * label; this takes that verdict as an input.
 */
import { note, step } from './exec.js'
/* eslint-disable no-await-in-loop -- actors recover one at a time so a failure names its actor */

class RecoverError extends Error {}

/**
 * @param {string} from the failed host name
 * @param {object} options
 * @param {string} options.reason why it is being recovered, for the log
 * @param {{ id: string, owner: string, state?: string }[]} options.actors last reported on it
 * @param {string[]} options.hosts hosts that may take an actor
 * @param {(host: string) => object} options.api an API for a surviving host
 * @param {(from: string) => Promise<{ revoked_at?: string, fenced?: boolean }>} options.revoke hs-f2
 * @param {(id: string) => Promise<{ bundle: string } | null>} options.bundle where the export is
 * @param {(host: string, id: string, owner: string, bundle: string) => Promise<{ id: string }>} options.restore
 * @param {(owner: string, host: string) => Promise<{ host: string }>} options.place
 * @param {(host: string) => Promise<number>} [options.load] actors already on a host
 */
export const recover = async (
  from,
  {
    reason,
    actors,
    hosts,
    api,
    revoke,
    bundle,
    restore,
    place,
    load = () => Promise.resolve(0)
  }
) => {
  if (!from) throw new RecoverError('recover needs the failed host name')
  const alive = hosts.filter(host => host !== from)
  if (!alive.length)
    throw new RecoverError(
      `no host can take an actor from ${from}: one host is a single point of failure`
    )

  step(`revoke ${from} before anything is restored`)
  note(reason)
  const revoked = await revoke(from)

  const recovered = []
  const lost = []
  const skipped = []

  for (const actor of actors) {
    if (actor.state === 'incomplete') {
      skipped.push(actor.id)
      continue
    }
    const shipped = await bundle(actor.id)
    if (!shipped) {
      lost.push(actor.id)
      note(`${actor.id}: no bundle in the bucket`)
      continue
    }

    const target = await least_loaded(alive, load)
    let restored
    try {
      restored = await restore(target, actor.id, actor.owner, shipped.bundle)
    } catch (error) {
      note(`${actor.id}: ${target} refused it (${error.message})`)
      lost.push(actor.id)
      continue
    }

    // hs-f2 and hs-n2: authority is already gone; now the person follows.
    if (restored.id === actor.id)
      throw new RecoverError(
        `${target} reused ${actor.id}; the old actor may still be reachable`
      )
    const moved = await place(actor.owner, target)
    recovered.push({
      person: actor.owner,
      was: actor.id,
      now: restored.id,
      host: moved.host
    })
    note(`${actor.owner}: ${actor.id} -> ${restored.id} on ${moved.host}`)
  }

  return {
    from,
    revoked: revoked.revoked_at ?? 'now',
    recovered,
    lost,
    skipped
  }
}

/** Fewest reported actors wins; ties go to the first named, so a run repeats. */
const least_loaded = async (hosts, load) => {
  let [best] = hosts
  let fewest = await load(best)
  for (const host of hosts.slice(1)) {
    const count = await load(host)
    if (count < fewest) {
      best = host
      fewest = count
    }
  }
  return best
}

export const recover_text = result => {
  const lines = [
    `${result.from}: revoked ${result.revoked}, ${result.recovered.length} recovered, ${result.lost.length} lost, ${result.skipped.length} incomplete`
  ]
  for (const actor of result.recovered)
    lines.push(
      `  ${actor.person}: ${actor.was} -> ${actor.now} on ${actor.host}`
    )
  for (const id of result.lost) lines.push(`  LOST ${id}`)
  return lines.join('\n')
}

export { RecoverError }
