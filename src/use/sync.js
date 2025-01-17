import { get, del, set, keys } from 'idb-keyval'
import { as_filename, as_author, load } from '@/utils/itemid'
import { build_local_directory } from '@/persistance/Directory'
import { Offline, Statement, Event, Poster, Me } from '@/persistance/Storage'
import { get_my_itemid, use_me } from '@/use/people'
import { use as use_statements } from '@/use/statement'
import { current_user, location, metadata } from '@/utils/serverless'
import get_item from '@/utils/item'
import { format_time_remaining } from '@/utils/date'
import { create_hash } from '@/utils/upload-processor'
import {
  ref,
  onMounted as mounted,
  onUnmounted as dismount,
  nextTick as next_tick,
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

  const play = async () => {
    if (!current_user.value) return // Do nothing until there is a person
    if (document.visibilityState !== 'visible') return
    await sync_offline_actions()
    await visit()
    if (!navigator.onLine || !current_user.value) return

    if (!i_am_fresh()) {
      emit('active', true)
      localStorage.sync_time = new Date().toISOString()
      await prune()
      await sync_me()
      await sync_statements()
      await sync_events()
      await sync_posters_directory()
      emit('active', false)
    }
  }

  /**
   * @returns {Promise<void>}
   */
  const visit = async () => {
    const visit_digit = new Date(me.value.visited).getTime()
    if (visit_interval() > visit_digit) {
      me.value.visited = new Date().toISOString()
      await next_tick()
      await new Me().save()
    }
  }

  /**
   * @returns {Promise<void>}
   */
  const prune = async () => {
    const everything = await keys()
    everything.forEach(async itemid => {
      if (!as_author(itemid)) return // items have authors
      if (await is_stranger(as_author(itemid), relations.value)) await del(itemid) // only relations are cached
      if (await itemid.endsWith('/'))
        await del(itemid) // directories are not cached
      else {
        const network = await fresh_metadata(itemid)
        if (!network || !network.customMetadata) return null
        const hash = await get_content_hash(itemid)
        if (network.customMetadata.hash !== hash) await del(itemid)
      }
    })
  }

  /**
   * @param {Id} id
   * @returns {Promise<boolean>}
   */
  const is_stranger = async id => {
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
  const sync_offline_actions = async () => {
    if (navigator.onLine) {
      const offline = await get('sync:offline')
      if (!offline) return
      while (offline.length) {
        const item = offline.pop()
        if (item.action === 'save') await new Offline(item.id).save()
        else if (item.action === 'delete') await new Offline(item.id).delete()
        else console.info('weird:unknown-offline-action', item.action, item.id)
      }
      await del('sync:offline')
    }
  }

  /**
   * @returns {Promise<void>}
   */
  const sync_me = async () => {
    const id = get_my_itemid()
    const network = (await fresh_metadata(id)).customMetadata
    let my_info = localStorage.getItem(id)
    if (!my_info) my_info = await get(id)
    if (!my_info || !network) return
    const hash = await create_hash(my_info)
    if (hash !== network.hash) {
      localStorage.removeItem(id)
      del(id)
    }
  }

  /**
   * @returns {Promise<void>}
   */
  const sync_statements = async () => {
    const persistance = new Statement()
    const itemid = get_my_itemid('statements')
    const network = (await fresh_metadata(itemid)).customMetadata
    const elements = sync_element.value.querySelector(`[itemid="${itemid}"]`)
    if (!elements || !elements.outerHTML) return null // nothing local so we'll let it load on request
    const hash = await create_hash(elements.outerHTML)
    if (!network || network.hash !== hash) {
      statements.value = await persistance.sync()
      if (statements.value.length) {
        await next_tick()
        await persistance.save(elements)
        localStorage.removeItem('/+/statements')
      }
    }
    await persistance.optimize()
  }

  /**
   * @returns {Promise<void>}
   */
  const sync_events = async () => {
    const events = new Event()
    const itemid = get_my_itemid('events')
    const network = (await fresh_metadata(itemid)).customMetadata
    const elements = sync_element.value.querySelector(`[itemid="${itemid}"]`)
    if (!elements) return
    const hash = await create_hash(elements.outerHTML)
    if (!network || network.hash !== hash) {
      events.value = await events.sync()
      if (events.value.length) {
        await next_tick()
        await events.save(elements)
        localStorage.removeItem('/+/events')
      }
    }
  }

  /**
   * @returns {Promise<void>}
   */
  const sync_anonymous_posters = async () => {
    await del('/+/posters/') // TODO:  Maybe overkill
    const offline_posters = await build_local_directory('/+/posters/')
    if (!offline_posters || !offline_posters.items) return
    for (const created_at of offline_posters.items) await save_poster(created_at)
  }

  /**
   * @param {Created} created_at
   * @returns {Promise<void>}
   */
  const save_poster = async created_at => {
    const poster_string = await get(`/+/posters/${created_at}`)
    sync_poster.value = get_item(poster_string)
    sync_poster.value.id = `${localStorage.me}/posters/${created_at}`
    await next_tick()
    await new Poster(sync_poster.value.id).save()
    sync_poster.value = null
    await del(`/+/posters/${created_at}`)
  }

  /**
   * @returns {Promise<void>}
   */
  const sync_posters_directory = async () => {
    const me = get_my_itemid()
    if (!me) return
    const directory_path = `${me}/posters/`
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

  mounted(async () => {
    document.addEventListener('visibilitychange', play)
    window.addEventListener('online', play)
    relations.value = await load(`${localStorage.me}/relations`)
  })

  dismount(() => {
    window.removeEventListener('online', play)
    document.removeEventListener('visibilitychange', play)
  })

  watch(current_user, async () => {
    if (current_user.value) {
      await sync_anonymous_posters()
      await play()
    }
  })
  return {
    events,
    sync_element,
    sync_poster
  }
}
export const get_content_hash = async itemid => {
  const local = await get(itemid)
  if (!local) return null
  return create_hash(local)
}
export const fresh_metadata = async itemid => {
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
  index[itemid] = network
  await set('sync:index', index)
  return network
}
export function visit_interval() {
  return Date.now() - JS_TIME.ONE_HOUR
}

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
  if (am_i_fresh) console.info('i_am_fresh for', format_time_remaining(time_left))
  return am_i_fresh
}
