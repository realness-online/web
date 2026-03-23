/** @typedef {import('@/types').Author} Author */
/** @typedef {import('@/types').Item} Item */
/** @typedef {import('@/types').Statement} Statement */
/** @typedef {import('@/types').Statements} Statements */
/** @typedef {import('@/types').Thought} Thought */

import { as_author, as_created_at } from '@/utils/itemid'
import { JS_TIME } from '@/utils/numbers'

/**
 * Same author only. Chains posters and text rows (`type` `thoughts`) while each
 * step is at most thirteen minutes after the previous item (by id timestamp).
 *
 * @param {Item[]} items
 * @returns {Thought[]}
 */
export const thoughts_for_author = items => {
  const rows = items.filter(
    i =>
      i &&
      typeof i === 'object' &&
      (i.type === 'posters' || i.type === 'thoughts')
  )
  rows.sort((a, b) => (as_created_at(a.id) ?? 0) - (as_created_at(b.id) ?? 0))

  /** @type {Thought[]} */
  const out = []
  /** @type {{ author_id: Author, started_at: number, posters: Item[], statements: Statement[], last_t: number } | null} */
  let cur = null

  for (const item of rows) {
    const t = as_created_at(item.id)
    // eslint-disable-next-line eqeqeq -- intentional nullish check
    if (t == null) continue
    const author = as_author(item.id)
    if (!author) continue

    if (!cur) {
      const first = {
        author_id: author,
        started_at: t,
        posters: [],
        statements: [],
        last_t: t
      }
      cur = first
      push_thought_item(first, item)
      continue
    }

    const gap = t - cur.last_t
    if (gap <= JS_TIME.THIRTEEN_MINUTES) {
      push_thought_item(cur, item)
      cur.last_t = t
    } else {
      out.push(finish_thought(cur))
      const next = {
        author_id: author,
        started_at: t,
        posters: [],
        statements: [],
        last_t: t
      }
      cur = next
      push_thought_item(next, item)
    }
  }
  if (cur) out.push(finish_thought(cur))
  return out
}

/**
 * @param {{ posters: Item[], statements: Statement[], last_t: number, author_id: Author, started_at: number }} cur
 * @param {Item} item
 */
const push_thought_item = (cur, item) => {
  if (item.type === 'posters') cur.posters.push(item)
  else cur.statements.push(/** @type {Statement} */ (item))
}

/**
 * @param {{ author_id: Author, started_at: number, posters: Item[], statements: Statement[] }} cur
 * @returns {Thought}
 */
const finish_thought = cur => ({
  author_id: cur.author_id,
  started_at: cur.started_at,
  posters: cur.posters,
  statements: cur.statements
})

/**
 * Feed slots for one thought: chronological, text runs as `Statements` arrays, posters as items.
 *
 * @param {Thought} thought
 * @returns {Array<Statements|Item>}
 */
export const thought_feed_slots = thought => {
  /** @type {{ t: number, poster?: Item, stmt?: Statement }[]} */
  const timed = []
  for (const p of thought.posters) {
    const t = as_created_at(p.id)
    if (t !== null && t !== undefined) timed.push({ t, poster: p })
  }
  for (const s of thought.statements) {
    const t = as_created_at(s.id)
    if (t !== null && t !== undefined) timed.push({ t, stmt: s })
  }
  timed.sort((a, b) => a.t - b.t)

  /** @type {Array<Statements|Item>} */
  const slots = []
  /** @type {Statement[]} */
  let run = []
  const flush = () => {
    if (run.length) {
      slots.push(run)
      run = []
    }
  }
  for (const x of timed)
    if (x.poster) {
      flush()
      slots.push(x.poster)
    } else if (x.stmt) run.push(x.stmt)
  flush()
  return slots
}
