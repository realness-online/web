/**
 * @fileoverview Which statement rows sit on which poster. A day of the feed
 * holds statement slots (runs of statements) and posters; a poster takes the
 * slots within one thought window of it, plus everything chained to those.
 */

import { as_author, as_created_at, as_type } from '@realness.online/itemid'
import { THOUGHT_WINDOW_MS } from './thoughts.js'

/** @typedef {{ id: string, type?: string, statement?: string }} Item */
/** @typedef {Item[]} Statements */

/** @param {Statements | Item} entry @returns {entry is Statements} */
const is_slot = entry => Array.isArray(entry)

/** @param {Statements | Item} entry @returns {entry is Item} */
const is_row = entry => !Array.isArray(entry)

/**
 * Canonical id for a feed slot: one poster, or the first row of a statement
 * train.
 *
 * @param {Item | Statements} slot
 * @returns {string}
 */
export const slot_key = slot =>
  Array.isArray(slot) ? (slot[0]?.id ?? '') : slot.id

/**
 * @param {Item[]} statements
 * @returns {Statements[]}
 */
export const as_thoughts = statements => {
  const rows = [...statements]
  rows.sort(recent_item_first)
  /** @type {Statements[]} */
  const thoughts = []
  while (rows.length) {
    const row = rows.pop()
    if (!row) break
    const thought = [row]
    while (is_train_of_thought(thought, rows)) {
      const next = rows.pop()
      if (next) thought.push(next)
    }
    thoughts.push(thought)
  }
  return thoughts
}

/**
 * @param {Statements} first
 * @param {Statements} second
 */
export const thoughts_sort = (first, second) => {
  const [a] = first
  const [b] = second
  return (as_created_at(a?.id) ?? 0) - (as_created_at(b?.id) ?? 0)
}

/**
 * @param {Item} first
 * @param {Item} second
 * @returns {number}
 */
const recent_item_first = (first, second) =>
  (as_created_at(second.id) ?? 0) - (as_created_at(first.id) ?? 0)

/**
 * @param {Statements} thought
 * @param {Item[]} statements
 */
const is_train_of_thought = (thought, statements) => {
  const next = statements[statements.length - 1]
  const nearest = thought[thought.length - 1]
  if (next && nearest) {
    const nearest_at = as_created_at(nearest.id) ?? 0
    const next_at = as_created_at(next.id) ?? 0
    return next_at - nearest_at <= THOUGHT_WINDOW_MS
  }
  return false
}

/**
 * Statement slots in `pool` that share a thought with this poster (touch the
 * poster or chain to a slot that does).
 *
 * @param {Item} poster
 * @param {Statements[]} pool
 * @returns {Statements[]}
 */
const connected_statement_slots = (poster, pool) => {
  const poster_at = as_created_at(poster.id)
  // oxlint-disable-next-line eqeqeq -- nullish check
  if (poster_at == null) return []

  /** @param {Statements} slot */
  const slot_touches_poster = slot => {
    for (const statement of slot) {
      const at = as_created_at(statement.id)
      // oxlint-disable-next-line eqeqeq -- nullish check
      if (at == null) continue
      if (Math.abs(poster_at - at) <= THOUGHT_WINDOW_MS) return true
    }
    return false
  }

  /** @param {Statements} a */
  /** @param {Statements} b */
  const slots_adjacent = (a, b) => {
    for (const first of a) {
      const first_at = as_created_at(first.id)
      // oxlint-disable-next-line eqeqeq -- nullish check
      if (first_at == null) continue
      for (const second of b) {
        const second_at = as_created_at(second.id)
        // oxlint-disable-next-line eqeqeq -- nullish check
        if (second_at == null) continue
        if (Math.abs(first_at - second_at) <= THOUGHT_WINDOW_MS) return true
      }
    }
    return false
  }

  /** @type {Set<Statements>} */
  const connected = new Set()
  /** @type {Statements[]} */
  const queue = []
  for (const thought of pool)
    if (slot_touches_poster(thought)) {
      connected.add(thought)
      queue.push(thought)
    }
  while (queue.length) {
    const current = /** @type {Statements} */ (queue.pop())
    for (const thought of pool) {
      if (connected.has(thought)) continue
      if (slots_adjacent(current, thought)) {
        connected.add(thought)
        queue.push(thought)
      }
    }
  }
  return [...connected]
}

/**
 * @param {Statements[]} slots
 * @returns {Statements}
 */
const merge_slots_chronological = slots => {
  /** @type {Item[]} */
  const all = []
  for (const slot of slots) all.push(...slot)
  all.sort((a, b) => (as_created_at(a.id) ?? 0) - (as_created_at(b.id) ?? 0))
  const seen = new Set()
  /** @type {Statements} */
  const merged = []
  for (const statement of all) {
    if (!statement?.id || seen.has(statement.id)) continue
    seen.add(statement.id)
    merged.push(statement)
  }
  return merged
}

/**
 * Pairs posters with statement-thoughts from the same author when any statement
 * timestamp is within the thought window of the poster.
 *
 * @param {Array<Statements | Item>} day_items
 * @returns {{ merged_thought_keys: Set<string>, poster_to_thought: Map<string, Statements> }}
 */
export const poster_thought_overlay_pairs = day_items => {
  const thoughts = day_items.filter(is_slot)
  const items = day_items.filter(is_row)
  const posters = items.filter(item => {
    if (!item || typeof item !== 'object' || !item.id) return false
    return item.type === 'posters' || as_type(item.id) === 'posters'
  })
  /** @type {Array<{ poster: Item, thought: Statements, distance: number }>} */
  const candidates = []
  for (const poster of posters) {
    const poster_at = as_created_at(poster.id)
    // oxlint-disable-next-line eqeqeq -- nullish check
    if (poster_at == null) continue
    for (const thought of thoughts) {
      if (as_author(poster.id) !== as_author(thought[0].id)) continue
      let closest = Infinity
      for (const statement of thought) {
        const at = as_created_at(statement.id)
        // oxlint-disable-next-line eqeqeq -- nullish check
        if (at == null) continue
        const distance = Math.abs(poster_at - at)
        if (distance < closest) closest = distance
      }
      if (closest <= THOUGHT_WINDOW_MS)
        candidates.push({ poster, thought, distance: closest })
    }
  }
  candidates.sort((a, b) => a.distance - b.distance)
  const merged_thought_keys = new Set()
  const poster_to_thought = new Map()
  const used_posters = new Set()
  for (const candidate of candidates) {
    if (used_posters.has(candidate.poster.id)) continue
    const component = connected_statement_slots(candidate.poster, thoughts)
    if (!component.length) continue
    const merged = merge_slots_chronological(component)
    if (!merged.length) continue
    for (const thought of component) merged_thought_keys.add(slot_key(thought))
    used_posters.add(candidate.poster.id)
    poster_to_thought.set(candidate.poster.id, merged)
  }
  return { merged_thought_keys, poster_to_thought }
}
