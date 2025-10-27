/** @typedef {import('@/types').Id} Id */

// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { Local } from '@/persistance/Local'
import { Large } from '@/persistance/Large'
import { Cloud } from '@/persistance/Cloud'
import { Paged } from '@/persistance/Paged'
import { current_user, upload } from '@/utils/serverless'
import {
  as_type,
  as_filename,
  as_created_at,
  as_query_id,
  is_itemid
} from '@/utils/itemid'
import { get, set, del } from 'idb-keyval'
import { prepare_upload_html, decompress_html } from '@/utils/upload-processor'
import {
  split_cutouts_by_progress,
  get_cutout_file_path
} from '@/utils/cutouts'
import { get_item } from '@/utils/item'
import { url } from '@/utils/serverless'
import { as_directory_id, as_directory } from '@/persistance/Directory'
import { sync_later } from '@/persistance/Cloud'

/**
 * Extract cutout data from a DOM element
 * @param {Element} element - SVG path element
 * @returns {Object} Cutout object with attributes
 */
const cutout_element_to_object = element => ({
  d: element.getAttribute('d'),
  fill: element.getAttribute('fill'),
  'fill-opacity': element.getAttribute('fill-opacity') || '0.5',
  transform: element.getAttribute('transform'),
  'data-progress': parseInt(element.getAttribute('data-progress') || '0')
})

/**
 * Convert a cutout object to a DOM path element
 * @param {Object} cutout_obj - Parsed cutout object with d, fill, etc. properties
 * @returns {Element} SVG path element
 */
const cutout_object_to_dom = cutout_obj => {
  const path_element = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'path'
  )

  // Set all attributes from the cutout object
  Object.entries(cutout_obj).forEach(([key, value]) => {
    if (value !== undefined && value !== null)
      if (key.startsWith('data-'))
        path_element.dataset[key.replace('data-', '')] = value
      else path_element.setAttribute(key, value)
  })

  // Ensure itemprop is set
  path_element.setAttribute('itemprop', 'cutout')

  return path_element
}

/**
 * @interface
 */
export class Storage {
  /**
   * @type {Object}
   */
  metadata = { contentType: 'text/html' }

  /**
   * @param {Id} itemid
   */
  constructor(itemid) {
    this.id = itemid
    this.type = as_type(itemid)
  }

  save(_items) {}
  delete() {}
  sync() {}
  optimize() {}
}

/**
 * @extends {Storage}
 */
