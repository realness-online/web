/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Sync_Deps} Sync_Deps */
/** @typedef {import('@/types').Sync_Offline_Item} Sync_Offline_Item */
import { get, del, set, keys } from 'idb-keyval'
import {
  as_filename,
  as_author,
  load,
  load_from_network,
  type_as_list,
  is_itemid
} from '@/utils/itemid'
import { get_item } from '@/utils/item'
import { build_local_directory } from '@/persistance/Directory'
import {
  Offline,
  Relation,
  Thought,
  Event,
  Poster,
  Me
} from '@/persistance/Storage'
import { get_my_itemid, use_me } from '@/use/people'
import { use as use_thoughts } from '@/use/thought'
import { current_user, location, metadata } from '@/utils/serverless'
import { create_hash } from '@/utils/upload-processor'
import { mutex } from '@/utils/algorithms'
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

/** @type {import('@/types').Sync_Index_Entry} */
export const DOES_NOT_EXIST = { updated: null, customMetadata: { hash: null } }

/**
 * @param {Sync_Deps} deps
 * @returns {() => Promise<void>}
 */
const create_play = deps => async () => {
  if (!current_user.value) return
  if (document.visibilityState !== 'visible') return
  const did_emit = navigator.onLine && !!current_user.value
  if (did_emit) deps.emit('active', true)
  try {
    console.time('sync:offline_actions')
    await sync_offline_actions()
    console.timeEnd('sync:offline_actions')
    if (!navigator.onLine || !current_user.value) return
    if (!i_am_fresh()) {
      localStorage.sync_time = new Date().toISOString()
      console.time('sync:prune')
      await prune(deps)
      console.timeEnd('sync:prune')
      console.time('sync:sync_me')
      await sync_me()
      console.timeEnd('sync:sync_me')
      console.time('sync:sync_relations')
      await sync_relations(deps)
      console.timeEnd('sync:sync_relations')
      console.time('sync:sync_thoughts')
      await sync_thoughts(deps)
      console.timeEnd('sync:sync_thoughts')
      console.time('sync:sync_events')
      await sync_events(deps)
      console.timeEnd('sync:sync_events')
      console.time('sync:sync_posters_directory')
      await sync_posters_directory()
      console.timeEnd('sync:sync_posters_directory')
    }
    console.time('sync:visit')
    await visit(deps)
    console.timeEnd('sync:visit')
  } finally {
    if (did_emit) deps.emit('active', false)
  }
}

/** @param {Sync_Deps} deps @returns {Promise<void>} */
const visit = async deps => {
  const visited = deps.me.value?.visited
  const visit_digit = new Date(visited ?? 0).getTime()
  if (!visited || Date.now() - visit_digit > JS_TIME.ONE_HOUR) {
    if (deps.me.value) deps.me.value.visited = new Date().toISOString()
    await tick()
    const me_el = document.querySelector(`[itemid="${localStorage.me}"]`)
    if (me_el) await new Me().save(me_el)
  }
}

/** @param {Sync_Deps} deps @returns {Promise<void>} */
const prune = async deps => {
  /** @param {Id} id */
  const is_stranger = id => {
    const friends = [
      ...deps.relations.value,
      { id: localStorage.me, type: 'person' }
    ]
    return !friends.some(r => r.id === id)
  }
  const everything = /** @type {Id[]} */ (await keys())
  await Promise.all(
    everything.map(async itemid => {
      if (itemid.endsWith('/')) {
        await del(itemid)
        return
      }
      if (!is_itemid(/** @type {string} */ (itemid))) return
      if (is_stranger(/** @type {Id} */ (as_author(itemid)))) {
        await del(itemid)
        return
      }
      const network = await fresh_metadata(itemid)
      if (!network?.customMetadata) return
      const hash = await create_hash(await get(itemid))
      if (network.customMetadata.hash !== hash) await del(itemid)
    })
  )
}

