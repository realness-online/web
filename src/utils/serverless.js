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
import {
  load_from_network,
  load,
  as_poster_id,
  as_archive
} from '@/utils/itemid'
import { from_e64, default_person } from '@/use/people'

import { get, set } from 'idb-keyval'
import { prepare_upload_html } from '@/utils/upload-processor'
import { as_filename } from '@/utils/itemid'
/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Item} Item */

export const me = ref(
  /** @type {import('@/types').MeItem | undefined} */ (undefined)
)
export const app = ref(
  /** @type {import('firebase/app').FirebaseApp | undefined} */ (undefined)
)
export const auth = ref(
  /** @type {import('firebase/auth').Auth | undefined} */ (undefined)
)
export const storage = ref(
  /** @type {import('firebase/storage').FirebaseStorage | undefined} */ (
    undefined
  )
)
export const current_user = ref(
  /** @type {import('firebase/auth').User | null | undefined} */ (undefined)
)

export const Recaptcha = RecaptchaVerifier
export const sign_in = signInWithPhoneNumber
export const sign_off = () => {
  if (auth.value) sign_out(auth.value)
}

// storage methods
/**
 * @param {string} path
 */
export const location = path => {
  if (!storage.value) throw new Error('Storage not initialized')
  return reference(storage.value, path)
}
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
    if (
      e &&
      typeof e === 'object' &&
      'code' in e &&
      /** @type {{code?: string}} */ (e).code === 'storage/object-not-found'
    )
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

  let old_location, new_location, old_storage_path, new_storage_path
  if (is_component) {
    const component_itemid = /** @type {Id} */ (`${author}/${type}/${id}`)
    old_location = component_itemid
    new_location = component_itemid

    const poster_id = as_poster_id(component_itemid)
    if (!poster_id) return false

    const existing_archive = await as_archive(poster_id)
    const poster_filename = poster_id.startsWith('/+')
      ? `people${poster_id}`
      : poster_id

    if (existing_archive)
      old_storage_path = `${existing_archive}-${type}.html.gz`
    else old_storage_path = `${poster_filename}-${type}.html.gz`

    const archived_poster_id = /** @type {Id} */ (
      `${author}/posters/${archive_id}/${id}`
    )
    const archived_poster_filename = archived_poster_id.startsWith('/+')
      ? `people${archived_poster_id}`
      : archived_poster_id
    new_storage_path = `${archived_poster_filename}-${type}.html.gz`
  } else {
    old_location = /** @type {Id} */ (`${author}/${type}/${id}`)
    new_location = /** @type {Id} */ (`${author}/${type}/${archive_id}/${id}`)
    old_storage_path = await as_filename(old_location)
    new_storage_path = await as_filename(new_location)
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
    await upload(new_storage_path, compressed, metadata)
    upload_successful = true

    await remove(old_storage_path)
    return true
  } catch (error) {
    if (upload_successful)
      try {
        await remove(new_storage_path)
        await set(old_location, html)
      } catch (cleanup_error) {
        console.error(
          `Failed to cleanup ${new_storage_path}`,
          cleanup_error instanceof Error
            ? cleanup_error.message
            : String(cleanup_error)
        )
      }

    console.error(
      `Failed to move ${type} ${old_storage_path}`,
      error instanceof Error ? error.message : String(error)
    )
    return false
  }
}

export const init_serverless = () => {
  me.value = /** @type {Item} */ (/** @type {unknown} */ (default_person))
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

  if (app.value) storage.value = get_storage(app.value)

  return new Promise(resolve => {
    let resolved = false
    if (!auth.value) {
      resolve(undefined)
      return
    }
    auth_changed(auth.value, async user => {
      if (user) {
        current_user.value = user
        const phone = user.phoneNumber
        if (phone) localStorage.me = from_e64(phone)
        if (me.value) me.value.id = localStorage.me
        const maybe_me = await load_from_network(localStorage.me)
        if (maybe_me) {
          // Intentional: replace me with network result
          // eslint-disable-next-line require-atomic-updates
          me.value = maybe_me
          const html = await get(localStorage.me)
          if (html) localStorage.setItem(localStorage.me, html)
        }
      } else
        current_user.value =
          /** @type {import('firebase/auth').User | null} */ (null)
      if (!resolved) {
        resolved = true
        resolve(undefined)
      }
    })
  })
}
