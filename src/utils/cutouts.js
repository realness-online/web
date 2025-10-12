/** @typedef {import('@/types').Id} Id */

import { as_path_parts, as_created_at } from '@/utils/itemid'

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
