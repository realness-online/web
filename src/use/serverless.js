import { initializeApp as initialize_firebase } from 'firebase/app'
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  getAuth as init_auth,
  onAuthStateChanged as auth_changed,
  signOut as sign_out
} from 'firebase/auth'
import {
  getStorage as get_storage,
  getDownloadURL as download_url,
  ref as reference,
  getMetadata as get_metadata,
  listAll as list_directory,
  uploadString as upload_file,
  deleteObject as delete_file,
  StringFormat
} from 'firebase/storage'
import { get, set } from 'idb-keyval'
import { ref } from 'vue'
import { me, from_e64 } from '@/use/people'
import { load } from '@/use/itemid'
console.log('instantiated serverless')
if (navigator.onLine && import.meta.env.PROD) {
  try {
    fetch('__/firebase/init.json').then(async response => {
      await set('firebase-keys', await response.json())
    })
  } catch (e) {
    console.log(e)
  }
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
export const app = ref(initialize_firebase(firebase_keys))

// Auth methods
export const auth = init_auth(app.value)
export const Recaptcha = RecaptchaVerifier
export const sign_in = signInWithPhoneNumber
export const sign_off = () => sign_out(auth)
export const current_user = ref(null)
auth_changed(auth, user => {
  console.log('auth_changed')
  if (user) {
    current_user.value = user
    localStorage.me = from_e64(current_user.value.phoneNumber)
    me.value.id = localStorage.me
    load(localStorage.me).then(maybe_me => {
      if (maybe_me) me.value = maybe_me
    })
  } else current_user.value = null
})

// storage methods
const storage = get_storage(app.value)
export const location = path => reference(storage, path)
export const metadata = async path => get_metadata(location(path))

export const upload = (path, data, meta) => {
  console.log('upload', path)
  upload_file(location(path), data, StringFormat.raw, meta)
}

export const url = async path => await download_url(location(path))
export const directory = async path => await list_directory(location(path))
export const remove = async path => {
  try {
    delete_file(location(path))
  } catch (e) {
    if (e.code === 'storage/object-not-found')
      console.log(path, 'already deleted')
    else throw e
  }
}