/** @param {Sync_Deps} deps @returns {Promise<void|null>} */
const sync_thoughts = async deps => {
  const itemid = get_my_itemid('thoughts')
  if (!itemid) return null
  const persistance = new Thought()
  const index_hash = await get_index_hash(itemid)
  const elements = deps.sync_element.value?.querySelector(
    `[itemid="${itemid}"]`
  )
  if (!elements || !elements.outerHTML) return null
  const hash = await create_hash(elements.outerHTML)
  if (index_hash !== hash) {
    const synced = await persistance.sync()
    // eslint-disable-next-line require-atomic-updates -- deps ref is stable; assign is from sync result
    deps.my_thoughts.value = synced || []
    if (deps.my_thoughts.value.length) {
      await tick()
      await persistance.save(elements)
      localStorage.removeItem('/+/thoughts')
    }
  }
  await persistance.optimize()
}

/** @param {Sync_Deps} deps @returns {Promise<void>} */
const sync_relations = async deps => {
  const itemid = get_my_itemid('relations')
  if (!itemid) return
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
    return
  }

  if (!index_hash) return

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
  }
}

/** @param {Sync_Deps} deps @returns {Promise<void>} */
const sync_events = async deps => {
  const itemid = get_my_itemid('events')
  if (!itemid) return
  const event_storage = new Event()
  const index_hash = await get_index_hash(itemid)
  const elements = deps.sync_element.value?.querySelector(
    `[itemid="${itemid}"]`
  )
  if (!elements) return
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
  }
}

/** @returns {import('@/types').Sync_Return} */
export const use = () => {
  const instance = current_instance()
  const emit = instance?.emit ?? (() => {})
  const { me, relations } = use_me()
  const { my_thoughts } = use_thoughts()
  const events = ref(null)
  const sync_element = ref(null)
  const sync_poster = ref(null)
  provide('sync-poster', sync_poster)

  const deps = /** @type {Sync_Deps} */ ({
    sync_element,
    relations,
    my_thoughts,
    events,
    me,
    emit
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

  watch(current_user, async () => {
    if (current_user.value) await play()
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

  // Handle offline queue (includes both anonymous and logged-in thoughts)
  /** @type {Sync_Offline_Item[]|undefined} */
  const offline = await get('sync:offline')
  if (offline) {
    /* eslint-disable no-await-in-loop */
    while (offline.length) {
      const item = /** @type {Sync_Offline_Item} */ (offline.pop())

      if (item.action === 'save')
        if (item.id.endsWith('/relations')) {
          const html = localStorage.getItem(item.id)
          if (html) await new Relation().save({ outerHTML: html })
        } else await new Offline(item.id).save()
      else if (item.action === 'delete') await new Offline(item.id).delete()
    }
    /* eslint-enable no-await-in-loop */
    await del('sync:offline')
  }

  // Handle anonymous posters using the same Offline mechanism
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
  await mutex.lock()
  try {
    const index = (await get('sync:index')) || {}
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

    // Create a new index object with the existing data plus the new entry
    const updated_index = { ...index, [itemid]: network }
    await set('sync:index', updated_index)
    return network
  } finally {
    mutex.unlock()
  }
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

/** @returns {Promise<void>} */
export const sync_me = async () => {
  const id = get_my_itemid()
  if (!id) return
  const index_hash = await get_index_hash(id)
  const my_info = localStorage.getItem(id) ?? (await get(id))
  if (typeof my_info !== 'string' || !index_hash) return
  const hash = await create_hash(my_info)
  if (hash !== index_hash) {
    localStorage.removeItem(id)
    await del(id)
  }
}

/** @returns {Promise<void>} */
export const sync_posters_directory = async () => {
  const me = get_my_itemid()
  if (!me) return

  const directory_path = /** @type {Id} */ (`${me}/posters/`)
  await del(directory_path) // Clear existing directory cache

  const offline_posters = await build_local_directory(directory_path) // Get local posters
  if (!offline_posters || !offline_posters.items) return

  const sorted_items = offline_posters.items.sort((a, b) => b - a) // Sort items by created_at timestamp (newest first)

  await set(directory_path, {
    ...offline_posters,
    items: sorted_items,
    archives: []
  }) // Update directory with sorted items

  await new Poster(directory_path).optimize()
}
