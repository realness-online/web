/** @typedef {import('@/types').PersonQuery} PersonQuery */
/** @typedef {import('@/types').Item} Item */
/** @typedef {import('@/types').Statements} Statements */

import { as_created_at, list, as_author } from '@/utils/itemid'
import { hydrate } from '@/utils/item'
import { as_directory } from '@/persistence/Directory'
import { recent_item_first, recent_number_first } from '@/utils/sorting'
import { Statements as statements_storage } from '@/persistence/Storage'
import { ref, inject, onMounted as mounted, nextTick as tick } from 'vue'
import { JS_TIME } from '@/utils/numbers'
const links = ['http://', 'https://']
const my_statements = ref(/** @type {Item[]} */ ([]))
const statements = ref(/** @type {Item[] | null} */ (null))
const authors = ref(
  /** @type {Array<{id: import('@/types').Id, type: string, viewed: Array<string|number>}>} */
  ([])
)
let loading_promise = null

/**
 * @param {import('@/types').Id} statement_id
 * @param {string} new_content
 * @returns {Promise<boolean>}
 */
const update_single_statement = async (statement_id, new_content) => {
  const storage_key = /** @type {import('@/types').Id} */ (
    `${localStorage.me}/statements`
  )
  const stored = localStorage.getItem(storage_key)
  if (!stored) return false
  const fragment = hydrate(stored)
  if (!fragment) return false
  const statement_el = fragment.querySelector(`[itemid="${statement_id}"]`)
  if (!statement_el) return false
  const p = statement_el.querySelector('[itemprop="statement"]')
  if (!p) return false
  p.textContent = new_content
  const section = fragment.firstElementChild
  if (!section) return false
  await new statements_storage().save(/** @type {Element} */ (section))
  return true
}

export const use = () => {
  const set_working = inject('set_working')
  const sync_element = /** @type {import('vue').Ref<HTMLElement|null>|null} */ (
    inject('sync_element', null)
  )

  /**
   * @param {Statements} stmt
   */
  const statement_shown = async stmt => {
    const oldest = stmt[stmt.length - 1]
    const author = as_author(oldest.id)
    const current = statements.value
    if (!current) return
    const author_statements = current.filter(s => author === as_author(s.id))
    const author_oldest = author_statements[author_statements.length - 1]
    if (oldest.id === author_oldest.id) {
      const author_obj = authors.value.find(relation => relation.id === author)
      if (!author_obj) return
      const dir = await as_directory(
        /** @type {import('@/types').Id} */ (`${author_obj.id}/statements`)
      )
      if (!dir) return
      let history = dir.items
      history.sort(recent_number_first)
      history = history.filter(
        page => !author_obj.viewed.some(v => String(v) === String(page))
      )
      const next = history.shift()
      if (next) {
        const next_statements = await list(
          /** @type {import('@/types').Id} */ (
            `${author_obj.id}/statements/${next}`
          )
        )
        author_obj.viewed.push(next)
        statements.value = [...(statements.value ?? []), ...next_statements]
      }
    }
  }

  /**
   * @param {PersonQuery} query
   */
  const for_person = async query => {
    if (set_working) set_working(true)
    const statement_id = /** @type {import('@/types').Id} */ (
      `${query.id}/statements`
    )
    const their_statements = await list(statement_id)
    if (statements.value) {
      const existing_ids = new Set(statements.value.map(s => s.id))
      const new_only = their_statements.filter(s => !existing_ids.has(s.id))
      statements.value = [...statements.value, ...new_only]
    } else statements.value = their_statements
    const existing = authors.value.find(a => a.id === query.id)
    if (existing) existing.viewed = ['index']
    else
      authors.value.push({
        id: query.id,
        type: 'person',
        viewed: ['index']
      })
    if (set_working) set_working(false)
  }

  const save = async statement => {
    if (!statement) return
    const ts = new Date().getTime()
    const post = /** @type {Item & {statement: string}} */ ({
      id: /** @type {import('@/types').Id} */ (
        `${localStorage.me}/statements/${ts}`
      ),
      type: 'thoughts',
      statement: statement.trim()
    })
    if (!statement || links.some(link => statement.includes(link))) return
    my_statements.value.push(post)
    if (statements.value) statements.value = [...statements.value, post]
    await tick()
    const scope = sync_element?.value ?? document
    const section = scope.querySelector(
      `[itemid="${localStorage.me}/statements"]`
    )
    if (section)
      await new statements_storage().save(/** @type {Element} */ (section))
  }

  /**
   * @param {import('@/types').Id} statement_id
   * @param {string} new_content
   */
  const update_statement = async (statement_id, new_content) => {
    const ok = await update_single_statement(statement_id, new_content)
    if (!ok) return
    const patch = s =>
      s.id === statement_id ? { ...s, statement: new_content } : s
    my_statements.value = my_statements.value.map(patch)
    if (statements.value) statements.value = statements.value.map(patch)
  }

  mounted(async () => {
    const statements_id = /** @type {import('@/types').Id} */ (
      `${localStorage.me}/statements`
    )
    const thoughts_id = /** @type {import('@/types').Id} */ (
      `${localStorage.me}/thoughts`
    )
    const promise = loading_promise || list(statements_id)
    if (!loading_promise) loading_promise = promise
    let loaded = await promise
    if (loaded.length === 0) {
      const legacy = await list(thoughts_id)
      if (legacy.length) {
        /** @typedef {Item & { statement?: string, thought?: string }} Legacy_Item */
        const migrated = /** @type {Item[]} */ (
          legacy.map(
            /** @param {Legacy_Item} item */
            item => ({
              ...item,
              id: /** @type {import('@/types').Id} */ (
                String(item.id).replace('/thoughts/', '/statements/')
              ),
              statement: item.statement ?? item.thought ?? ''
            })
          )
        )
        const section = document.createElement('section')
        section.setAttribute('itemscope', '')
        section.setAttribute('itemid', statements_id)
        migrated.forEach(
          /** @param {{id: string, statement?: string}} item */
          item => {
            const div = document.createElement('div')
            div.setAttribute('itemscope', '')
            div.setAttribute('itemid', item.id)
            div.setAttribute('itemprop', 'statements')
            const p = document.createElement('p')
            p.setAttribute('itemprop', 'statement')
            p.textContent = item.statement ?? ''
            div.appendChild(p)
            section.appendChild(div)
          }
        )
        await new statements_storage().save(section)
        loaded = migrated
      }
    }
    my_statements.value = loaded
    if (loading_promise === promise) loading_promise = null
    const existing_me = authors.value.find(a => a.id === localStorage.me)
    if (!existing_me)
      authors.value.push({
        id: /** @type {import('@/types').Id} */ (localStorage.me),
        type: 'person',
        viewed: ['index']
      })
  })

  return {
    authors,
    statements,
    my_statements,
    for_person,
    save,
    statement_shown,
    update_statement
  }
}

