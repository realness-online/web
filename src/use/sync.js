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

export const use = () => {
  const { emit } = current_instance()
  const { me, relations } = use_me()
  const { my_statements: statements } = use_statements()
  const events = ref(null)
  const sync_element = ref(null)
  const sync_poster = ref(null)
  provide('sync-poster', sync_poster)

  /**
   * @returns {Promise<void>}
   */
  const play = async () => {
    if (!current_user.value) return
    if (document.visibilityState !== 'visible') return
    if (navigator.onLine && current_user.value) emit('active', true)
    await sync_offline_actions()
    if (!navigator.onLine || !current_user.value) {
      emit('active', false)
      return
    }
    if (!i_am_fresh()) {
      localStorage.sync_time = new Date().toISOString()
      await prune()
      await sync_me()
      await sync_relations()
      await sync_statements()
      await sync_events()
      await sync_posters_directory()
      emit('active', false)
    } else emit('active', false)

    await visit()
  }

  /**
   * @returns {Promise<void>}
   */
  const visit = async () => {
    const visit_digit = new Date(me.value.visited).getTime()

    if (!me.value.visited || Date.now() - visit_digit > JS_TIME.ONE_HOUR) {
      me.value.visited = new Date().toISOString()
      await tick()
      await new Me().save(
        document.querySelector(`[itemid="${localStorage.me}"]`)
      )
    }
  }

  /**
   * @returns {Promise<void>}
   */
  const prune = async () => {
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

  /**
   * @param {Id} id
   * @returns {boolean}
   */
  const is_stranger = id => {
    const friends = [...relations.value]
    friends.push({
      id: localStorage.me,
      type: 'person'
    })
    const is_friend = friends.some(relation => {
      if (relation.id === id) return true
      return false
    })
    return !is_friend
  }

  /**
   * @returns {Promise<void>}
   */
  const sync_statements = async () => {
    const persistance = new Statement()
    const itemid = get_my_itemid('statements')
    const index_hash = await get_index_hash(itemid)
    const elements = sync_element.value.querySelector(`[itemid="${itemid}"]`)
    if (!elements || !elements.outerHTML) return null // nothing local so we'll let it load on request
    const hash = await create_hash(elements.outerHTML)
    if (index_hash !== hash) {
      const synced = await persistance.sync()
      statements.value = synced || []
      if (statements.value.length) {
        await tick()
        await persistance.save(elements)
        localStorage.removeItem('/+/statements')
      }
    }
    await persistance.optimize()
  }

  /**
   * @returns {Promise<void>}
   */
  const sync_relations = async () => {
    const itemid = get_my_itemid('relations')
    await fresh_metadata(itemid)
    const index_hash = await get_index_hash(itemid)
    let local_html = localStorage.getItem(itemid)
    if (!local_html) local_html = await get(itemid)
    const local_hash = local_html ? await create_hash(local_html) : null

    if (local_html && !index_hash) {
      const local_item = get_item(local_html, itemid)
      if (local_item) {
        relations.value = type_as_list(local_item)
        await tick()
        const elements = sync_element.value?.querySelector(
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
        relations.value = type_as_list(cloud_item)
        await tick()
        const elements = sync_element.value?.querySelector(
          `[itemid="${itemid}"]`
        )
        if (elements) await new Relation().save(elements)
      }
    }
  }

  /**
   * @returns {Promise<void>}
   */
  const sync_events = async () => {
    const event_storage = new Event()
    const itemid = get_my_itemid('events')
    const index_hash = await get_index_hash(itemid)
    const elements = sync_element.value.querySelector(`[itemid="${itemid}"]`)
    if (!elements) return
    const hash = await create_hash(elements.outerHTML)
    if (index_hash !== hash) {
      const synced_events = await event_storage.sync()
      events.value = synced_events || []
      if (events.value.length) {
        await tick()
        await event_storage.save(elements)
        localStorage.removeItem('/+/events')
      }
    }
  }

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
