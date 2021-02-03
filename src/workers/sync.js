import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import { is_fresh } from '@/helpers/date'
import { get, del, set, keys } from 'idb-keyval'
import { as_type, as_filename } from '@/helpers/itemid'
import { from_e64 } from '@/helpers/profile'
import get_item from '@/modules/item'
import { Offline } from '@/persistance/Storage'

export function message_listener (message) {
  switch (message.data.action) {
    case 'sync:initialize':
      return initialize(message.data.config)
    case 'sync:people':
      return people(firebase.auth().currentUser, message.data.check_everyone)
    case 'sync:offline':
      return offline(firebase.auth().currentUser)
    case 'sync:anonymous':
      return anonymous(firebase.auth().currentUser)
    // default:
    //   console.warn('Unhandled message from app: ', message.data.action, message)
  }
}
self.addEventListener('message', message_listener) // set up communictaion

export function initialize (credentials) {
  firebase.initializeApp(credentials)
  firebase.auth().onAuthStateChanged(async me => {
    console.log('sync:worker:onAuthStateChanged')
    if (navigator.onLine && me) {
      await people(me, true)
      self.postMessage({ action: 'sync:statements' })
      self.postMessage({ action: 'sync:events' })
      await offline(me)
    }
  })
}
export async function offline (me = firebase.auth().currentUser) {
  if (navigator.onLine && me) {
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
export async function anonymous (me = firebase.auth().currentUser) {
  if (navigator.onLine && me) {
    const offline_posters = await get('/+/posters/')
    if (!offline_posters.items) return
    await Promise.all(offline_posters.items.map(async (created_at) => {
      const poster_as_string = await get(`/+/posters/${created_at}`)
      const poster = get_item(poster_as_string)
      poster.id = `${from_e64(me.phoneNumber)}/posters/${created_at}`
      self.postMessage({ action: 'save:poster', poster }, '*')
      await del(`/+/posters/${created_at}`)
    }))
    await del('/+/posters/')
  }
}
export async function people (me = firebase.auth().currentUser, check_everyone = false) {
  if (navigator.onLine && me) {
    console.time('sync:people')
    const people = await list_people()
    await check_people(people, check_everyone)
    console.timeEnd('sync:people')
    setTimeout(recurse, five_minutes)
  }
}
async function recurse () {
  await people()
  self.postMessage({ action: 'sync:statements' }, '*')
  self.postMessage({ action: 'sync:events' }, '*')
}
async function list_people () {
  const full_list = await keys()
  return full_list.filter(id => {
    return as_type(id) === 'person'
  })
}
async function check_people (people, check_everyone) {
  let what_I_know = await get('sync:index')
  if (!what_I_know) what_I_know = {}
  await Promise.all(people.map(async (itemid) => {
    const meta = what_I_know[itemid]
    if (!meta) await prune_person(itemid, what_I_know)
    else if (is_fresh(meta.updated)) await prune_person(itemid, what_I_know)
    else if (check_everyone) await prune_person(itemid, what_I_know)
  }))
}
/**
 * @param {IDBValidKey} itemid
 * @param {any} what_I_know
 */
async function prune_person (itemid, index) {
  if (await is_outdated(itemid, index)) {
    await del(itemid)
    await del(`${itemid}/posters/`)
  }
  const statements = `${itemid}/statements`
  if (await is_outdated(statements, index)) {
    await del(statements)
    await del(`${statements}/`)
  }
  const events = `${itemid}/events`
  if (await is_outdated(events, index)) await del(events)
  console.info('cache:pruned', itemid)
}
const five_seconds = 1000 * 5
const one_minute = five_seconds * 12
const five_minutes = five_seconds * one_minute // 300000
async function is_outdated (itemid, what_I_know) {
  const path = await firebase.storage().ref().child(as_filename(itemid))
  let network
  let local = what_I_know[itemid]
  try {
    console.info('request:metadata', itemid)
    network = await path.getMetadata()
  } catch (e) {
    if (e.code === 'storage/object-not-found') {
      console.info('request:not-found', itemid)
      network = { updated: null } // Explicitly setting null to indicate that this file doesn't exist
    } else throw e
  }
  if (!what_I_know[itemid] || network.updated === null) local = network
  what_I_know[itemid] = network // now that local and network are known, set the index to network, and save
  await set('sync:index', what_I_know)
  local = new Date(local.updated).getTime()
  network = new Date(network.updated).getTime()
  if (network > local) return true
  else return false
}
