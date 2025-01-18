/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Item} Item */
/** @typedef {import('@/types').Type} Type */
/** @typedef {import('@/types').Person} Person */

import { as_created_at } from '@/utils/itemid'

/**
 * @param {any} thing
 * @returns {Id}
 */
export const get_id = thing => {
  if (Array.isArray(thing)) return thing[0].id
  return thing.id
}

/**
 * @param {Id|null} first
 * @param {Id|null} second
 * @returns {number}
 */
export const recent_id_first = (first, second) =>
  as_created_at(second) - as_created_at(first)

/**
 * @param {Item} first
 * @param {Item} second
 * @returns {number}
 */
export const recent_item_first = (first, second) =>
  as_created_at(second.id) - as_created_at(first.id)

/**
 * @param {Person} first
 * @param {Person} second
 * @returns {number}
 */
export const recent_visit_first = (first, second) =>
  new Date(second?.visited).getTime() - new Date(first?.visited).getTime()

/**
 * @param {Array<string>} first
 * @param {Array<string>} second
 * @returns {number}
 */
export const recent_date_first = (first, second) =>
  new Date(second[0]).getTime() - new Date(first[0]).getTime() // newer is larger

/**
 * @param {number} first
 * @param {number} second
 * @returns {number}
 */
export const recent_number_first = (first, second) => {
  console.log('recent_number_first', first, second)
  const first_number = parseInt(String(first))
  const second_number = parseInt(String(second))

  return second_number - first_number
}

/**
 * @param {Item} first
 * @param {Item} second
 * @returns {number}
 */
export const earlier_weirdo_first = (first, second) =>
  recent_id_first(get_id(second), get_id(first))

/**
 * @param {Item} first
 * @param {Item} second
 * @returns {number}
 */
export const recent_weirdo_first = (first, second) =>
  recent_id_first(get_id(first), get_id(second))

/**
 * @param {number} time_1
 * @param {number} time_2
 * @returns {number}
 */
export const newest_timestamp_first = (time_1, time_2) => time_2 - time_1
