/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Item} Item */
/** @typedef {import('@/types').Type} Type */
/** @typedef {import('@/types').Person} Person */

import { as_created_at } from '@/utils/itemid'

/**
 * @param {{id: Id} | Array<{id: Id}>} thing
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
  (as_created_at(second) ?? 0) - (as_created_at(first) ?? 0)

/**
 * @param {Item} first
 * @param {Item} second
 * @returns {number}
 */
export const recent_item_first = (first, second) =>
  (as_created_at(second.id) ?? 0) - (as_created_at(first.id) ?? 0)

/**
 * @param {Person} first
 * @param {Person} second
 * @returns {number}
 */
export const recent_visit_first = (first, second) => {
  const first_visit = first?.visited ? new Date(first.visited).getTime() : 0
  const second_visit = second?.visited ? new Date(second.visited).getTime() : 0
  return second_visit - first_visit
}

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
  const first_number = parseInt(String(first))
  const second_number = parseInt(String(second))

  return second_number - first_number
}

/**
 * @param {Item | Item[]} first
 * @param {Item | Item[]} second
 * @returns {number}
 */
export const earlier_weirdo_first = (first, second) =>
  recent_id_first(get_id(second), get_id(first))

/**
 * @param {Item | Item[]} first
 * @param {Item | Item[]} second
 * @returns {number}
 */
export const recent_weirdo_first = (first, second) =>
  recent_id_first(get_id(first), get_id(second))

const same_day_type_order = item => {
  if (Array.isArray(item)) return 0
  if (item?.type === 'posters') return 1
  return 2
}

/**
 * Same-day sort: statements first, then posters. Today = newest first within type.
 * @param {Item | Item[]} first
 * @param {Item | Item[]} second
 * @returns {number}
 */
export const same_day_today = (first, second) => {
  const by_type = same_day_type_order(first) - same_day_type_order(second)
  if (by_type !== 0) return by_type
  return recent_weirdo_first(first, second)
}

/**
 * Same-day sort: statements first, then posters. Past days = chronological within type.
 * @param {Item | Item[]} first
 * @param {Item | Item[]} second
 * @returns {number}
 */
export const same_day_past = (first, second) => {
  const by_type = same_day_type_order(first) - same_day_type_order(second)
  if (by_type !== 0) return by_type
  return earlier_weirdo_first(first, second)
}

/**
 * @param {number} time_1
 * @param {number} time_2
 * @returns {number}
 */
export const newest_timestamp_first = (time_1, time_2) => time_2 - time_1
