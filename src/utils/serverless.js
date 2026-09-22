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
import { default_person } from '@/utils/person-identity'

/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Item} Item */

export const me = ref(
  /** @type {import('@/types').MeItem | undefined} */ (undefined)
)
const app = ref(
  /** @type {import('firebase/app').FirebaseApp | undefined} */ (undefined)
)
export const auth = ref(
  /** @type {import('firebase/auth').Auth | undefined} */ (undefined)
)
const storage = ref(
  /** @type {import('firebase/storage').FirebaseStorage | undefined} */ (
    undefined
  )
)
/** @type {(value?: void) => void} */
let resolve_storage_ready = () => {}
/** Resolves once `init_serverless` has set storage (or finished without it). */
export const storage_ready = new Promise(resolve => {
  resolve_storage_ready = resolve
})
export const current_user = ref(
  /** @type {import('firebase/auth').User | null | undefined} */ (undefined)
)

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

export const init_serverless = async () => {
  me.value = /** @type {Item} */ (/** @type {unknown} */ (default_person))
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
    if (!firebase_app) console.error('Firebase app initialization failed')

    if (app.value) storage.value = get_storage(app.value)

    const { init_auth } = await import('@/utils/serverless-auth')
    return init_auth(firebase_app)
  } finally {
    resolve_storage_ready()
  }
}
