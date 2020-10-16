import { get, keys, set } from 'idb-keyval'
import 'firebase/auth'
import * as firebase from 'firebase/app'
import { as_type } from '@/helpers/itemid'
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
self.addEventListener('message', message_listener) // set up communictaion
