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
  uploadString as upload_string,
  uploadBytes as upload_bytes,
  deleteObject as delete_file,
  StringFormat as string_format
} from 'firebase/storage'
import { initializeApp as initialize_firebase } from 'firebase/app'
import { ref } from 'vue'
import { load } from '@/utils/itemid'
import { from_e64, default_person } from '@/use/people'

export const me = ref(undefined)
export const app = ref(undefined)
export const auth = ref(undefined)
export const storage = ref(undefined)
export const current_user = ref(undefined)

export const Recaptcha = RecaptchaVerifier
export const sign_in = signInWithPhoneNumber
export const sign_off = () => sign_out(auth.value)

// storage methods
export const location = path => reference(storage.value, path)
export const metadata = async path => get_metadata(location(path))
export const upload = (path, data, meta) => {
  if (data instanceof Blob) return upload_bytes(location(path), data, meta)
  return upload_string(location(path), data, string_format.RAW, meta)
}
export const url = async path => await download_url(location(path))
export const directory = async path => await list_directory(location(path))
export const remove = async path => {
  try {
    delete_file(location(path))
  } catch (e) {
    if (e.code === 'storage/object-not-found')
      console.warn(path, 'already deleted')
    else throw e
  }
}

export const init_serverless = () => {
  me.value = default_person
  const init = {
    apiKey: String(import.meta.env.VITE_API_KEY || ''),
    appId: String(import.meta.env.VITE_APP_ID || ''),
    authDomain: String(import.meta.env.VITE_AUTH_DOMAIN || ''),
    projectId: String(import.meta.env.VITE_PROJECT_ID || ''),
    storageBucket: String(import.meta.env.VITE_STORAGE_BUCKET || ''),
    messagingSenderId: String(import.meta.env.VITE_MESSAGING_SENDER_ID || '')
  }

  try {
    const firebase_app = initialize_firebase(init)
    app.value = firebase_app

    if (firebase_app) auth.value = init_auth(firebase_app)
    else console.error('Firebase app initialization failed')
  } catch (error) {
    console.error('Firebase initialization error:', error)
    throw error
  }

  storage.value = get_storage(app.value)
  auth_changed(auth.value, async user => {
    if (user) {
      current_user.value = user
      localStorage.me = from_e64(current_user.value.phoneNumber)
      me.value.id = localStorage.me
      const maybe_me = await load(localStorage.me)
      if (maybe_me) me.value = maybe_me
    } else current_user.value = null
  })
}
