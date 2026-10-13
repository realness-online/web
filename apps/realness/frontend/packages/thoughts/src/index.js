export {
  THOUGHT_WINDOW_MS,
  thoughts_for_author,
  thought_feed_slots,
  thought_for_poster,
  thought_text
} from './thoughts.js'
export {
  as_thoughts,
  thoughts_sort,
  slot_key,
  poster_thought_overlay_pairs
} from './pairing.js'

/**
 * @typedef {{ id: string, type?: string, statement?: string }} Item
 * @typedef {Item[]} Statements
 * @typedef {{ author_id: string, started_at: number, posters: Item[], statements: Item[] }} Thought
 */
