/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Sync_Deps} Sync_Deps */
/** @typedef {import('@/types').Sync_Offline_Item} Sync_Offline_Item */
import { get, del, set } from 'idb-keyval'
import {
  as_filename,
  as_created_at,
  load,
  load_from_network,
  type_as_list
} from '@/utils/itemid'
import { get_item } from '@/utils/item'
import {
  build_local_directory,
  clear_author_dirs,
  load_directory_from_network
} from '@/persistence/Directory'
import {
  Offline,
  Relation,
  Statements,
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
import { poster_delete_log } from '@/utils/poster-delete-log'
import { DOES_NOT_EXIST, is_sync_index_missing } from '@/utils/sync-file'

export { DOES_NOT_EXIST }

/** @type {Map<string, Promise<import('@/types').Sync_Index_Entry>>} */
const fresh_metadata_inflight = new Map()

/**
 * Drop negative-cache rows so the next `fresh_metadata` / `as_download_url` hits
 * Storage again. This is the only expiry other people's files get: yours are
 * dropped by `Cloud.to_network` as you upload, but nothing on this device hears
 * about a contact posting for the first time.
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
 * Signed-out users only see the env admin. Aligns profile HTML with `sync:index`,
 * dropping cached folder listings when the profile has moved.
 * @param {Sync_Deps} deps
 * @returns {Promise<boolean>} True when local state for the admin changed
 */
const sync_public_default_feed = async deps => {
  const id = admin_itemid_from_env()
  if (!id) {
    if (deps.load_phonebook) await deps.load_phonebook()
    return false
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

  if (!index_hash) {
    if (deps.load_phonebook) await deps.load_phonebook()
    return !!(profile_missing_on_server || profile_hash_stale)
  }

  if (local_hash !== index_hash) {
    localStorage.removeItem(id)
    await del(id)
  }

  if (deps.load_phonebook) await deps.load_phonebook()
  return local_hash !== index_hash
}

const WORKING_BORDER_DELAY = 300

/**
 * Show the working border only once a tick outlives `WORKING_BORDER_DELAY`.
 * @param {Sync_Deps['emit']} emit
 * @returns {() => void} Call when the tick finishes
 */
const defer_working_border = emit => {
  let shown = false
  const timer = setTimeout(() => {
    shown = true
    emit('active', true)
  }, WORKING_BORDER_DELAY)
  return () => {
    clearTimeout(timer)
    if (shown) emit('active', false)
  }
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
    const admin_changed = await sync_public_default_feed(deps)
    if (admin_changed) {
      const admin_id = admin_itemid_from_env()
      deps.emit('refreshed', {
        reload_phonebook: false,
        authors: admin_id ? [admin_id] : []
      })
    }
    return
  }

  const done = navigator.onLine ? defer_working_border(deps.emit) : () => {}
  try {
    await sync_offline_actions()
    if (!navigator.onLine || !current_user.value) return

    // First: it rewrites `me`, re-rendering the sync aside the other two read
    // their elements out of.
    await sync_me()
    const [relations, statements] = await Promise.all([
      sync_relations(deps),
      sync_statements(deps)
    ])
    let contacts_changed = !!relations
    let mine_changed = !!statements

    const sync_was_due = !i_am_fresh()
    if (sync_was_due) {
      await purge_missing_sync_index_entries()
      contacts_changed = (await sync_phonebook_people(deps)) || contacts_changed
      // Last, so the clock only ever means the walk finished. Stamped first, a
      // tab closed mid-pass or one contact's file erroring bought another eight
      // hours of not looking.
      localStorage.sync_time = new Date().toISOString()
    }

    const poster_directory_changed = await sync_posters_directory({
      optimize: sync_was_due
    })
    if (poster_directory_changed) mine_changed = true
    if (!contacts_changed && !mine_changed) return
    const me_id = get_my_itemid()
    deps.emit('refreshed', {
      reload_phonebook: contacts_changed,
      authors: contacts_changed || !me_id ? null : [me_id]
    })
  } catch (e) {
    // Fired from an event listener, so nothing downstream can catch this. The
    // clock is stamped last on purpose: a tick that dies here leaves it stale
    // and the next visit tries again.
    console.warn('[sync] tick failed', e)
  } finally {
    done()
  }
}

/**
 * Whether a synced list is worth reloading the feed for. A hash mismatch is not
 * enough on its own: two empty lists still disagree on the tick that first writes
 * the empty file.
 * @param {import('@/types').Item[]} before
 * @param {import('@/types').Item[]} after
 * @returns {boolean}
 */
const rows_changed = (before, after) => {
  if (before.length !== after.length) return true
  const had = new Set(before.map(item => item.id))
  return after.some(item => !had.has(item.id))
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
    const before = deps.my_statements.value ?? []
    const synced = (await persistence.sync()) || []
    // eslint-disable-next-line require-atomic-updates -- deps ref is stable; assign is from sync result
    deps.my_statements.value = synced
    // Saved even when empty. A person who has never written otherwise has no
    // file at all, and every read of their thoughts - theirs and everyone
    // else's - asks storage for something that is not there.
    await tick()
    await persistence.save(elements)
    if (synced.length) localStorage.removeItem('/+/statements')
    await persistence.optimize()
    return rows_changed(before, synced)
  }
  await persistence.optimize()
  return false
}

