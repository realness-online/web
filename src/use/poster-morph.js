/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Poster} Poster */

import { get, set } from 'idb-keyval'
import { load_shadow_into_vector } from '@/utils/poster-layers'
import { DEFAULT_CONTOURS, DEFAULT_PRECISION } from '@/utils/path-morph'

/** The density layers a morph moves between, thinnest first */
export const shadow_layers = ['light', 'regular', 'medium', 'bold']

/**
 * Bump when the normalizer changes shape, so cached results from an older
 * pass are ignored rather than mixed with new ones. Version 2 dropped the low
 * contour cap that was discarding a layer's smaller marks. Version 3 discards
 * entries poisoned by a reply-routing race that could cache one poster's
 * geometry under another poster's key.
 */
const VERSION = 3

/**
 * Segments are left out on purpose - the normalizer derives them from how many
 * shapes the poster actually carries.
 */
const settings = {
  contours: DEFAULT_CONTOURS,
  precision: DEFAULT_PRECISION
}

/** @type {Worker | null} */
let worker = null
/** @type {Map<string, Promise<string[] | null>>} */
const in_flight = new Map()
/** Numbers each request so a shared worker's replies find their caller */
let request_id = 0

/** @param {Id} poster_id */
const as_morph_key = poster_id =>
  `${poster_id}/morph/${VERSION}-${settings.contours}`

/**
 * One worker for the whole app. Several posters can be normalizing at once,
 * so every request carries an id and replies are matched back by it.
 * @returns {Worker}
 */
const morph_worker = () => {
  if (!worker) worker = new Worker('/vector.worker.js')
  return worker
}

/**
 * Poster layers arrive as path elements once hydrated, and as empty strings
 * on the placeholder a directory listing builds.
 * @param {unknown} layer
 * @returns {string}
 */
export const as_path_data = layer => {
  if (!layer) return ''
  if (typeof layer === 'string') return layer
  if (layer instanceof Element) return layer.getAttribute('d') || ''
  return ''
}

/**
 * @param {Poster} vector
 * @returns {string[]}
 */
export const as_layer_paths = vector =>
  shadow_layers.map(layer => as_path_data(vector?.[layer]))

/**
 * @param {string[]} paths
 * @returns {Promise<string[]>}
 */
const normalize_in_worker = paths =>
  new Promise((resolve, reject) => {
    const w = morph_worker()
    request_id += 1
    const id = request_id
    /** @param {MessageEvent} event */
    const on_message = event => {
      // Every pending request hears every reply on the shared worker - only
      // the one this call posted is ours
      if (event.data?.id !== id) return
      w.removeEventListener('message', on_message)
      w.removeEventListener('error', on_error)
      if (event.data?.error) reject(new Error(event.data.error))
      else resolve(event.data.paths)
    }
    const on_error = error => {
      w.removeEventListener('message', on_message)
      w.removeEventListener('error', on_error)
      reject(error)
    }
    w.addEventListener('message', on_message)
    w.addEventListener('error', on_error)
    w.postMessage({ route: 'normalize:morph', id, paths, ...settings })
  })

/**
 * @param {string} key
 * @param {Id} poster_id
 * @param {Poster} [vector]
 * @returns {Promise<string[] | null>}
 */
const resolve_morph = async (key, poster_id, vector) => {
  const cached = await get(key)
  if (cached) return cached

  // Split posters keep their densities in a separate shadows file, and the
  // oldest ones inline them. `load_shadow_into_vector` knows all three shapes.
  // Copied first so the caller's reactive vector is left alone.
  const shadows = await load_shadow_into_vector(
    /** @type {Poster} */ ({ ...vector, id: poster_id }),
    poster_id
  )
  const paths = as_layer_paths(shadows)
  if (paths.every(d => !d)) return null

  const normalized = await normalize_in_worker(paths)
  await set(key, normalized)
  return normalized
}

/**
 * Morph-ready versions of a poster's four density layers, in
 * `shadow_layers` order.
 *
 * Nothing is stored on the poster itself - the normalized geometry is derived
 * and cached, so the whole archive works without a migration and a change to
 * the normalizer just invalidates a key.
 *
 * @param {Id} poster_id
 * @param {Poster} [vector] The poster record, which on a split poster carries
 *   no shadow paths of its own
 * @returns {Promise<string[] | null>} null when there is nothing to morph
 */
export const morph_paths = (poster_id, vector) => {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (!poster_id) return Promise.resolve(null)

  const key = as_morph_key(poster_id)

  // Claimed before the first await, so a poster asked for twice in the same
  // tick shares one run rather than starting two
  const running = in_flight.get(key)
  if (running) return running

  const run = resolve_morph(key, poster_id, vector)
    .catch(error => {
      console.warn('[poster-morph] normalize failed', error)
      return null
    })
    .finally(() => in_flight.delete(key))

  in_flight.set(key, run)
  return run
}

/** Tests and teardown; the app keeps one worker for its lifetime. */
export const release_morph_worker = () => {
  if (!worker) return
  worker.terminate()
  worker = null
  in_flight.clear()
}
