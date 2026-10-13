import { onObjectFinalized as on_object_finalized, onObjectDeleted as on_object_deleted, onObjectArchived as on_object_archived } from 'firebase-functions/v2/storage'
import { getFirestore as get_firestore } from 'firebase-admin/firestore'
import { getApp as get_app } from 'firebase-admin/app'
import { bucket } from '#utils/firebase.js'
import { log_error, log_info } from '#utils/log.js'
import { mirror_name } from '#services/mirror-name.js'
import { mirror_journal, MirrorBusy, MirrorLeaseLost } from '#services/mirror-journal.js'
import { mirror_reconcile } from '#services/mirror-reconcile.js'
import { rules_protect_both, released_storage_rules } from '#services/rules-preflight.js'

const is_relations = name => /\/relations\.html(\.gz)?$/.test(name)

/** Checked once per instance; a failed lookup is retried on the next event. */
let rules_checked
const live_rules_protect_relations = () => {
  rules_checked ??= (async () => {
    const { credential } = get_app().options
    const project = process.env.GCLOUD_PROJECT
    const fetch_json = async url => {
      const { access_token } = await credential.getAccessToken()
      const response = await fetch(url, { headers: { authorization: `Bearer ${access_token}` } })
      if (!response.ok) throw new Error(`Rules lookup failed: ${response.status}`)
      return response.json()
    }
    return rules_protect_both(await released_storage_rules({
      project, bucket_name: bucket.name, fetch_json
    }))
  })().catch(error => {
    rules_checked = undefined
    throw error
  })
  return rules_checked
}

/** Outcomes that a later delivery can resolve; throwing asks for a retry. */
const RETRY = new Set(['post-operation-divergence', 'missing-delete-evidence'])

/**
 * Reconcile the pair touched by one Storage event.
 * Conflicts are logged for review and acknowledged, never retried forever.
 * @param {{ name: string, generation: string }} object
 * @param {{ deleted?: boolean, deps?: object }} [options]
 */
export const mirror_names_handler = async (object, { deleted = false, deps = {} } = {}) => {
  const { name, generation } = object
  if (!mirror_name(name)) return { action: 'ignore' }
  const {
    store = bucket,
    journal = mirror_journal({ db: get_firestore() }),
    reconcile = mirror_reconcile,
    relations_safe = live_rules_protect_relations
  } = deps
  if (is_relations(name) && !(await relations_safe()))
    throw new Error('mirror names: storage rules do not protect relations.html yet')
  let result
  try {
    result = await reconcile({
      bucket: store, journal, name,
      deletion: deleted ? { name, generation: String(generation) } : undefined
    })
  } catch (error) {
    if (error instanceof MirrorBusy || error instanceof MirrorLeaseLost) throw error
    if ([404, 412].includes(Number(error.code))) throw error
    log_error('mirror names: failed', { name, error: error.message })
    throw error
  }
  if (result.action === 'conflict' && !result.recorded) log_error('mirror names: conflict', { name, reason: result.reason })
  else if (result.action === 'wait' && RETRY.has(result.reason))
    throw new Error(`mirror names: retry ${result.reason}`)
  else log_info('mirror names', { name, action: result.action })
  return result
}

const options = { bucket: bucket.name, retry: true, memory: '256MiB', maxInstances: 10 }

export const mirror_names_written = on_object_finalized(options, event =>
  mirror_names_handler(event.data)
)

export const mirror_names_deleted = on_object_deleted(options, event =>
  mirror_names_handler(event.data, { deleted: true })
)

export const mirror_names_archived = on_object_archived(options, event =>
  mirror_names_handler(event.data, { deleted: true })
)
