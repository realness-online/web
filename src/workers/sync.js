import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import { is_fresh } from '@/helpers/date'
import { get, del, set, keys } from 'idb-keyval'
import { as_type, as_filename } from '@/helpers/itemid'
import { from_e64 } from '@/helpers/profile'
import { Offline } from '@/persistance/Storage'
const five_minutes = 300000
export const one_hour = five_minutes * 12
const timeouts = []
export async function message_listener (message) {
  switch (message.data.action) {
    case 'sync:initialize':
      return await initialize(message.data.config, new Date(message.data.last_sync))
    case 'sync:offline':
      return offline()
  }
}
self.addEventListener('message', message_listener)
export async function initialize (credentials, last_sync) {
  if (firebase.apps.length === 0) firebase.initializeApp(credentials)
  firebase.auth().onAuthStateChanged(async me => {
    if (me) {
      let synced
      if (last_sync) synced = Date.now() - last_sync.getTime()
      else synced = five_minutes
      const time_left = five_minutes - synced
      if (time_left < 0) recurse()
      else setTimeout(recurse, time_left)
    } else timeouts.forEach(id => clearTimeout(id))
  })
}
export async function recurse () {
  const me = firebase.auth().currentUser
  if (!navigator.onLine || !me) return
  const my_itemid = from_e64(me.phoneNumber)
  if (await is_outdated(my_itemid)) await del(my_itemid)
  if (await is_outdated(`${my_itemid}/statements`)) post('sync:statements')
  if (await is_outdated(`${my_itemid}/events`)) post('sync:events')
  await del(`${my_itemid}/posters/`)
  await anonymous()
  await offline()
  await people(my_itemid)
  post('sync:happened')
  timeouts.push(setTimeout(recurse, five_minutes))
}
export async function offline () {
  if (navigator.onLine) {
    const offline = await get('offline')
    if (!offline) return
    while (offline.length) {
      const item = offline.pop()
      if (item.action === 'save') await new Offline(item.id).save()
      else if (item.action === 'delete') await new Offline(item.id).delete()
      else console.info('weird:unknown-offline-action', item.action, item.id)
    }
    await del('offline')
  }
}
export async function anonymous () {
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
export async function people (my_itemid) {
  if (navigator.onLine) {
    let index = await get('sync:index')
    if (!index) index = {}
    const people = await list_people(my_itemid)
    index = await check_people(people, index)
    set('sync:index', index)
  }
}
async function list_people (my_itemid) {
  const full_list = await keys()
  return full_list.filter(id => {
    if (id === my_itemid) return false
    return as_type(id) === 'person'
  })
}
async function check_people (people, index) {
  await Promise.all(people.map(async (itemid) => {
    const meta = index[itemid]
    if (meta && is_fresh(meta.updated)) await prune_person(itemid, index)
  }))
  return index
}
async function prune_person (itemid, index) {
  if (await is_outdated(itemid)) {
    await del(itemid)
    console.info('cache:pruned', itemid)
    check_my_babies(itemid, index)
  } else if (index[itemid].updated < visit_interval()) {
    console.log('calling check_my_babies', itemid)
    await check_my_babies(itemid, index)
  }
}
async function check_my_babies (itemid, index) {
  // Only delete poster directory for an hour; trusting last_visit
  await del(`${itemid}/posters/`)
  console.info('cache:pruned', 'posters directory')
  const events = `${itemid}/events`
  const statements = `${itemid}/statements`
  if (await is_outdated(statements)) {
    await del(`${statements}/`)
    await del(statements)
    console.info('cache:pruned', statements)
  }
  if (await is_outdated(events)) {
    await del(events)
    await del(`${events}/`)
    console.info('cache:pruned', events)
  }
}
async function is_outdated (itemid) {
  let index = await get('sync:index')
  if (!index) index = {}
  const path = await firebase.storage().ref().child(as_filename(itemid))
  let network
  try {
    console.info('request:metadata', itemid)
    network = await path.getMetadata()
  } catch (e) {
    if (e.code === 'storage/object-not-found') {
      network = { updated: null } // Explicitly setting null to indicate that this file doesn't exist
    } else throw e
  }
  let local = index[itemid]
  index[itemid] = network
  await set('sync:index', index)
  if (network.updated === null) return false
  if (!local || network.updated === null) return true
  local = new Date(local.updated).getTime()
  network = new Date(network.updated).getTime()
  return network > local
}
function post (action, param) {
  self.postMessage({ action, param })
}
export function visit_interval () {
  return (Date.now() - one_hour)
}
