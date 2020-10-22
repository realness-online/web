
import * as firebase from 'firebase/app'
import 'firebase/auth'
import { set, get, del, keys } from 'idb-keyval'
import { as_type, as_created_at } from '@/helpers/itemid'
import { from_e64 } from '@/helpers/profile'
import get_item from '@/modules/item'
import { Poster, Offline } from '@/persistance/Storage'
export const five_minutes = 1000 * 60 * 5 // 780000
export function message_listener (message) {
  switch (message.data.action) {
    case 'initialize':
      return initialize(message.data.env)
    default:
      console.warn('Unhandled message from app: ', message.data.action, message)
  }
}
export function initialize (credentials) {
  firebase.initializeApp({
    apiKey: credentials.VUE_APP_API_KEY,
    authDomain: credentials.VUE_APP_AUTH_DOMAIN,
    databaseUrl: credentials.VUE_APP_DATABASE_URL,
    projectId: credentials.VUE_APP_PROJECT_ID,
    storageBucket: credentials.VUE_APP_STORAGE_BUCKET,
    messagingSenderId: credentials.VUE_APP_MESSAGING_SENDER_ID
  })
  firebase.auth().onAuthStateChanged(syncronize)
}
export async function syncronize (current_user) {
  console.log('syncronize')
  if (navigator.onLine && current_user) {
    console.time('sync:indexdb')
    let index = await get('index')
    if (!index) index = {}
    if (!index.last_run || (index.last_run - Date.now()) > five_minutes) {
      const full_list = await keys()
      full_list.forEach(resource => {
        if (as_type(resource.id) === 'person') return true
      })
    } else console.log('no sync')
    await set('index', index)
    console.timeEnd('sync:indexdb')
  }
}
export async function sync_offline () {
  const offline = await get('offline')
  if (!offline) return
  while (offline.length) {
    const item = offline.pop()
    if (item.action === 'save') await new Offline(item.id).save()
    else if (item.action === 'delete') await new Offline(item.id).delete()
    else console.info('unknown offline action', item.action, item.id)
  }
  await del('offline')
}
export async function sync_anonymous_posters (my) {
  const offline_posters = await get('/+/posters/')
  if (!offline_posters || !offline_posters.items) return
  const posters = []
  await Promise.all(offline_posters.items.map(async (created_at) => {
    const poster_as_string = await get(`/+/posters/${created_at}`)
    const poster = get_item(poster_as_string)
    poster.id = `${from_e64(my.phoneNumber)}/posters/${created_at}`
    posters.push(poster)
  }))
  if (posters.length) {
    this.posters = posters
    await this.$nextTick()
    await Promise.all(this.posters.map(async (poster) => {
      const created_at = as_created_at(poster.id)
      const new_poster = new Poster(poster.id)
      await new_poster.save()
      await del(`/+/posters/${created_at}`)
      offline_posters.items = offline_posters.items.filter(when => {
        return parseInt(when) !== created_at
      })
      await set('/+/posters/', offline_posters)
    }))
    this.posters = []
  }
}
self.addEventListener('message', message_listener) // set up communictaion
