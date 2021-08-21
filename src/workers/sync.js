import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import { get, del, set, keys } from 'idb-keyval'
import { as_filename, as_author } from '@/helpers/itemid'
import { from_e64 } from '@/helpers/profile'
import { Offline } from '@/persistance/Storage'
import hash from 'object-hash'
// const one_minute = 60000
export const three_minutes = 180000
// const five_minutes = 300000
export const one_hour = 3600000
export const timeouts = []
export const hash_options = { encoding: 'base64', algorithm: 'md5' }
export const does_not_exist = { updated: null, customMetadata: { md5: null } } // Explicitly setting null to indicate that this file doesn't exist
export async function message_listener (message) {
  switch (message.data.action) {
    case 'sync:initialize': return await initialize(message.data)
    case 'sync:offline': return await offline_actions()
    case 'sync:play': return await play(message.data)
  }
}

self.addEventListener('message', message_listener)

export async function initialize (data) {
  if (firebase.apps.length === 0) firebase.initializeApp(data.config)
  firebase.auth().onAuthStateChanged(async me => { if (me) await play(data) })
}

export async function play (data = { last_sync: 0 }) {
  let synced
  if (data.last_sync) synced = Date.now() - new Date(data.last_sync).getTime()
  else synced = three_minutes
  const time_left = three_minutes - synced
  if (time_left <= 0) await sync(data.relations)
}

export async function sync (relations) {
  if (!navigator.onLine || !firebase.auth().currentUser) return
  post('sync:started')
  await anonymous_posters()
  await offline_actions()
  await prune(relations)
  post('sync:happened')
}

export async function offline_actions () {
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

export async function anonymous_posters () {
  const me = firebase.auth().currentUser
  if (!navigator.onLine || !me) return
  const offline_posters = await get('/+/posters/')
  if (!offline_posters || !offline_posters.items) return
  await Promise.all(offline_posters.items.map(async (created_at) => {
    const poster_string = await get(`/+/posters/${created_at}`)
    post('save:poster', {
      id: `${from_e64(me.phoneNumber)}/posters/${created_at}`,
      outerHTML: poster_string
    })
    await del(`/+/posters/${created_at}`)
  }))
  await del('/+/posters/')
}

export async function prune (relations = []) {
  const everything = await keys()
  everything.forEach(async itemid => {
    // console.log(id)
    if (!as_author(itemid)) return // items have authors
    if (is_stranger(as_author(itemid), relations)) {
      await del(itemid)
    } else {
      const network = await fresh_metadata(itemid)
      if (!network.customMetadata) return
      const md5 = await local_md5(itemid)
      if (network.customMetadata.md5 !== md5) {
        console.log('outdated', itemid)
        await del(itemid)
      }
    }
  })
}

function is_stranger (id, relations) {
  const is_friend = relations.some(relation => {
    if (relation.id === id) return true
    else return false
  })
  return !is_friend
}

export async function local_md5 (itemid) { // always checks the network
  const local = await get(itemid)
  if (!local) return null
  return hash(local, hash_options)
}

export async function fresh_metadata (itemid) {
  const index = (await get('sync:index')) || {}
  const path = firebase.storage().ref().child(as_filename(itemid))
  let network
  try {
    // console.info('request:metadata', itemid)
    network = await path.getMetadata()
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

function post (action, param) {
  self.postMessage({ action, param })
}

export function visit_interval () {
  return (Date.now() - one_hour)
}