/**
 * @param {Item[]} sacred_statements
 * @returns {Statements[]}
 */
export function as_thoughts(sacred_statements) {
  const stmts = /** @type {Item[]} */ ([...sacred_statements])
  stmts.sort(recent_item_first)
  const thoughts = /** @type {Statements[]} */ ([])
  while (stmts.length) {
    const stmt = stmts.pop()
    if (!stmt) break
    const thot = [stmt]
    while (is_train_of_thought(thot, stmts)) {
      const next = stmts.pop()
      if (next) thot.push(next)
    }
    thoughts.push(/** @type {Statements} */ (thot))
  }
  return thoughts
}

/**
 * @param {Statements} first
 * @param {Statements} second
 */
export function thoughts_sort(first, second) {
  const [a] = first
  const [b] = second
  return (as_created_at(a?.id) ?? 0) - (as_created_at(b?.id) ?? 0)
}

export const slot_key = item => {
  if (Array.isArray(item)) return item[0].id
  return item.id
}

/**
 * Pairs posters with statement-thoughts from the same author when any statement
 * timestamp is within the train-of-thought window of the poster.
 *
 * @param {Array<import('@/types').Statements | import('@/types').Item>} day_items
 * @returns {{
 *   merged_thought_keys: Set<string>,
 *   poster_to_thought: Map<string, import('@/types').Statements>
 * }}
 */
export function poster_thought_overlay_pairs(day_items) {
  const thoughts = day_items.filter(i => Array.isArray(i))
  const items = day_items.filter(
    /**
     * @param {import('@/types').Item | import('@/types').Statements} i
     * @returns {i is import('@/types').Item}
     */
    i => !Array.isArray(i)
  )
  const posters = items.filter(
    i => i && typeof i === 'object' && i.type === 'posters'
  )
  /** @type {Array<{ poster: import('@/types').Item, thought: import('@/types').Statements, dist: number }>} */
  const candidates = []
  for (const poster of posters) {
    const poster_ts = as_created_at(poster.id)
    // eslint-disable-next-line eqeqeq -- == null is nullish (null | undefined)
    if (poster_ts == null) continue
    for (const thought of thoughts) {
      if (as_author(poster.id) !== as_author(thought[0].id)) continue
      let min_dist = Infinity
      for (const stmt of thought) {
        const t = as_created_at(stmt.id)
        // eslint-disable-next-line eqeqeq -- == null is nullish (null | undefined)
        if (t == null) continue
        const d = Math.abs(poster_ts - t)
        if (d < min_dist) min_dist = d
      }
      if (min_dist < JS_TIME.THIRTEEN_MINUTES)
        candidates.push({ poster, thought, dist: min_dist })
    }
  }
  candidates.sort((a, b) => a.dist - b.dist)
  const merged_thought_keys = new Set()
  const poster_to_thought = new Map()
  const used_posters = new Set()
  for (const c of candidates) {
    if (used_posters.has(c.poster.id)) continue
    const tk = slot_key(c.thought)
    merged_thought_keys.add(tk)
    used_posters.add(c.poster.id)
    poster_to_thought.set(c.poster.id, c.thought)
  }
  return { merged_thought_keys, poster_to_thought }
}

/**
 * @param {Statements} thot
 * @param {Item[]} statements
 */
function is_train_of_thought(thot, statements) {
  const next = statements[statements.length - 1]
  const nearest = thot[thot.length - 1]
  if (next && nearest) {
    const nearest_ts = as_created_at(nearest.id) ?? 0
    const next_ts = as_created_at(next.id) ?? 0
    return next_ts - nearest_ts < JS_TIME.THIRTEEN_MINUTES
  }
  return false
}
