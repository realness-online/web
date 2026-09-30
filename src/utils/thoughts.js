// The rulebook moved to `packages/thoughts` (`@realness.online/thoughts`), so
// the web app and the share page build a thought the same way. This shim keeps
// every existing `@/utils/thoughts` import working, annotated with the app's
// own types - the package speaks plain strings.
/** @typedef {import('@/types').Item} Item */
/** @typedef {import('@/types').Thought} Thought */

import {
  THOUGHT_WINDOW_MS,
  thoughts_for_author as rulebook_thoughts_for_author,
  thought_feed_slots as rulebook_thought_feed_slots,
  thought_for_poster as rulebook_thought_for_poster,
  thought_text as rulebook_thought_text
} from '@realness.online/thoughts'

export { THOUGHT_WINDOW_MS }

/** @type {(items: Item[]) => Thought[]} */
export const thoughts_for_author = /** @type {any} */ (
  rulebook_thoughts_for_author
)

/** @type {(thought: Thought) => Array<Item[] | Item>} */
export const thought_feed_slots = /** @type {any} */ (
  rulebook_thought_feed_slots
)

/** @type {(items: Item[], poster_id: string) => Thought | null} */
export const thought_for_poster = /** @type {any} */ (
  rulebook_thought_for_poster
)

/** @type {(thought: Thought | null) => string} */
export const thought_text = /** @type {any} */ (rulebook_thought_text)
