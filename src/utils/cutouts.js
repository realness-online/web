/** @typedef {import('@/types').Id} Id */

import { as_path_parts, as_created_at } from '@/utils/itemid'

// Progress bucket thresholds
const PROGRESS_BUCKETS = {
  BASE_MAX: 50,
  BUCKET_50_MAX: 60,
  BUCKET_60_MAX: 70,
  BUCKET_70_MAX: 80,
  BUCKET_80_MAX: 90
}

/**
 * Get the base path for a poster's cutouts folder
 * @param {Id} poster_id
 * @returns {string}
 */
export const get_cutouts_path = poster_id => {
  const [author, _type] = as_path_parts(poster_id)
  const created_at = as_created_at(poster_id)
  return `people/${author}/posters/${created_at}/cutouts`
}

/**
 * Check if poster element has cutouts
 * @param {Element} poster_element
 * @returns {boolean}
 */
export const has_cutouts = poster_element => {
  const cutout_elements = poster_element.querySelectorAll('[itemprop="cutout"]')
  return cutout_elements && cutout_elements.length > 0
}

/**
 * Get cutout count from poster element
 * @param {Element} poster_element
 * @returns {number}
 */
export const get_cutout_count = poster_element => {
  const cutout_elements = poster_element.querySelectorAll('[itemprop="cutout"]')
  return cutout_elements ? cutout_elements.length : 0
}

/**
 * Split cutouts into progress buckets based on data-progress attribute
 * @param {Object[]} cutout_objects - Array of parsed cutout objects
 * @returns {Object} Buckets object with keys: base, 50, 60, 70, 80, 90
 */
export const split_cutouts_by_progress = cutout_objects => {
  const buckets = { base: [], 50: [], 60: [], 70: [], 80: [], 90: [] }

  cutout_objects.forEach(cutout => {
    const progress = parseInt(cutout['data-progress'] || 0)
    if (progress < PROGRESS_BUCKETS.BASE_MAX) buckets.base.push(cutout)
    else if (progress < PROGRESS_BUCKETS.BUCKET_50_MAX) buckets[50].push(cutout)
    else if (progress < PROGRESS_BUCKETS.BUCKET_60_MAX) buckets[60].push(cutout)
    else if (progress < PROGRESS_BUCKETS.BUCKET_70_MAX) buckets[70].push(cutout)
    else if (progress < PROGRESS_BUCKETS.BUCKET_80_MAX) buckets[80].push(cutout)
    else buckets[90].push(cutout)
  })

  return buckets
}

/**
 * Get cutout file path for a specific progress bucket
 * @param {string} base_path - Base poster path (e.g., "people/+phone/posters/1737178477999.html.gz")
 * @param {number} progress_bucket - Progress bucket (50, 60, 70, 80, or 90)
 * @returns {string}
 */
export const get_cutout_file_path = (base_path, progress_bucket) =>
  base_path.replace('.html.gz', `-${progress_bucket}.html.gz`)
