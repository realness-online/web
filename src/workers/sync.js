import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import { is_fresh } from '@/helpers/date'
import { get, del, set } from 'idb-keyval'
import { as_filename } from '@/helpers/itemid'
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
    case 'sync:offline': return await offline()
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
  console.time('runs:sync')
  const me = firebase.auth().currentUser
  if (!navigator.onLine || !me) return
  const my_itemid = from_e64(me.phoneNumber)
  await del(`${my_itemid}/posters/`) // this sucks. 9/10 times there wont be a difference
  await anonymous_posters()
  await offline()
  post('sync:me')
  post('sync:statements')
  post('sync:happened')
  await people(relations)
  console.timeEnd('runs:sync')
}
export async function offline () {
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
export async function people (relations = []) {
  if (navigator.onLine && firebase.auth().currentUser) {
    const index = (await get('sync:index')) || {}
    await Promise.all(relations.map(async relation => {
      const meta = index[relation.id]
      if (meta && is_fresh(meta.updated)) await prune_person(relation.id)
      else if (get_random_int(5) === 0) await prune_person(relation.id) // Once in a while check an outdated person I am following
    }))
  }
}
// prune_strangers(my_itemid, relations)
// async function prune_strangers (my_itemid, relations) {
//   console.log('prune_strangers', my_itemid, relations)
//   const full_list = await keys()
//   const remove_list = full_list.filter(id => {
//     if (as_type(id) === 'person') {
//       return relations.some(relation => {
//         return !(relation.id === id)
//       })
//     } else return false
//   })
//   remove_list.forEach(stranger => {
//     console.log(stranger)
//     del(stranger.id)
//   })
// }
async function prune_person (itemid) {
  const network = await fresh_metadata(itemid)
  if (!network.customMetadata) return
  if (network.customMetadata.md5 !== await local_md5(itemid)) {
    await del(itemid)
    check_children(itemid)
  } else if (new Date(network.updated).getTime() > visit_interval()) {
    // Only delete poster directory for visit_interval
    await check_children(itemid)
  }
}
async function check_children (itemid) {
  await del(`${itemid}/posters/`)
  const statements = `${itemid}/statements`
  const network = await fresh_metadata(statements)
  if (network.customMetadata.md5 !== await local_md5(statements)) {
    await del(`${statements}/`)
    await del(statements)
  }
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
  if (!network) throw new Error(`unable to create metadata for ${itemid}`)
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
function get_random_int (max) {
  return Math.floor(Math.random() * Math.floor(max))
}
