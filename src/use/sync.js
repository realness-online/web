/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Sync_Deps} Sync_Deps */
/** @typedef {import('@/types').Sync_Offline_Item} Sync_Offline_Item */
import { get, del, set } from 'idb-keyval'
import {
  as_filename,
  load,
  load_from_network,
  type_as_list
} from '@/utils/itemid'
import { get_item } from '@/utils/item'
import {
  build_local_directory,
  clear_author_dirs,
  as_directory_id
} from '@/persistence/Directory'
import {
  Offline,
  Relation,
  Statements,
  Event,
  Poster,
  Me
} from '@/persistence/Storage'
import { get_my_itemid, use_me, from_e64 } from '@/use/people'
import { use as use_statements } from '@/use/statements'
import {
  current_user,
  directory,
  location,
  me,
  metadata
} from '@/utils/serverless'
import { default_person } from '@/utils/person-identity'
import { create_hash } from '@/utils/upload-processor'
import { mutex_for } from '@/utils/algorithms'
import {
  ref,
  onMounted as mounted,
  onUnmounted as dismount,
  nextTick as tick,
  getCurrentInstance as current_instance,
  provide,
  watch
} from 'vue'
import { JS_TIME } from '@/utils/numbers'
import { profile_sync_log } from '@/utils/profile-sync-log'
import { DOES_NOT_EXIST, is_sync_index_missing } from '@/utils/sync-file'

export { DOES_NOT_EXIST }

/** @type {Map<string, Promise<import('@/types').Sync_Index_Entry>>} */
const fresh_metadata_inflight = new Map()

/**
 * Drop negative-cache rows so the next `fresh_metadata` / `as_download_url` hits Storage again.
 * Runs only when `i_am_fresh()` is false (same cadence as the 8h full sync block).
 * @returns {Promise<void>}
 */
const purge_missing_sync_index_entries = async () => {
  const index_mutex = mutex_for('sync:index')
  await index_mutex.lock()
  try {
    const index = (await get('sync:index')) || {}
    let changed = false
    const next = { ...index }
    for (const key of Object.keys(next))
      if (is_sync_index_missing(next[key])) {
        delete next[key]
        changed = true
      }
    if (changed) await set('sync:index', next)
  } finally {
    index_mutex.unlock()
  }
}

/**
 * @returns {Id | null}
 */
const admin_itemid_from_env = () => {
  const raw = import.meta.env.VITE_ADMIN_ID
  if (!raw) return null
  return /** @type {Id} */ (`/${String(raw).replace(/^\/?/, '')}`)
}

/**
 * Signed-out users only see the env admin; `as_directory` skips the network when
 * `${id}/posters/` is cached in idb. Align profile HTML with `sync:index` and drop
 * the posters directory cache so the next feed load lists storage again.
 * @param {Sync_Deps} deps
 * @returns {Promise<void>}
 */
const sync_public_default_feed = async deps => {
  const id = admin_itemid_from_env()
  if (!id) {
    if (deps.load_phonebook) await deps.load_phonebook()
    return
  }
  await fresh_metadata(id)
  const index_hash = await get_index_hash(id)
  const index_entry = ((await get('sync:index')) || {})[id]
  const local_html = localStorage.getItem(id) ?? (await get(id))
  const local_hash =
    typeof local_html === 'string' ? await create_hash(local_html) : null

  const profile_missing_on_server =
    index_entry &&
    index_entry.customMetadata &&
    index_entry.customMetadata.hash === null &&
    index_entry.updated === null

  const profile_hash_stale = index_hash && local_hash !== index_hash

  if (profile_missing_on_server || profile_hash_stale)
    await clear_author_dirs(id)

  if (local_html && !index_hash) {
    if (deps.load_phonebook) await deps.load_phonebook()
    return
  }

  if (!index_hash) {
    if (deps.load_phonebook) await deps.load_phonebook()
    return
  }

  if (local_hash !== index_hash) {
    localStorage.removeItem(id)
    await del(id)
  }

  const posters_root = /** @type {Id} */ (`${id}/posters`)
  await del(as_directory_id(posters_root))

  if (deps.load_phonebook) await deps.load_phonebook()
}