/**
 * A contact's thoughts are one file. Posting appends to it, editing rewrites a row
 * in it, and `optimize` moves rows out of it - and archive pages, once written, are
 * never touched again. So this hash check is the whole of their freshness: nothing
 * else they can do changes what we cached, and nothing else here can notice.
 *
 * Their profile blob is not a usable sentinel for it. `visited` restamps at most
 * hourly and saving a statement does not touch the profile at all, so a post made
 * inside that hour leaves the profile hash exactly where it was.
 * @param {Id} id Contact's person itemid
 * @returns {Promise<boolean>} True when their cached statements were dropped
 */
export const sync_contact_statements = async id => {
  const itemid = /** @type {Id} */ (`${id}/statements`)
  const cached = await get(itemid)
  // Nothing cached is already fresh; `load` will fetch when the feed asks.
  if (typeof cached !== 'string') return false

  // A negative-cache row would short circuit `fresh_metadata` and read as "their
  // file is gone" - both wrong for a contact who has since posted for the first
  // time. Drop ours before asking, and trust the answer we get back.
  const index_mutex = mutex_for('sync:index')
  await index_mutex.lock()
  try {
    const index = (await get('sync:index')) || {}
    if (is_sync_index_missing(index[itemid])) {
      const next = { ...index }
      delete next[itemid]
      await set('sync:index', next)
    }
  } finally {
    index_mutex.unlock()
  }

  const entry = await fresh_metadata(itemid)
  const local_hash = await create_hash(cached)
  const gone_from_server = is_sync_index_missing(entry)

  if (gone_from_server || local_hash !== entry?.customMetadata?.hash) {
    await del(itemid)
    return true
  }
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

/**
 * Root `people/{author}/index.html.gz` blobs: refresh `sync:index`, then drop stale local
 * cache when the hash disagrees. Each contact's statements file is hash checked here
 * too, on its own, for the reasons in `sync_contact_statements`. Does not fetch; `load_phonebook` / `load()` repopulate.
 * Clears cached folder listings via `clear_author_dirs` (`@/persistence/Directory`) when the profile
 * blob is missing on storage or its hash no longer matches. Same schedule as
 * other sync steps. Skips `localStorage.me` (handled in `sync_me`).
 * Per-contact work runs in parallel (`Promise.all`); `sync:index` merges stay serialized inside `fresh_metadata`.
 * @param {Sync_Deps} deps
 * @returns {Promise<boolean>}
 */
export const sync_phonebook_people = async deps => {
  if (!current_user.value) return false
  const people_list = await directory('people/')
  const prefix_refs = people_list?.prefixes ?? []
  const me_id = localStorage.me
  let did_change = false

  const sync_one_contact = async phone_number => {
    const id = /** @type {Id} */ (from_e64(phone_number.name))
    if (id === me_id) return
    // Ahead of the profile checks and outside their early returns: their thoughts
    // change without their profile changing.
    if (await sync_contact_statements(id)) did_change = true
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
  const sync_element = ref(null)
  const sync_poster = ref(null)
  provide('sync-poster', sync_poster)

  const deps = /** @type {Sync_Deps} */ ({
    sync_element,
    relations,
    my_statements,
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
    // `current_user` starts `undefined` and resolves once per page: `null` first
    // is somebody signing in, `undefined` is a session restored on load.
    if (previous === null) localStorage.removeItem('sync_time')
    await play()
  })
  return {
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
  const offline_mutex = mutex_for('sync:offline')
  await offline_mutex.lock()
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
  offline_mutex.unlock()

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
 * @param {boolean} [force] Stamp regardless of the throttle - a person with no
 * profile on the server needs one written now.
 * @returns {Promise<void>}
 */
const stamp_visited_if_due = async (force = false) => {
  if (!current_user.value) return
  const me_val = me.value
  if (!me_val) return
  const { visited } = me_val
  const visit_digit = new Date(visited ?? 0).getTime()
  if (!force && visited && Date.now() - visit_digit <= JS_TIME.ONE_HOUR) return

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

  // Nothing at their root. Sign-up writes no profile, so for anyone who never
  // edits their name this is the only thing that ever creates one - and without
  // it the phonebook can only show their phone number. Forced, because a local
  // visit stamp from this hour must not talk us out of the first upload.
  if (!index_hash) {
    if (!me.value?.id)
      me.value = /** @type {import('@/types').MeItem} */ ({
        ...default_person,
        id
      })
    await stamp_visited_if_due(true)
    return
  }

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
 * Rebuilds `${me}/posters/` in idb from all poster keys, so the feed picks up new
 * local or migrated posters. `optimize` archives overflow and costs a `listAll`.
 * @param {{ optimize?: boolean }} [options]
 * @returns {Promise<boolean>} True when the sorted poster id list changed
 */
/**
 * `as_download_url` writes DOES_NOT_EXIST when it cannot find a file, and that
 * row is a permanent no until something expires it. A miss caused by a listing
 * that was wrong about where a poster lived leaves one behind, so learning what
 * storage really holds is the moment those guesses stop being worth keeping.
 * Anything the listing names, and anything older than the oldest thing it names
 * — those are the archived ones, filed somewhere this listing cannot see, and
 * an avatar is nearly always among them. Newer than the newest is the one case
 * to leave alone: it has genuinely not been uploaded yet.
 * @param {Id} me
 * @param {Set<number | string>} created_ats
 * @returns {Promise<void>}
 */
const forget_missing = async (me, created_ats) => {
  const listed = new Set([...created_ats].map(Number))
  if (!listed.size) return
  const oldest_listed = Math.min(...listed)
  const index_mutex = mutex_for('sync:index')
  await index_mutex.lock()
  try {
    const index = (await get('sync:index')) || {}
    let changed = false
    const next = { ...index }
    for (const key of Object.keys(next)) {
      if (!is_sync_index_missing(next[key])) continue
      if (!key.startsWith(`${me}/`)) continue
      // Layers are their own itemids under the same created_at as the poster
      const created = Number(as_created_at(/** @type {Id} */ (key)))
      if (!created) continue
      if (!listed.has(created) && created > oldest_listed) continue
      delete next[key]
      changed = true
    }
    if (changed) await set('sync:index', next)
  } finally {
    index_mutex.unlock()
  }
}

export const sync_posters_directory = async (options = {}) => {
  const { optimize = true } = options
  const me = get_my_itemid()
  if (!me) return false

  const directory_path = /** @type {Id} */ (`${me}/posters/`)
  const prev = await get(directory_path)
  const prev_items = /** @type {number[]} */ (
    Array.isArray(prev?.items) ? [...prev.items].sort((a, b) => b - a) : []
  )

  poster_delete_log('sync_posters_directory clearing cache', {
    directory_path,
    prev_items: prev_items.length
  })
  await del(directory_path) // Clear existing directory cache

  const offline_posters = await build_local_directory(directory_path) // Get local posters
  if (!offline_posters || !offline_posters.items) return prev_items.length > 0

  // `as_directory` serves this cache without ever asking the network again, so
  // whatever we leave out here is invisible to the feed. Reached network is the
  // authority on what exists — it is the only place a delete shows up — plus
  // anything local that has not uploaded yet. Unreachable, the cache stands:
  // narrowing to local-only would strand every poster made on another device.
  const network = await load_directory_from_network(directory_path)
  const baseline = network ? (network.items ?? []) : prev_items
  const merged = new Set([...baseline, ...offline_posters.items])

  const sorted_items = [...merged].sort((a, b) => b - a) // Newest first

  const list_changed =
    prev_items.length !== sorted_items.length ||
    sorted_items.some((id, i) => id !== prev_items[i])

  await set(directory_path, {
    ...offline_posters,
    items: sorted_items,
    archive: network?.archive ?? prev?.archive ?? []
  }) // Update directory with sorted items

  if (network) await forget_missing(me, merged)

  if (optimize) await new Poster(directory_path).optimize()
  return list_changed
}
