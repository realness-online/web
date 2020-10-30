
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import { is_today } from '@/helpers/date'
import { get, del, keys } from 'idb-keyval'
import { as_type, as_filename } from '@/helpers/itemid'
import { from_e64 } from '@/helpers/profile'
import get_item from '@/modules/item'
import { Offline } from '@/persistance/Storage'

export function message_listener (message) {
  const me = firebase.auth().currentUser
  switch (message.data.action) {
    case 'sync:initialize':
      return initialize(message.data.env)
    case 'sync:people':
      return people(me, message.data.check_everyone)
    case 'sync:offline':
      return offline(me)
    case 'sync:anonymous':
      return anonymous(me)
    default:
      console.warn('Unhandled message from app: ', message.data.action, message)
  }
}
self.addEventListener('message', message_listener) // set up communictaion

export function initialize (credentials) {
  firebase.initializeApp({
    apiKey: credentials.VUE_APP_API_KEY,
    authDomain: credentials.VUE_APP_AUTH_DOMAIN,
    databaseUrl: credentials.VUE_APP_DATABASE_URL,
    projectId: credentials.VUE_APP_PROJECT_ID,
    storageBucket: credentials.VUE_APP_STORAGE_BUCKET,
    messagingSenderId: credentials.VUE_APP_MESSAGING_SENDER_ID
  })
  firebase.auth().onAuthStateChanged(me => {
    if (navigator.onLine && me) {
      people(me, true)
      offline(me)
    }
  })
}
export async function offline (me = firebase.auth().currentUser) {
  if (navigator.onLine && me) {
    const offline = await get('offline')
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
  if (!navigator.onLine || !me) return
  console.time('sync:people')
  const people = await list_people()
  await check_people(people, check_everyone)
  console.timeEnd('sync:people')
  setTimeout(async () => { // Call myself in the future
    const is_peering = await get('sync:peer-connected')
    if (!is_peering) await people()
  }, five_seconds)
}

// Local functions
async function list_people () {
  const full_list = await keys()
  return full_list.filter(id => {
    return as_type(id) === 'person'
  })
}
async function check_people (people, check_everyone = false) {
  const what_I_know = await get('index')
  people.forEach(async (id) => {
    const person = get_item(await get(id))
    if (check_everyone) prune_person(id, what_I_know)
    else if (is_today(person.last_visit)) prune_person(id, what_I_know)
    // check when each user last updated
  })
}
function prune_person (itemid, what_I_know) {
  del(`${itemid}/posters/`) // Remove local cache of posters direcrory
  if (is_outdated(itemid, what_I_know)) {
    del(itemid)
  }
  if (is_outdated(`${itemid}/statements`, what_I_know)) {
    del(`${itemid}/statements`) // Delete statements index
    del(`${itemid}/statements/`)
  }
  if (is_outdated(`${itemid}/events`, what_I_know)) {
    del(`${itemid}/events`)
    del(`${itemid}/events/`)
  }
}

const five_seconds = 1000 * 5
// const one_minuite = five_seconds * 12
// const five_minutes = five_seconds * one_minuite // 300000
async function is_outdated (itemid, what_I_know) {
  const path = as_filename(itemid)
  const meta = await firebase.storage().ref().child(path).get_metadata()
  console.log(meta)
  if (meta.updated > what_I_know[itemid].updated) return true
  else return false
}