/**
 * @param {Sync_Deps} deps
 * @returns {() => Promise<void>}
 */
const create_play = deps => async () => {
  if (document.visibilityState !== 'visible') return

  if (!current_user.value) {
    await sync_offline_actions()
    if (!navigator.onLine) return
    await sync_public_default_feed(deps)
    deps.emit('refreshed')
    return
  }

  const did_emit = navigator.onLine && !!current_user.value
  if (did_emit) deps.emit('active', true)
  try {
    await sync_offline_actions()
    if (!navigator.onLine || !current_user.value) return
    await sync_me()
    let did_full_sync = false
    let did_sync_change = false
    if (!i_am_fresh()) {
      await purge_missing_sync_index_entries()
      localStorage.sync_time = new Date().toISOString()
      did_sync_change = (await sync_relations(deps)) || did_sync_change
      did_sync_change = (await sync_statements(deps)) || did_sync_change
      did_sync_change = (await sync_events(deps)) || did_sync_change
      did_full_sync = true
      did_sync_change = (await sync_phonebook_people(deps)) || did_sync_change
    }
    const poster_directory_changed = await sync_posters_directory()
    if ((did_full_sync && did_sync_change) || poster_directory_changed)
      deps.emit('refreshed')
  } finally {
    if (did_emit) deps.emit('active', false)
  }
}

/** @param {Sync_Deps} deps @returns {Promise<boolean|null>} */
const sync_statements = async deps => {
  const itemid = get_my_itemid('statements')
  if (!itemid) return null
  await fresh_metadata(itemid)
  const persistence = new Statements()
  const index_hash = await get_index_hash(itemid)
  const elements = deps.sync_element.value?.querySelector(
    `[itemid="${itemid}"]`
  )
  if (!elements || !elements.outerHTML) return null
  const hash = await create_hash(elements.outerHTML)
  if (index_hash !== hash) {
    const synced = await persistence.sync()
    // eslint-disable-next-line require-atomic-updates -- deps ref is stable; assign is from sync result
    deps.my_statements.value = synced || []
    if (deps.my_statements.value.length) {
      await tick()
      await persistence.save(elements)
      localStorage.removeItem('/+/statements')
    }
    await persistence.optimize()
    return true
  }
  await persistence.optimize()
  return false
}

/** @param {Sync_Deps} deps @returns {Promise<boolean>} */
const sync_relations = async deps => {
  const itemid = get_my_itemid('relations')
  if (!itemid) return false
  await fresh_metadata(itemid)
  const index_hash = await get_index_hash(itemid)
  const local_html = localStorage.getItem(itemid) ?? (await get(itemid))
  const local_hash =
    typeof local_html === 'string' ? await create_hash(local_html) : null

  if (local_html && !index_hash) {
    const local_item = get_item(local_html, itemid)
    if (local_item) {
      deps.relations.value = /** @type {import('@/types').Relation[]} */ (
        type_as_list(local_item)
      )
      await tick()
      const elements = deps.sync_element.value?.querySelector(
        `[itemid="${itemid}"]`
      )
      if (elements) await new Relation().save(elements)
    }
    return false
  }

  if (!index_hash) return false

  if (local_hash !== index_hash) {
    localStorage.removeItem(itemid)
    await del(itemid)
    const cloud_item = await load_from_network(itemid)
    if (cloud_item) {
      deps.relations.value = /** @type {import('@/types').Relation[]} */ (
        type_as_list(cloud_item)
      )
      await tick()
      const elements = deps.sync_element.value?.querySelector(
        `[itemid="${itemid}"]`
      )
      if (elements) await new Relation().save(elements)
    }
    return true
  }
  return false
}

