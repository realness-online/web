import hash from 'object-hash'
import { location, metadata } from '@/use/serverless'
import { get, del, set, keys } from 'idb-keyval'
import { as_filename, as_author, list, load } from '@/use/itemid'
import { Offline, Statements, Events, Poster, Me } from '@/persistance/Storage'
import { from_e64 } from '@/use/people'
import get_item from '@/use/item'
import {
  ref,
  watchEffect as watch_effect,
  onMounted as mounted,
  onUnmounted as dismount,
  nextTick as next_tick,
  getCurrentInstance as current_instance
} from 'vue'
import { current_user } from '@/use/serverless'

export const three_minutes = 180000
export const five_minutes = 300000
export const one_hour = 3600000
export const eight_hours = one_hour * 8
export const timeouts = []
export const hash_options = { encoding: 'base64', algorithm: 'md5' }
export const does_not_exist = { updated: null, customMetadata: { md5: null } } // Explicitly setting null to indicate that this file doesn't exist

export async function sync_later(id, action) {
  const offline = (await get('sync:offline')) || []
  offline.push({ id, action })
  await set('sync:offline', offline)
}
export async function is_stranger(id) {
  const relations = await list(`${localStorage.me}/relations`)
  relations.push({
    id: localStorage.me,
    type: 'person'
  })
  const is_friend = relations.some(relation => {
    if (relation.id === id) return true
    else return false
  })
  return !is_friend
}
export async function sync_offline_actions() {
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
export async function prune() {
  const relations = await list(`${localStorage.me}/relations`)
  const everything = await keys()
  everything.forEach(async itemid => {
    if (!as_author(itemid)) return // items have authors
    if (await is_stranger(as_author(itemid), relations)) await del(itemid) // only relations are cached
    if (await itemid.endsWith('/')) await del(itemid)
    else {
      const network = await fresh_metadata(itemid)
      if (!network || !network.customMetadata) return null
      const md5 = await local_md5(itemid)
      if (network.customMetadata.md5 !== md5) await del(itemid)
    }
  })
}
export async function local_md5(itemid) {
  // always checks the network
  const local = await get(itemid)
  if (!local) return null
  return hash(local, hash_options)
}
export async function fresh_metadata(itemid) {
  const index = (await get('sync:index')) || {}
  const path = location(as_filename(itemid))
  let network
  try {
    console.info('request:metadata', itemid)
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
export const get_my_itemid = type => {
  if (type) return `${localStorage.me}/${type}`
  else return localStorage.me
}

export const me = ref(null)
export const statements = ref(null)
export const new_statement = ref(null)
export const i_am_fresh = () => {
  let synced
  if (localStorage.sync_time) {
    synced = Date.now() - new Date(localStorage.sync_time).getTime()
  } else {
    localStorage.sync_time = new Date().toISOString()
    synced = eight_hours
  }
  const time_left = eight_hours - synced
  return time_left <= 0
}

export const use = () => {
  const { emit } = current_instance()
  const poster = ref(null)
  const events = ref(null)
  const sync_element = ref(null)
  const play = async () => {
    if (document.visibilityState !== 'visible') return
    console.log('play the sync game')
    await visit()
    if (!navigator.onLine || !current_user.value) return
    await sync_offline_actions()
    // if (i_am_fresh()) return
    // setTimeout(async () => {
    emit('active', true)
    await prune()
    await sync_me()
    await sync_statements()
    await sync_events()
    await sync_anonymous_posters()

    emit('active', false)
    // }, 1000)
  }
  const visit = async () => {
    me.value = await load(from_e64(current_user.value.phoneNumber))
    if (!me.value) return // Do nothing until there is a person
    const visit_digit = new Date(me.value.visited).getTime()
    if (visit_interval() > visit_digit) {
      me.value.visited = new Date().toISOString()
      await next_tick()
      await new Me().save()
      console.log('should save me')
    }
  }
  const sync_me = async () => {
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
    const persistance = new Statements()
    const itemid = get_my_itemid('statements')
    const network = (await fresh_metadata(itemid)).customMetadata
    const elements = sync.value.querySelector(`[itemid="${itemid}"]`)
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
    const events = new Events()
    const itemid = get_my_itemid('events')
    const network = (await fresh_metadata(itemid)).customMetadata
    const elements = sync.value.querySelector(`[itemid="${itemid}"]`)
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
    const offline_posters = await get('/+/posters/')
    if (!offline_posters || !offline_posters.items) return
    await Promise.all(
      offline_posters.items.map(async created_at => {
        const poster_string = await get(`/+/posters/${created_at}`)
        save_poster({
          id: `${localStorage.me}/posters/${created_at}`,
          outerHTML: poster_string
        })
        await del(`/+/posters/${created_at}`)
      })
    )
    await del('/+/posters/')
  }
  const save_poster = async poster => {
    props.poster.value = get_item(poster.outerHTML)
    props.poster.id = poster.id
    await next_tick()
    const new_poster = new Poster(poster.value.id)
    await new_poster.save()
    await del(`${localStorage.me}/posters/`)
    poster.value = null
  }

  watch_effect(async () => {
    if (current_user.value && navigator.onLine) {
      const my_id = from_e64(current_user.value.phoneNumber)
      localStorage.me = my_id
      me.value = await load(my_id)
      statements.value = await list(`${my_id}/statements`)
      await play()
      window.addEventListener('online', play)
    } else window.removeEventListener('online', play)
  })
  watch_effect(async () => {
    if (new_statement.value) {
      await next_tick()
      const id = get_my_itemid('statements')
      statements.value = await list(id)
      statements.value.push(new_statement.value)
      await next_tick()
      await new Statements().save()
      new_statement.value = null
    }
  })
  mounted(() => document.addEventListener('visibilitychange', play))
  dismount(() => document.removeEventListener('visibilitychange', play))
  return {
    me,
    statements,
    new_statement,
    play,
    events,
    poster,
    sync_element
  }
}
