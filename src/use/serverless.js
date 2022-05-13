// import { initializeApp as initialize_firebase } from 'firebase/app'
import firebase from 'firebase/compat/app'
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  getAuth as init_auth,
  onAuthStateChanged as auth_changed,
  signOut
} from 'firebase/auth'
import {
  getStorage as init_storage,
  getDownloadURL as download_url,
  ref as reference,
  listAll as list_directory,
  uploadString as upload_file,
  deleteObject as delete_file
} from 'firebase/storage'
import { get, set } from 'idb-keyval'
import { ref } from 'vue'

// initialize application
if (navigator.onLine && import.meta.env.NODE_ENV === 'production') {
  const firebase_keys = await get('firebase-keys')
  if (!firebase_keys) {
    const response = await fetch('__/firebase/init.json')
    await set('firebase-keys', await response.json())
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
export const app = ref(firebase.initializeApp(firebase_keys))
// const app = ref(initialize_firebase(firebase_keys))
// can't use this until fully converted to firebase version 9 modular
const storage = init_storage(app.value)
export const sign_in = signInWithPhoneNumber
export const Recaptcha = RecaptchaVerifier
export const current_user = ref(null)
export const auth = init_auth(app.value)
export const location = path => reference(storage, path)
export const upload = (path, data, meta) =>
  upload_file(location(path), data, meta)
export const url = async path => await download_url(location(path))
export const directory = async path => await list_directory(location(path))
export const remove = async path => delete_file(location(path))
export const sign_off = () => signOut()
auth_changed(auth, user => {
  if (user) current_user.value = user
  else current_user.value = null
})

console.log('I am doing stuff', auth.value, app.value)
