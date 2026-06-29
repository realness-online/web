/** @typedef {import('@/types').Id} Id */
import { as_query_id } from '@/utils/itemid'

/**
 * Dispatched on `document` so the canonical `as-svg` can toggle meet/slice when a
 * duplicate row (e.g. `<use>` reference) activates, without that row emitting into the hero figure.
 */
export const POSTER_MEET_TOGGLE_ONLY = 'poster-toggle-meet-only'

/**
 * Fragment id (no `#`) for the poster root SVG (`as-svg` sets `:id="query()"`).
 * @param {Id} itemid
 * @returns {string}
 */
export const poster_dom_id = itemid => as_query_id(itemid)

/**
 * @param {Id} itemid
 * @returns {string}
 */
export const poster_dom_href = itemid => `#${poster_dom_id(itemid)}`
