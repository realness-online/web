/** @typedef {import('@/types').Id} Id */
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
  Statement,
  Event,
  Poster,
  Me
} from '@/persistance/Storage'
import { get_my_itemid, use_me } from '@/use/people'
import { use as use_statements } from '@/use/statement'
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

export const DOES_NOT_EXIST = { updated: null, customMetadata: { hash: null } } // Explicitly setting null to indicate that this file doesn't exist

/**
 * @param {object} deps
 * @param {import('vue').Ref} deps.sync_element
 * @param {import('vue').Ref} deps.relations
 * @param {import('vue').Ref} deps.my_thoughts
 * @param {import('vue').Ref} deps.events
 * @param {import('vue').Ref} deps.me
 * @param {Function} deps.emit
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
      console.time('sync:sync_statements')
      await sync_statements(deps)
      console.timeEnd('sync:sync_statements')
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

const visit = async deps => {
  const visit_digit = new Date(deps.me.value.visited).getTime()
  if (!deps.me.value.visited || Date.now() - visit_digit > JS_TIME.ONE_HOUR) {
    deps.me.value.visited = new Date().toISOString()
    await tick()
    await new Me().save(document.querySelector(`[itemid="${localStorage.me}"]`))
  }
}

const prune = async deps => {
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

const sync_statements = async deps => {
  const persistance = new Statement()
  const itemid = get_my_itemid('statements')
  const index_hash = await get_index_hash(itemid)
  const elements = deps.sync_element.value.querySelector(`[itemid="${itemid}"]`)
  if (!elements || !elements.outerHTML) return null
  const hash = await create_hash(elements.outerHTML)
  if (index_hash !== hash) {
    const synced = await persistance.sync()
    // eslint-disable-next-line require-atomic-updates -- deps ref is stable; assign is from sync result
    deps.my_thoughts.value = synced || []
    if (deps.my_thoughts.value.length) {
      await tick()
      await persistance.save(elements)
      localStorage.removeItem('/+/statements')
    }
  }
  await persistance.optimize()
}

const sync_relations = async deps => {
  const itemid = get_my_itemid('relations')
  await fresh_metadata(itemid)
  const index_hash = await get_index_hash(itemid)
  let local_html = localStorage.getItem(itemid)
  if (!local_html) local_html = await get(itemid)
  const local_hash = local_html ? await create_hash(local_html) : null

  if (local_html && !index_hash) {
    const local_item = get_item(local_html, itemid)
    if (local_item) {
      deps.relations.value = type_as_list(local_item)
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
      deps.relations.value = type_as_list(cloud_item)
      await tick()
      const elements = deps.sync_element.value?.querySelector(
        `[itemid="${itemid}"]`
      )
      if (elements) await new Relation().save(elements)
    }
  }
}

const sync_events = async deps => {
  const event_storage = new Event()
  const itemid = get_my_itemid('events')
  const index_hash = await get_index_hash(itemid)
  const elements = deps.sync_element.value.querySelector(`[itemid="${itemid}"]`)
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

export const use = () => {
  const { emit } = current_instance()
  const { me, relations } = use_me()
  const { my_thoughts } = use_statements()
  const events = ref(null)
  const sync_element = ref(null)
  const sync_poster = ref(null)
  provide('sync-poster', sync_poster)

  const deps = { sync_element, relations, my_thoughts, events, me, emit }
  const play = create_play(deps)

  mounted(async () => {
    document.addEventListener('visibilitychange', play)
    window.addEventListener('online', play)
    const item = await load(/** @type {Id} */ (`${localStorage.me}/relations`))
    relations.value = type_as_list(item)
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

  // Handle offline queue (includes both anonymous and logged-in statements)
  const offline = await get('sync:offline')
  if (offline) {
    // Sequential processing required: operations must complete before starting next
    /* eslint-disable no-await-in-loop */
    while (offline.length) {
      const item = offline.pop()

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

const get_index_hash = async itemid =>
  ((await get('sync:index')) || {})[itemid]?.customMetadata?.hash

/**
 * @param {Id} itemid
 * @returns {Promise<any>}
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
      if (e.code === 'storage/object-not-found') network = DOES_NOT_EXIST
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

/**
 * @returns {Promise<void>}
 */
export const sync_me = async () => {
  const id = get_my_itemid()
  const index_hash = await get_index_hash(id)
  let my_info = localStorage.getItem(id)
  if (!my_info) my_info = await get(id)
  if (!my_info || !index_hash) return
  const hash = await create_hash(my_info)
  if (hash !== index_hash) {
    localStorage.removeItem(id)
    del(id)
  }
}

/**
 * @returns {Promise<void>}
 */
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
