/** @typedef {import('@/types').Item} Item */
/** @typedef {import('@/types').Thought} Thought */

import {
  thoughts_for_author as rulebook_thoughts_for_author,
  thought_feed_slots as rulebook_thought_feed_slots
} from '@realness.online/thoughts'

/** @type {(items: Item[]) => Thought[]} */
export const thoughts_for_author = /** @type {any} */ (
  rulebook_thoughts_for_author
)

/** @type {(thought: Thought) => Array<Item[] | Item>} */
export const thought_feed_slots = /** @type {any} */ (
  rulebook_thought_feed_slots
)