/** @param {Sync_Deps} deps @returns {Promise<boolean>} */
const sync_events = async deps => {
  const itemid = get_my_itemid('events')
  if (!itemid) return false
  await fresh_metadata(itemid)
  const event_storage = new Event()
  const index_hash = await get_index_hash(itemid)
  const elements = deps.sync_element.value?.querySelector(
    `[itemid="${itemid}"]`
  )
  if (!elements) return false
  const hash = await create_hash(elements.outerHTML)
  if (index_hash !== hash) {
    const synced_events = await event_storage.sync()
    // eslint-disable-next-line require-atomic-updates -- deps ref is stable; assign is from sync result
    deps.events.value = synced_events || []
    if (deps.events.value.length) {
      await tick()
      await event_storage.save(elements)
      localStorage.removeItem('/+/events')
    }
    return true
  }
  return false
}

/**
 * Root `people/{author}/index.html.gz` blobs: refresh `sync:index`, then drop stale local
 * cache when the hash disagrees. Does not fetch; `load_phonebook` / `load()` repopulate.
 * Clears cached folder listings via `clear_author_dirs` (`@/persistence/Directory`) when the profile
 * blob is missing on storage or its hash no longer matches. Same schedule as
 * other sync steps. Skips `localStorage.me` (handled in `sync_me`).
 * Per-contact work runs in parallel (`Promise.all`); `sync:index` merges stay serialized inside `fresh_metadata`.
 * @param {Sync_Deps} deps
 * @returns {Promise<boolean>}
 */
const sync_phonebook_people = async deps => {
  if (!current_user.value) return false
  const people_list = await directory('people/')
  const prefix_refs = people_list?.prefixes ?? []
  const me_id = localStorage.me
  let did_change = false

  const sync_one_contact = async phone_number => {
    const id = /** @type {Id} */ (from_e64(phone_number.name))
    if (id === me_id) return
    await fresh_metadata(id)
    const index_hash = await get_index_hash(id)
    const index_entry = ((await get('sync:index')) || {})[id]
    const local_html = localStorage.getItem(id) ?? (await get(id))
    const local_hash =
      typeof local_html === 'string' ? await create_hash(local_html) : null

    const profile_missing_on_server =
      index_entry &&
      index_entry.customMetadata &&
      index_entry.customMetadata.hash === null &&
      index_entry.updated === null

    const profile_hash_stale = index_hash && local_hash !== index_hash

    if (profile_missing_on_server || profile_hash_stale)
      await clear_author_dirs(id)

    if (local_html && !index_hash) return

    if (!index_hash) return

    if (local_hash !== index_hash) {
      localStorage.removeItem(id)
      await del(id)
      did_change = true
    }

    if (profile_missing_on_server || profile_hash_stale) did_change = true
  }

  await Promise.all(prefix_refs.map(sync_one_contact))
  if (deps.load_phonebook) await deps.load_phonebook()
  return did_change
}

/**
 * @param {(event: string, ...args: unknown[]) => void} [component_emit]
 * @param {{ load_phonebook?: () => Promise<void> }} [options]
 * @returns {import('@/types').Sync_Return}
 */
export const use = (component_emit, options = {}) => {
  const instance = current_instance()
  const emit = component_emit ?? instance?.emit ?? (() => {})
  const { me, relations } = use_me()
  const { my_statements } = use_statements()
  const events = ref(null)
  const sync_element = ref(null)
  const sync_poster = ref(null)
  provide('sync-poster', sync_poster)

  const deps = /** @type {Sync_Deps} */ ({
    sync_element,
    relations,
    my_statements,
    events,
    me,
    emit,
    load_phonebook: options.load_phonebook
  })
  const play = create_play(deps)

  mounted(async () => {
    document.addEventListener('visibilitychange', play)
    window.addEventListener('online', play)
    const item = await load(/** @type {Id} */ (`${localStorage.me}/relations`))
    relations.value = /** @type {import('@/types').Relation[]} */ (
      type_as_list(item)
    )
  })

  dismount(() => {
    window.removeEventListener('online', play)
    document.removeEventListener('visibilitychange', play)
  })

  watch(current_user, async (user, previous) => {
    if (!user) return
    // oxlint-disable-next-line eqeqeq -- == null is nullish (null | undefined)
    if (previous == null) localStorage.removeItem('sync_time')
    await play()
  })
  return {
    events,
    sync_element,
    sync_poster,
    sync_offline_actions,
    sync_posters_directory,
    sync_me
  }
}

