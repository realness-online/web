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
import { load_from_network, load } from '@/utils/itemid'
import { from_e64, default_person } from '@/use/people'

import { get, set } from 'idb-keyval'
import { prepare_upload_html } from '@/utils/upload-processor'
import { as_filename } from '@/utils/itemid'
/** @typedef {import('@/types').Id} Id */

export const me = ref(undefined)
export const app = ref(undefined)
export const auth = ref(undefined)
export const storage = ref(undefined)
export const current_user = ref(undefined)

export const Recaptcha = RecaptchaVerifier
export const sign_in = signInWithPhoneNumber
export const sign_off = () => sign_out(auth.value)

// storage methods
/**
 * @param {string} path
 */
export const location = path => reference(storage.value, path)
export const metadata = path => get_metadata(location(path))
/**
 * @param {string} path
 * @param {string | Blob} data
 * @param {Object} meta
 * @returns {Promise<import('firebase/storage').UploadResult>}
 */
export const upload = (/** @type {string} */ path, data, meta) => {
  if (data instanceof Blob) return upload_bytes(location(path), data, meta)
  return upload_string(location(path), data, string_format.RAW, meta)
}
export const url = path => download_url(location(path))
export const directory = path => list_directory(location(path))
/**
 * @param {string} path
 * @returns {Promise<void>}
 */
export const remove = async (/** @type {string} */ path) => {
  try {
    await delete_file(location(path))
  } catch (e) {
    if (e.code === 'storage/object-not-found')
      console.warn(path, 'already deleted')
    else throw e
  }
}

export const move = async (type, id, archive_id, author = localStorage.me) => {
  const component_types = [
    'shadows',
    'sediment',
    'sand',
    'gravel',
    'rocks',
    'boulders'
  ]
  const is_component = component_types.includes(type)

  let old_location, new_location
  if (is_component) {
    old_location = /** @type {Id} */ (`${author}/${type}/${id}`)
    new_location = /** @type {Id} */ (`${author}/${type}/${archive_id}/${id}`)
  } else {
    old_location = /** @type {Id} */ (`${author}/${type}/${id}`)
    new_location = /** @type {Id} */ (`${author}/${type}/${archive_id}/${id}`)
  }
  const local_id = old_location

  let html = await get(local_id)
  if (!html) {
    html = await load(old_location)
    if (!html) return false
    html = await get(local_id)
    if (!html) return false
  }

  let upload_successful = false
  const { compressed, metadata } = await prepare_upload_html(html)
  try {
    await upload(await as_filename(new_location), compressed, metadata)
    upload_successful = true

    await remove(await as_filename(old_location))
    console.info(`Moved ${old_location} to ${new_location}`)
    return true
  } catch (error) {
    if (upload_successful)
      try {
        await remove(await as_filename(new_location))
        await set(old_location, html)
        console.info(`Rolled back upload of ${new_location}`)
      } catch (cleanup_error) {
        console.error(`Failed to cleanup ${new_location}`, cleanup_error)
      }

    console.error(`Failed to move ${type} ${old_location}`, error)
    return false
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

  const firebase_app = initialize_firebase(init)
  app.value = firebase_app
  if (firebase_app) auth.value = init_auth(firebase_app)
  else console.error('Firebase app initialization failed')

  storage.value = get_storage(app.value)
  auth_changed(auth.value, async user => {
    if (user) {
      current_user.value = user
      localStorage.me = from_e64(current_user.value.phoneNumber)
      me.value.id = localStorage.me
      const maybe_me = await load_from_network(localStorage.me)
      if (maybe_me) {
        me.value = maybe_me
        const html = await get(localStorage.me)
        if (html) localStorage.setItem(localStorage.me, html)
      }
    } else current_user.value = null
  })
}
