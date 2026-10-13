import { isDeepStrictEqual as is_deep_strict_equal } from 'node:util'
import { mirror_name } from '#services/mirror-name.js'
import { mirror_plan } from '#services/mirror-plan.js'
import { mirror_copy } from '#services/mirror-copy.js'
import { mirror_delete } from '#services/mirror-delete.js'
import { representation } from '#services/migration-report.js'

const head = async (bucket, name) => {
  try {
    const [metadata] = await bucket.file(name).getMetadata()
    return metadata
  } catch (error) {
    if (Number(error.code) === 404) return null
    throw error
  }
}

const stored = object => JSON.parse(JSON.stringify(representation(object)))

const revision = object => object && ({
  generation: String(object.generation), metageneration: String(object.metageneration)
})
const revisions = heads => Object.fromEntries(
  Object.entries(heads).map(([name, object]) => [name, revision(object)])
)

/**
 * What an interrupted operation left behind, judged only from live heads.
 * Every operation is revision-guarded, so it either ran against exactly the
 * inspected revisions or not at all; no outcome needs to be replayed blind.
 * If the counterpart now holds the copied representation, the copy ran and
 * becomes the new baseline. Otherwise the baseline stands and the pair is
 * planned afresh: a copy that never ran is re-planned under fresh guards,
 * and anything a client changed meanwhile is judged like any other edit.
 * @returns {object} synced baseline to plan against
 */
const recover = (pending, synced, heads) => {
  const target_name = mirror_name(pending.name)
  const target = heads[target_name]
  if (pending.action === 'copy' && target &&
    is_deep_strict_equal(stored(target), pending.source_representation))
    {return {
      ...synced,
      [pending.name]: { generation: pending.source_generation, metageneration: pending.source_metageneration },
      [target_name]: revision(target)
    }}
  if (pending.action === 'delete' && !target) return {}
  return synced
}

/**
 * One reconciliation pass under a durable pair lease from the journal.
 * Client writes are outside the lease, so every operation also carries
 * Storage revision guards, and outcomes are read back from live heads.
 *
 * A conflict is recorded with the heads it was judged on. While those heads
 * stand, later events for the pair return the same conflict without retrying;
 * any change to either name re-plans it.
 * @param {object} options
 * @param {object} options.bucket
 * @param {object} options.journal with_pair(name, callback), session.read/write
 * @param {string} options.name
 * @param {object} [options.deletion]
 */
export const mirror_reconcile = async ({ bucket, journal, name, deletion }) => {
  const paired = mirror_name(name)
  if (!paired) return { action: 'ignore' }
  const [pair_key] = [name, paired].sort()
  return journal.with_pair(pair_key, async session => {
    const state = await session.read() || {}
    const read_heads = async () => {
      const [left, right] = await Promise.all([head(bucket, name), head(bucket, paired)])
      return { [name]: left, [paired]: right }
    }
    const heads = await read_heads()
    const synced = state.pending
      ? recover(state.pending, state.synced || {}, heads)
      : state.synced || {}
    if (state.conflict && is_deep_strict_equal(state.conflict.heads, revisions(heads)))
      return { action: 'conflict', reason: state.conflict.reason, recorded: true }

    const plan = mirror_plan({ name, heads, synced, deletion })
    if (plan.action === 'settled') {
      await session.write({ synced: plan.synced })
      return plan
    }
    if (plan.action === 'conflict') {
      await session.write({ synced, conflict: { reason: plan.reason, heads: revisions(heads) } })
      return plan
    }
    if (!['copy', 'delete'].includes(plan.action)) {
      await session.write({ synced })
      return plan
    }
    const source = heads[plan.name]
    const pending = plan.action === 'copy'
      ? { ...plan, source_representation: stored(source) }
      : plan
    await session.write({ synced, pending })
    try {
      if (plan.action === 'copy') await mirror_copy({ bucket, ...plan })
      else await mirror_delete({ bucket, ...plan })
    } catch (error) {
      if ([404, 412].includes(Number(error.code))) await session.write({ synced })
      throw error
    }
    const after = await read_heads()
    const baseline = recover(pending, synced, after)
    const confirmed = mirror_plan({ name, heads: after, synced: baseline })
    await session.write({ synced: confirmed.action === 'settled' ? confirmed.synced : baseline })
    return confirmed.action === 'settled'
      ? confirmed : { action: 'wait', reason: 'post-operation-divergence' }
  })
}
