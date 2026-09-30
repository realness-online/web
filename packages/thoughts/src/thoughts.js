/**
 * @fileoverview Which rows of one author make one thought. A thought is a run
 * of rows - posters and statements - where every step is at most thirteen
 * minutes after the one before it. The web app draws the thought over its
 * poster and the share page prints the same words, so the rule lives here once.
 */

import { as_author, as_created_at, as_type } from '@realness.online/itemid'

const MS_PER_SECOND = 1000

/** How long a gap still belongs to the same thought. */
export const THOUGHT_WINDOW_MS = 13 * 60 * MS_PER_SECOND

/** @typedef {{ id: string, type?: string, statement?: string }} Item */
/** @typedef {{ author_id: string, started_at: number, posters: Item[], statements: Item[] }} Thought */

/**
 * Same author only. Chains posters and text rows (`type` `thoughts`) while each
 * step is at most thirteen minutes after the previous item (by id timestamp).
 *
 * @param {Item[]} items
 * @returns {Thought[]}
 */
export const thoughts_for_author = items => {
  const rows = items.filter(item => {
    if (!item || typeof item !== 'object' || !item.id) return false
    const type = as_type(item.id)
    return type === 'posters' || type === 'thoughts'
  })
  rows.sort((a, b) => (as_created_at(a.id) ?? 0) - (as_created_at(b.id) ?? 0))

  /** @type {Thought[]} */
  const out = []
  /** @type {(Thought & { last_t: number }) | null} */
  let current = null

  for (const item of rows) {
    const at = as_created_at(item.id)
    // oxlint-disable-next-line eqeqeq -- nullish check
    if (at == null) continue
    const author = as_author(item.id)
    if (!author) continue

    if (!current) {
      current = {
        author_id: author,
        started_at: at,
        posters: [],
        statements: [],
        last_t: at
      }
      push_row(current, item)
      continue
    }

    const gap = at - current.last_t
    if (gap <= THOUGHT_WINDOW_MS) {
      push_row(current, item)
      current.last_t = at
    } else {
      out.push(finish(current))
      current = {
        author_id: author,
        started_at: at,
        posters: [],
        statements: [],
        last_t: at
      }
      push_row(current, item)
    }
  }
  if (current) out.push(finish(current))
  return out
}

/**
 * @param {Thought} current
 * @param {Item} item
 */
const push_row = (current, item) => {
  const type = as_type(item.id)
  if (type === 'posters') current.posters.push(item)
  else if (type === 'thoughts') current.statements.push(item)
}

/**
 * @param {Thought & { last_t?: number }} current
 * @returns {Thought}
 */
const finish = current => ({
  author_id: current.author_id,
  started_at: current.started_at,
  posters: current.posters,
  statements: current.statements
})

/**
 * Feed slots for one thought: chronological, text runs as arrays of
 * statements, posters as items.
 *
 * @param {Thought} thought
 * @returns {Array<Item[] | Item>}
 */
export const thought_feed_slots = thought => {
  /** @type {Array<{ at: number, poster?: Item, statement?: Item }>} */
  const timed = []
  for (const poster of thought.posters) {
    const at = as_created_at(poster.id)
    if (at !== null && at !== undefined) timed.push({ at, poster })
  }
  for (const statement of thought.statements) {
    const at = as_created_at(statement.id)
    if (at !== null && at !== undefined) timed.push({ at, statement })
  }
  timed.sort((a, b) => a.at - b.at)

  /** @type {Array<Item[] | Item>} */
  const slots = []
  /** @type {Item[]} */
  let run = []
  const flush = () => {
    if (run.length) {
      slots.push(run)
      run = []
    }
  }
  for (const entry of timed)
    if (entry.poster) {
      flush()
      slots.push(entry.poster)
    } else if (entry.statement) run.push(entry.statement)
  flush()
  return slots
}

/**
 * The thought one poster was made with, or null when the poster sits alone.
 *
 * @param {Item[]} items - the poster and the statements to judge it against
 * @param {string} poster_id
 * @returns {Thought | null}
 */
export const thought_for_poster = (items, poster_id) =>
  thoughts_for_author(items).find(thought =>
    thought.posters.some(poster => poster.id === poster_id)
  ) ?? null

/**
 * The words of a thought, in order. Posters carry no text, so a thought of
 * only posters reads as an empty string.
 *
 * @param {Thought | null} thought
 * @returns {string}
 */
export const thought_text = thought =>
  (thought?.statements ?? [])
    .map(statement => statement.statement?.trim())
    .filter(Boolean)
    .join(' ')