/**
 * @returns {Promise<void>}
 */
export const sync_offline_actions = async () => {
  if (!navigator.onLine) return

  // Handle offline queue (includes both anonymous and logged-in statement rows)
  /** @type {Sync_Offline_Item[]|undefined} */
  const offline = await get('sync:offline')
  if (offline) {
    /* oxlint-disable no-await-in-loop */
    while (offline.length) {
      const item = /** @type {Sync_Offline_Item} */ (offline.pop())

      if (item.action === 'save')
        if (item.id.endsWith('/relations')) {
          const html = localStorage.getItem(item.id)
          if (html) await new Relation().save({ outerHTML: html })
        } else await new Offline(item.id).save()
      else if (item.action === 'delete') await new Offline(item.id).delete()
    }
    /* oxlint-enable no-await-in-loop */
    await del('sync:offline')
  }

  if (!offline?.length && current_user.value) return

  const offline_posters = await build_local_directory(
    /** @type {Id} */ ('/+/posters/')
  )
  if (offline_posters?.items?.length) {
    await Promise.all(
      offline_posters.items.map(async created_at => {
        const anonymous_id = /** @type {Id} */ (`/+/posters/${created_at}`)
        await new Offline(anonymous_id).save()
        await del(anonymous_id)
      })
    )
    await del('/+/posters/') // Clean up the directory after migration
  }
}

/**
 * @param {Id} itemid
 * @returns {Promise<string|null|undefined>}
 */
const get_index_hash = async itemid =>
  ((await get('sync:index')) || {})[itemid]?.customMetadata?.hash

/**
 * @param {Id} itemid
 * @returns {Promise<import('@/types').Sync_Index_Entry>}
 */
export const fresh_metadata = async itemid => {
  if (itemid.startsWith('/+/')) return DOES_NOT_EXIST

  const index_cached = (await get('sync:index')) || {}
  if (is_sync_index_missing(index_cached[itemid])) return DOES_NOT_EXIST

  const key = String(itemid)
  const existing = fresh_metadata_inflight.get(key)
  if (existing) return existing

  const pending = (async () => {
    try {
      const path = location(await as_filename(itemid))
      let network
      try {
        network = await metadata(path)
      } catch (e) {
        if (
          e &&
          typeof e === 'object' &&
          'code' in e &&
          /** @type {{code?: string}} */ (e).code === 'storage/object-not-found'
        )
          network = DOES_NOT_EXIST
        else throw e
      }
      if (!network) throw new Error(`Unable to create metadata for ${itemid}`)

      const index_mutex = mutex_for('sync:index')
      await index_mutex.lock()
      try {
        const index = (await get('sync:index')) || {}
        const updated_index = { ...index, [itemid]: network }
        await set('sync:index', updated_index)
        return network
      } finally {
        index_mutex.unlock()
      }
    } finally {
      fresh_metadata_inflight.delete(key)
    }
  })()

  fresh_metadata_inflight.set(key, pending)
  return pending
}

/**
 * @returns {boolean}
 */
export const i_am_fresh = () => {
  let synced
  if (localStorage.sync_time)
    synced = Date.now() - new Date(localStorage.sync_time).getTime()
  else {
    localStorage.sync_time = new Date().toISOString()
    synced = JS_TIME.EIGHT_HOURS
  }
  const time_left = JS_TIME.EIGHT_HOURS - synced
  const am_i_fresh = time_left > 0
  return am_i_fresh
}