export class Poster extends Large(Cloud(Storage)) {
  /**
   * Override save to split cutouts into separate files
   * @param {Element} items
   */
  async save(items = document.querySelector(`[itemid="${this.id}"]`)) {
    console.info('request:save:poster', this.id, items)
    if (!items || !items.outerHTML) return

    // Parse the poster using microdata system to get cutout objects
    const poster_data = get_item(/** @type {any} */ (items.outerHTML), this.id)

    if (poster_data && poster_data.cutout && poster_data.cutout.length > 0) {
      console.info('[Poster.save] Found cutouts:', poster_data.cutout.length)

      // Convert DOM elements to objects
      const cutout_objects = poster_data.cutout.map(element =>
        typeof element.getAttribute === 'function'
          ? cutout_element_to_object(element)
          : element
      )

      const buckets = split_cutouts_by_progress(cutout_objects)
      console.info('[Poster.save] Split into buckets:', {
        base: buckets.base.length,
        50: buckets[50]?.length || 0,
        60: buckets[60]?.length || 0,
        70: buckets[70]?.length || 0,
        80: buckets[80]?.length || 0,
        90: buckets[90]?.length || 0
      })

      // Create base poster with only 0-49% cutouts
      const base_poster = /** @type {Element} */ (items.cloneNode(true))
      const all_cutouts_in_base = base_poster.querySelectorAll(
        '[itemprop="cutout"]'
      )

      all_cutouts_in_base.forEach(cutout => cutout.remove())

      const svg = base_poster.querySelector('svg')
      if (svg && buckets.base.length > 0)
        buckets.base.forEach(cutout_obj => {
          const path_element = cutout_object_to_dom(cutout_obj)
          svg.appendChild(path_element)
        })

      await set(this.id, base_poster.outerHTML)

      const progress_buckets = [50, 60, 70, 80, 90]
      for (const bucket of progress_buckets) {
        const cutouts = buckets[bucket]
        if (cutouts.length === 0) continue

        // Create SVG wrapper for cutouts
        const cutout_svg = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'svg'
        )
        cutouts.forEach(cutout_obj => {
          const path_element = cutout_object_to_dom(cutout_obj)
          cutout_svg.appendChild(path_element)
        })

        // Save cutout to IndexedDB with composite key
        const cutout_key = `${this.id}:cutout:${bucket}`
        await set(cutout_key, cutout_svg.outerHTML)
      }

      // Delete directory cache
      const path = as_directory_id(this.id)
      await del(path)

      // THEN upload to network if online (follows local-first principle)
      if (navigator.onLine && current_user.value) {
        const base_path = await /** @type {any} */ (this).get_storage_path()

        // Upload base poster
        const { compressed, metadata } = await prepare_upload_html(
          base_poster.outerHTML
        )
        await upload(base_path, compressed, metadata)

        // Upload cutout files
        for (const bucket of progress_buckets) {
          const cutout_key = `${this.id}:cutout:${bucket}`
          const cutout_html = await get(cutout_key)
          if (!cutout_html) continue

          const cutout_path = get_cutout_file_path(base_path, bucket)
          const cutout_compressed = await prepare_upload_html(cutout_html)
          await upload(
            cutout_path,
            cutout_compressed.compressed,
            cutout_compressed.metadata
          )
        }

        // Clear directory cache after network upload
        const directory = await as_directory(this.id)
        await del(directory.id)
      } else if (current_user.value || localStorage.me)
        // Queue for later if offline
        await sync_later(this.id, 'save')
    } else
      // No cutouts, just save normally through the chain
      await super.save(items)
  }

  /**
   * Load additional cutout files for a poster
   * LOCAL FIRST: Tries IndexedDB first, then network if needed
   * @param {number[]} buckets - Which buckets to load (e.g., [50, 60, 70, 80, 90])
   * @returns {Promise<Object>} Map of bucket number to array of cutout path elements
   */
  async load_cutouts(buckets = [50, 60, 70, 80, 90]) {
    const loaded_cutouts = {}

    for (const bucket of buckets)
      try {
        // LOCAL FIRST: Try IndexedDB first
        const cutout_key = `${this.id}:cutout:${bucket}`
        let html = await get(cutout_key)

        // If not in IndexedDB and online, try network
        if (!html && navigator.onLine && current_user.value) {
          const base_path = await /** @type {any} */ (this).get_storage_path()
          const cutout_path = get_cutout_file_path(base_path, bucket)
          const download_url = await url(cutout_path)

          if (download_url) {
            const response = await fetch(download_url)
            const content_encoding = response.headers.get('Content-Encoding')
            const compressed_html = await response.arrayBuffer()

            // If no content encoding or 'identity', data is already decompressed
            if (!content_encoding || content_encoding === 'identity')
              html = new TextDecoder().decode(compressed_html)
            else html = await decompress_html(compressed_html)

            // Save to IndexedDB for future use
            if (html) await set(cutout_key, html)
          }
        }

        if (html) {
          // Parse using microdata system to extract cutout data
          const temp_container = document.createElement('div')
          temp_container.innerHTML = html
          const svg_element = temp_container.querySelector('svg')

          if (svg_element) {
            // Use get_item methodology to parse cutouts
            const cutout_paths = svg_element.querySelectorAll(
              'path[itemprop="cutout"]'
            )

            const parsed_cutouts = Array.from(cutout_paths).map(
              cutout_element_to_object
            )

            loaded_cutouts[bucket] = parsed_cutouts
          }
        }
      } catch (error) {
        // Bucket file might not exist (empty bucket), that's okay
        if (error.code !== 'storage/object-not-found')
          console.warn(`Failed to load cutouts for bucket ${bucket}:`, error)
      }

    return loaded_cutouts
  }
}

/**
 * @extends {Storage}
 */
export class Me extends Cloud(Local(Storage)) {
  constructor() {
    super(localStorage.me)
  }
}

/** @extends {Storage} */
export class Relation extends Local(Storage) {
  constructor() {
    super(/** @type {Id} */ (`${localStorage.me}/relations`))
  }
}

/** @extends {Storage} */
export class Statement extends Paged(Cloud(Local(Storage))) {
  constructor() {
    super(/** @type {Id} */ (`${localStorage.me}/statements`))
  }
}

/** @extends {Storage} */
export class Event extends Paged(Cloud(Local(Storage))) {
  constructor() {
    super(/** @type {Id} */ (`${localStorage.me}/events`))
  }
}

/** @extends {Storage} */
export class Offline extends Cloud(Storage) {
  async save() {
    const outer_html = await get(this.id)
    if (!outer_html) return

    let { id } = this
    if (id.startsWith('/+/'))
      id = /** @type {Id} */ (
        `${localStorage.me}/${as_type(id)}/${as_created_at(id)}`
      )
    if (!is_itemid(id)) {
      console.error('invalid itemid', id)
      return
    }

    const temp_container = document.createElement('div')
    temp_container.innerHTML = outer_html

    const content = temp_container.firstElementChild
    if (content) {
      content.setAttribute('itemid', id)
      content.id = as_query_id(id)
    }

    this.id = id
    await super.save({ outerHTML: temp_container.innerHTML })
  }
}

/** @extends {Storage} */
export class History extends Cloud(Storage) {
  /**
   * @param {Id} itemid
   */
  constructor(itemid) {
    super(itemid)
    this.id = itemid
  }

  /** @param {Element | {outerHTML: string}} items */
  async save(items) {
    // on purpose doesn't call super.save
    if (!items) return false
    if (current_user.value && navigator.onLine) {
      const { compressed, metadata } = await prepare_upload_html(items)
      try {
        await upload(await as_filename(this.id), compressed, metadata)
      } catch (e) {
        console.error(e)
        return false
      }
      return true
    }
    return false
  }
}
