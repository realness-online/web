/** @typedef {string} Author */
/** @typedef {number} Created */
/** @typedef {string} Id */
/** @typedef {import('./vocabulary.js').Type} Type */

import {
  types as realness_types,
  requires_timestamp as realness_requires_timestamp
} from './vocabulary.js'

/**
 * Splits an item ID path into its constituent parts
 * @param {Id} itemid - The full item path (e.g. '/+123456/thoughts/789')
 * @returns {string[]} Array of path parts where:
 *   [0] = author ID (e.g. '+123456')
 *   [1] = item type (e.g. 'thoughts', 'posters', etc.)
 *   [2] = created_at timestamp (if applicable)
 */
export const as_path_parts = itemid => {
  if (!itemid || typeof itemid !== 'string') return []
  const path = itemid.split('/')
  if (path[0].length === 0) path.shift()
  if (itemid.endsWith('/')) {
    const [author, type, created, archive] = path
    if (!created && !archive) return [author, type, 'index', '']
    if (created) return [author, type, '', created]
  }
  return path
}

/**
 * @param {Id} itemid
 * @returns {string | null}
 */
export const as_author = itemid => {
  const path = as_path_parts(itemid)
  const author = path[0] || ''
  if (author.startsWith('+')) return `/${path[0]}`
  return null
}

/**
 * @param {Id | null} itemid
 * @returns {Created | null}
 */
export const as_created_at = itemid => {
  if (!itemid) return null
  const path = as_path_parts(itemid)
  const path_length = path.length
  const PATH_WITH_TYPE = 3
  const PATH_WITH_TYPE_AND_CREATED = 4
  if (path_length === PATH_WITH_TYPE && path[2])
    return /** @type {Created} */ (parseInt(path[2]))
  if (path_length === PATH_WITH_TYPE_AND_CREATED && path[3])
    return /** @type {Created} */ (parseInt(path[3]))
  return null
}

/**
 * Builds the parse and validation functions for one vocabulary. The default
 * exports below are Realness's; an app with other types calls this once.
 * @param {{ types?: readonly string[], requires_timestamp?: readonly string[] }} [vocabulary]
 * @returns {{
 *   as_path_parts: typeof as_path_parts,
 *   as_author: typeof as_author,
 *   as_type: (itemid: Id | null | undefined) => Type | string | null,
 *   as_created_at: typeof as_created_at,
 *   is_itemid: (id: string) => boolean
 * }}
 */
export const create_itemid = ({
  types = realness_types,
  requires_timestamp = realness_requires_timestamp
} = {}) => {
  /**
   * @param {Id | null | undefined} itemid
   * @returns {Type | string | null}
   */
  const as_type = itemid => {
    if (!itemid || typeof itemid !== 'string') return null
    const path = as_path_parts(itemid)
    if (path[1] === 'statements') return 'thoughts'
    if (path[1] && types.includes(path[1])) return /** @type {Type} */ (path[1])
    if (itemid.startsWith('/+')) return 'person'
    return null
  }

  /**
   * Validates if a string matches the Id type pattern
   * @param {string} id
   * @returns {id is Id}
   */
  const is_itemid = id => {
    if (typeof id !== 'string') return false
    if (!id.startsWith('/')) return false

    const parts = as_path_parts(/** @type {Id} */ (id))
    if (parts.length < 2 || parts.length > 3) return false

    const [author, type, created] = parts

    if (!author.startsWith('+')) return false

    if (!types.includes(/** @type {Type} */ (type))) return false

    if (requires_timestamp.includes(type)) {
      if (!created) return false
      const created_num = Number(created)
      if (!Number.isInteger(created_num)) return false
    }

    return true
  }

  return { as_path_parts, as_author, as_type, as_created_at, is_itemid }
}

const realness = create_itemid()

export const { as_type, is_itemid } = realness