/**
 * Merge parsed profile fields from local HTML into `me` before stamping `visited`.
 * @param {import('@/types').Item & {name?: string, avatar?: string}} item
 * @param {Id} id
 */
const apply_person_item_to_me = (item, id) => {
  /** @type {import('@/types').MeItem} */
  const next = {
    ...me.value,
    id,
    type: 'person'
  }
  if (typeof item.name === 'string') next.name = item.name
  if (typeof item.avatar === 'string') next.avatar = item.avatar
  me.value = next
}

/**
 * After `sync_me` aligns `me` with server or canonical local HTML, bump `visited` and persist.
 * Same one-hour throttle as before for how often we re-persist `visited`.
 * @returns {Promise<void>}
 */
const stamp_visited_if_due = async () => {
  if (!current_user.value) return
  const me_val = me.value
  if (!me_val) return
  const { visited } = me_val
  const visit_digit = new Date(visited ?? 0).getTime()
  if (visited && Date.now() - visit_digit <= JS_TIME.ONE_HOUR) return

  me_val.visited = new Date().toISOString()
  await tick()
  const me_el = document.querySelector(`[itemid="${localStorage.me}"]`)
  if (me_el) {
    profile_sync_log('visit_stamp_save', {
      itemid: /** @type {string} */ (localStorage.me)
    })
    await new Me().save(me_el)
  }
}

/** @returns {Promise<void>} */
export const sync_me = async () => {
  const id = get_my_itemid()
  if (!id) return
  await fresh_metadata(id)
  const index_hash = await get_index_hash(id)
  const my_info = localStorage.getItem(id) ?? (await get(id))
  const local_html = typeof my_info === 'string' ? my_info : null

  if (!index_hash) return

  const local_hash = local_html ? await create_hash(local_html) : null

  if (!local_hash || local_hash !== index_hash) {
    profile_sync_log('sync_me_cleared_stale_local_html', {
      itemid: id,
      index_hash,
      local_hash
    })
    localStorage.removeItem(id)
    await del(id)
    const maybe_me = await load_from_network(id)
    if (maybe_me)
      me.value = /** @type {import('@/types').MeItem} */ ({
        ...maybe_me,
        type: 'person',
        id
      })
    else
      me.value = /** @type {import('@/types').MeItem} */ ({
        ...default_person,
        id: /** @type {import('@/types').Id} */ (id)
      })
  } else {
    const item = await load(id)
    if (item && item.type === 'person') apply_person_item_to_me(item, id)
  }

  await stamp_visited_if_due()
}

/**
 * Rebuilds `${me}/posters/` in idb from all poster keys. Runs on every sync
 * (not the 8h gate) so the feed can pick up new local or migrated posters.
 * @returns {Promise<boolean>} True when the sorted poster id list changed
 */
export const sync_posters_directory = async () => {
  const me = get_my_itemid()
  if (!me) return false

  const directory_path = /** @type {Id} */ (`${me}/posters/`)
  const prev = await get(directory_path)
  const prev_items = /** @type {number[]} */ (
    Array.isArray(prev?.items) ? [...prev.items].sort((a, b) => b - a) : []
  )

  await del(directory_path) // Clear existing directory cache

  const offline_posters = await build_local_directory(directory_path) // Get local posters
  if (!offline_posters || !offline_posters.items) return prev_items.length > 0

  const sorted_items = [...offline_posters.items].sort((a, b) => b - a) // Newest first

  const list_changed =
    prev_items.length !== sorted_items.length ||
    sorted_items.some((id, i) => id !== prev_items[i])

  await set(directory_path, {
    ...offline_posters,
    items: sorted_items,
    archives: []
  }) // Update directory with sorted items

  await new Poster(directory_path).optimize()
  return list_changed
}
