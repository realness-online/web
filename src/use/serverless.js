import { initializeApp as initialize_firebase } from 'firebase/app'
import {
  getAuth as init_auth,
  onAuthStateChanged as auth_changed
} from 'firebase/auth'
import {
  getStorage as init_storage,
  getDownloadURL as download_url,
  ref as reference
} from 'firebase/storage'
import { get, set, keys } from 'idb-keyval'
import { ref } from 'vue'

// initialize application

if (navigator.onLine && import.meta.env.NODE_ENV === 'production') {
  const response = await fetch('__/firebase/init.json')
  await set('firebase-keys', await response.json())
} else {
  const dev_keys = {
    apiKey: import.meta.env.VITE_API_KEY,
    authDomain: import.meta.env.VITE_AUTH_DOMAIN,
    databaseUrl: import.meta.env.VITE_DATABASE_URL,
    projectId: import.meta.env.VITE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID
  }
  await set('firebase-keys', dev_keys)
}

const firebase_keys = await get('firebase-keys')
const info = ref(initialize_firebase(keys))
const storage = init_storage(info.value)

export const current_user = ref(null)
export const auth = init_auth(info.value)
export const file = path => reference(storage, path)
export const url = async path => await download_url(file(path))

auth_changed(auth, user => {
  if (user) current_user.value = user
  else current_user.value = null
})
