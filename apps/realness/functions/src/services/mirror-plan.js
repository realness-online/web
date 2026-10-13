import { isDeepStrictEqual as is_deep_strict_equal } from 'node:util'
import { mirror_name } from '#services/mirror-name.js'
import { representation } from '#services/migration-report.js'

const revision = object => object && ({
  generation: object.generation, metageneration: object.metageneration
})
const valid = object => object && object.md5Hash &&
  [object.generation, object.metageneration].every(value =>
    typeof value === 'string' && /^[1-9]\d*$/.test(value)
  )
const unchanged = (object, previous) =>
  Boolean(previous && is_deep_strict_equal(revision(object), previous))

/**
 * Pure reconciliation policy. Inspect LIVE heads, never act on event payload
 * bytes. Synced holds the exact two revisions last confirmed equivalent.
 * A durable coordinator must serialize each pair and recover pending storage
 * operations before using this planner. Client writes remain outside its lock:
 * every returned operation therefore also carries storage preconditions.
 *
 * Do not invent last-write-wins across names. Concurrent divergent edits and
 * delete-versus-edit conflicts stop for review, preserving the surviving data.
 * Copy markers are irrelevant: clients can retain them on their next save.
 * @param {object} options
 * @param {string} options.name Either member of the pair
 * @param {object} options.heads Metadata by object name; null means absent
 * @param {object} [options.synced] Last equivalent byte/metadata revisions
 * @param {{name: string, generation: string}} [options.deletion] Delete event
 * @param {boolean} [options.pending] An operation has an unresolved outcome
 */
export const mirror_plan = ({ name, heads, synced = {}, deletion, pending = false }) => {
  const paired = mirror_name(name)
  if (!paired) return { action: 'ignore' }
  if (pending) return { action: 'wait', reason: 'unresolved-operation' }
  const names = [name, paired].sort()
  const present = names.filter(key => heads[key])
  if (!present.length) return { action: 'settled', synced: {} }
  if (present.some(key => !valid(heads[key])))
    return { action: 'conflict', reason: 'unverified-revision' }

  const copy = source_name => {
    const source = heads[source_name]
    const target = heads[mirror_name(source_name)]
    if (target?.metadata?.sold === 'true' && source.metadata?.sold !== 'true')
      return { action: 'conflict', reason: 'sold-state-regression' }
    return {
      action: 'copy', name: source_name,
      source_generation: source.generation,
      source_metageneration: source.metageneration,
      target_generation: target?.generation || '0',
      ...(target ? { target_metageneration: target.metageneration } : {})
    }
  }

  if (present.length === 1) {
    const [live_name] = present
    const missing_name = mirror_name(live_name)
    if (!synced[missing_name]) return copy(live_name)
    if (!deletion || deletion.name !== missing_name ||
      deletion.generation !== synced[missing_name].generation)
      return { action: 'wait', reason: 'missing-delete-evidence' }
    if (!unchanged(heads[live_name], synced[live_name]))
      return { action: 'conflict', reason: 'delete-versus-edit' }
    return {
      action: 'delete', name: missing_name,
      target_generation: heads[live_name].generation,
      target_metageneration: heads[live_name].metageneration
    }
  }

  const [left, right] = names
  if (is_deep_strict_equal(representation(heads[left]), representation(heads[right]))) {
    return {
      action: 'settled', synced: {
        [left]: revision(heads[left]), [right]: revision(heads[right])
      }
    }
  }
  const changed = names.filter(key => !unchanged(heads[key], synced[key]))
  if (changed.length === 1) return copy(changed[0])
  return { action: 'conflict', reason: 'divergent-revisions' }
}
