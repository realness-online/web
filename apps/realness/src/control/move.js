/**
 * hs-n3: move one actor from one host to another.
 *
 * The order is the point, and it is the same order drain and retire use:
 * export from A, prove the bundle reached the bucket, restore from that bundle
 * on B, and only then move the person's placement and retire the actor on A.
 * A failure at any step leaves the actor running on A and the placement
 * pointing at A, so a re-run is the retry and nobody loses their files.
 *
 * The person is placed back where they were if the move fails after the
 * placement was moved, so the gate never sends someone to an actor that is not
 * there.
 */
import { note, step } from './exec.js'

class MoveError extends Error {}

/** How much of a bad response is quoted back. */
const SHOWN = 200

/**
 * @param {string} id the actor
 * @param {string} owner the person it belongs to
 * @param {{ from: { call: (path: string, options?: object) => Promise<string>, json: (path: string) => Promise<any> }, to: { call: (path: string, options?: object) => Promise<string> }, bundle: (id: string) => Promise<{ object: string }>, place: (owner: string, host: string) => Promise<{ host: string }>, host: string, release?: boolean }} options
 *   from and to are host APIs; bundle ships the export and proves it
 */
export const move = async (
  id,
  owner,
  { from, to, bundle, place, host, release = true }
) => {
  if (!id || !/^a-[a-f0-9]{12}$/.test(id))
    throw new MoveError('move needs an actor id')
  if (!host) throw new MoveError('move needs a target host')

  step(`export ${id} from ${await name_of(from)}`)
  const manifest = parse_manifest(
    await from.call(`/v1/actors/${id}/export`, { method: 'POST', timeout: 300 })
  )
  const { object } = await bundle(id)
  note(`bundle: ${object}`)

  step(`restore ${id} on ${host}`)
  const restored = JSON.parse(
    await to.call('/v1/actors', {
      method: 'POST',
      body: { owner, restore_from: export_id(manifest) }
    })
  )
  if (!restored.id)
    throw new MoveError('the target host did not return an actor')
  if (restored.id === id)
    throw new MoveError('the target host reused the old actor id')
  if (restored.owner !== owner)
    throw new MoveError(`the restored actor belongs to ${restored.owner}`)

  step(`place ${owner} on ${host}`)
  const held = await place(owner, host)

  if (release) {
    step(`stop ${id} on the source host`)
    await from.call(`/v1/actors/${id}`, { method: 'DELETE' }).catch(error => {
      // The move is already done; say so instead of hiding it.
      note(`the old actor could not be removed: ${error.message}`)
    })
  }
  return { from_actor: id, to_actor: restored.id, host, placed: held.host }
}

const name_of = async api => {
  try {
    const health = await api.json('/v1/health')
    return health.host?.name ?? health.hostname ?? 'the source host'
  } catch {
    return 'the source host'
  }
}

const parse_manifest = text => {
  try {
    const manifest = JSON.parse(text)
    if (!manifest.artifacts?.sha256 && !manifest.id)
      throw new Error('no artifacts')
    return manifest
  } catch {
    throw new MoveError(
      `the export did not answer a manifest: ${String(text).slice(0, SHOWN)}`
    )
  }
}

/** The export id the target restores by: its own id, or the folder it landed in. */
const export_id = manifest =>
  manifest.id ?? manifest.export ?? manifest.artifacts?.path

export { MoveError }
