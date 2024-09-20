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
import { initializeApp as initialize_firebase } from 'firebase/app'
import { ref } from 'vue'
import { load } from '@/use/itemid'
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
export const upload = (path, data, meta) =>
  upload_file(location(path), data, StringFormat.RAW, meta)
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
    apiKey: import.meta.env.VITE_API_KEY,
    appId: import.meta.env.VITE_APP_ID,
    authDomain: import.meta.env.VITE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID
  }
  console.log(init)
  app.value = initialize_firebase(init)
  auth.value = init_auth(app.value)
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
