import hash from 'object-hash'
import { location, metadata } from '@/use/serverless'
import { get, del, set, keys } from 'idb-keyval'
import {
  as_filename,
  as_author,
  load,
  build_local_directory
} from '@/use/itemid'
import { Offline, Statements, Events, Poster, Me } from '@/persistance/Storage'
import { current_user } from '@/use/serverless'
import { get_my_itemid, use_me } from '@/use/people'
import { use as use_statements } from '@/use/statements'
import get_item from '@/use/item'
import {
  ref,
  onMounted as mounted,
  onUnmounted as dismount,
  nextTick as next_tick,
  getCurrentInstance as current_instance,
  provide,
  watch
} from 'vue'

export const three_minutes = 180000
export const five_minutes = 300000
export const one_hour = 3600000
export const eight_hours = one_hour * 8
export const timeouts = []
export const hash_options = { encoding: 'base64', algorithm: 'md5' }
export const does_not_exist = { updated: null, customMetadata: { md5: null } } // Explicitly setting null to indicate that this file doesn't exist

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
    await visit()
    if (!navigator.onLine || !current_user.value) return
    if (i_am_fresh()) {
      await sync_offline_actions()
    } else {
      emit('active', true)
      // localStorage.sync_time = new Date().toISOString()
      await sync_anonymous_posters()
      await prune()
      await sync_me()
      await sync_statements()
      await sync_events()
      emit('active', false)
    }
  }
  const visit = async () => {
    const visit_digit = new Date(me.value.visited).getTime()
    if (visit_interval() > visit_digit) {
      me.value.visited = new Date().toISOString()
      await next_tick()
      await new Me().save()
    }
  }
  const prune = async () => {
    console.log('prune')
    const everything = await keys()
    everything.forEach(async itemid => {
      if (!as_author(itemid)) return // items have authors
      if (await is_stranger(as_author(itemid), relations.value))
        await del(itemid) // only relations are cached
      if (await itemid.endsWith('/')) await del(itemid)
      else {
        const network = await fresh_metadata(itemid)
        if (!network || !network.customMetadata) return null
        const md5 = await local_md5(itemid)
        if (network.customMetadata.md5 !== md5) await del(itemid)
      }
    })
  }
  const is_stranger = async id => {
    const friends = [...relations.value]
    friends.push({
      id: localStorage.me,
      type: 'person'
    })
    const is_friend = friends.some(relation => {
      if (relation.id === id) return true
      else return false
    })
    return !is_friend
  }
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
  const sync_me = async () => {
    console.log('sync_me')
    const id = get_my_itemid()
    const network = (await fresh_metadata(id)).customMetadata
    let my_info = localStorage.getItem(id)
    if (!my_info) my_info = await get(id)
    if (!my_info || !network) return
    const md5 = hash(my_info, hash_options)
    if (md5 !== network.md5) {
      localStorage.removeItem(id)
      del(id)
    }
  }
  const sync_statements = async () => {
    console.log('sync_statements')
    const persistance = new Statements()
    const itemid = get_my_itemid('statements')
    const network = (await fresh_metadata(itemid)).customMetadata
    const elements = sync_element.value.querySelector(`[itemid="${itemid}"]`)
    if (!elements || !elements.outerHTML) return null // nothing local so we'll let it load on request
    const md5 = hash(elements.outerHTML, hash_options)
    if (!network || network.md5 !== md5) {
      statements.value = await persistance.sync()
      if (statements.value.length) {
        await next_tick()
        await persistance.save(elements)
        localStorage.removeItem('/+/statements')
      }
    }
    await persistance.optimize()
  }
  const sync_events = async () => {
    console.log('sync_events')
    const events = new Events()
    const itemid = get_my_itemid('events')
    const network = (await fresh_metadata(itemid)).customMetadata
    const elements = sync_element.value.querySelector(`[itemid="${itemid}"]`)
    if (!elements) return
    const md5 = hash(elements.outerHTML, hash_options)
    if (!network || network.md5 !== md5) {
      events.value = await events.sync()
      if (events.value.length) {
        await next_tick()
        await events.save(elements)
        localStorage.removeItem('/+/events')
      }
    }
  }
  const sync_anonymous_posters = async () => {
    await del('/+/posters/') // TODO:  Maybe overkill
    const offline_posters = await build_local_directory('/+/posters/')
    if (!offline_posters || !offline_posters.items) return
    for (const created_at of offline_posters.items) {
      await save_poster(created_at)
    }
  }
  const save_poster = async created_at => {
    const poster_string = await get(`/+/posters/${created_at}`)
    sync_poster.value = get_item(poster_string)
    sync_poster.value.id = `${localStorage.me}/posters/${created_at}`
    await next_tick()
    await new Poster(sync_poster.value.id).save()
    sync_poster.value = null
    await del(`/+/posters/${created_at}`)
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
    if (current_user.value) await play()
  })
  return {
    events,
    sync_element,
    sync_poster
  }
}

export const local_md5 = async itemid => {
  // always checks the network
  const local = await get(itemid)
  if (!local) return null
  return hash(local, hash_options)
}
export const fresh_metadata = async itemid => {
  const index = (await get('sync:index')) || {}
  const path = location(as_filename(itemid))
  let network
  try {
    // console.info('request:metadata', itemid)
    network = await metadata(path)
  } catch (e) {
    if (e.code === 'storage/object-not-found') {
      network = does_not_exist
    } else throw e
  }
  if (!network) throw new Error(`Unable to create metadata for ${itemid}`)
  index[itemid] = network
  await set('sync:index', index)
  return network
}
export function visit_interval() {
  return Date.now() - one_hour
}
export const i_am_fresh = () => {
  let synced
  if (localStorage.sync_time) {
    synced = Date.now() - new Date(localStorage.sync_time).getTime()
  } else {
    localStorage.sync_time = new Date().toISOString()
    synced = eight_hours
  }
  const time_left = eight_hours - synced
  const am_i_fresh = time_left > 0
  console.info('i_am_fresh', am_i_fresh, time_left)
  return am_i_fresh
}
