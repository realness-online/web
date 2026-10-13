import { createHash as create_hash, randomUUID as random_uuid } from 'node:crypto'

const LEASE_MS = 60_000

export class MirrorBusy extends Error {}
export class MirrorLeaseLost extends Error {}

/**
 * Durable per-pair journal. All lease ownership changes use Firestore
 * transactions; a former holder cannot confirm or clear a newer intent.
 * Pending Storage operations survive crashes and lease expiry.
 *
 * This lock serializes mirror workers, not direct Storage clients. The
 * reconciler must still use Storage revision guards and inspect live heads.
 * Firestore access to this collection must be admin-only before deployment.
 * @param {object} options
 * @param {import('firebase-admin/firestore').Firestore} options.db
 * @param {() => number} [options.now]
 * @param {() => string} [options.new_token]
 * @param {number} [options.lease_ms]
 */
export const mirror_journal = ({
  db, now = Date.now, new_token = random_uuid, lease_ms = LEASE_MS
}) => ({
  with_pair: async (name, run) => {
    const key = create_hash('sha256').update(name).digest('hex')
    const ref = db.collection('html-migration-journal').doc(key)
    const token = new_token()
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref)
      const record = snapshot.data() || {}
      if (record.lease?.until > now()) throw new MirrorBusy('Pair is already locked')
      transaction.set(ref, {
        ...record, name, lease: { token, until: now() + lease_ms }
      })
    })

    const access = async next => db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref)
      const record = snapshot.data() || {}
      if (record.lease?.token !== token || record.lease.until <= now())
        throw new MirrorLeaseLost('Pair lease expired or changed owner')
      const state = next === undefined ? record.state || {} : next
      transaction.set(ref, {
        ...record, state, lease: { token, until: now() + lease_ms }
      })
      return state
    })
    try {
      return await run({ read: () => access(), write: state => access(state) })
    } finally {
      await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref)
        const record = snapshot.data() || {}
        if (record.lease?.token === token)
          transaction.set(ref, { ...record, lease: null })
      })
    }
  }
})
