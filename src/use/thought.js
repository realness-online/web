/** @typedef {import('@/types').Type} Type */
/** @typedef {import('@/types').PersonQuery} PersonQuery */
/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Item} Item */
/** @typedef {import('@/types').Thought_Item} Thought_Item */
/** @typedef {import('@/types').Statement} Statement */

import { as_created_at, list, as_author } from '@/utils/itemid'
import { as_directory } from '@/persistance/Directory'
import { recent_item_first, recent_number_first } from '@/utils/sorting'
import { Thought } from '@/persistance/Storage'
import { ref, inject, onMounted as mounted, nextTick as tick } from 'vue'
import { JS_TIME } from '@/utils/numbers'

const links = ['http://', 'https://']
const my_thoughts = ref(/** @type {Item[]} */ ([]))
let loading_promise = null

export const use = () => {
  const set_working = inject('set_working')
  const authors = ref(
    /** @type {Array<{id: Id, type: string, viewed: Array<string|number>}>} */
    ([])
  )
  const thoughts = ref(/** @type {Item[] | null} */ (null))

  /**
   * @param {Statement} stmt
   */
  const statement_shown = async stmt => {
    const oldest = stmt[stmt.length - 1]
    const author = as_author(oldest.id)
    const current = thoughts.value
    if (!current) return
    const author_thoughts = current.filter(
      thought => author === as_author(thought.id)
    )
    const author_oldest = author_thoughts[author_thoughts.length - 1]
    if (oldest.id === author_oldest.id) {
      const author_obj = authors.value.find(relation => relation.id === author)
      if (!author_obj) return
      const directory = await as_directory(
        /** @type {Id} */ (`${author_obj.id}/thoughts`)
      )
      if (!directory) return
      let history = directory.items
      history.sort(recent_number_first)
      history = history.filter(
        page => !author_obj.viewed.some(v => String(v) === String(page))
      )
      const next = history.shift()
      if (next) {
        const next_thoughts = await list(
          /** @type {Id} */ (`${author_obj.id}/thoughts/${next}`)
        )
        author_obj.viewed.push(next)
        thoughts.value = [...(thoughts.value ?? []), ...next_thoughts]
      }
    }
  }

  /**
   * @param {PersonQuery} query
   */
  const for_person = async query => {
    if (set_working) set_working(true)
    const thought_id = /** @type {Id} */ (`${query.id}/thoughts`)
    const their_thoughts = await list(thought_id)
    if (thoughts.value) thoughts.value = [...thoughts.value, ...their_thoughts]
    else thoughts.value = their_thoughts
    const existing_author = authors.value.find(a => a.id === query.id)
    if (existing_author) existing_author.viewed = ['index']
    else
      authors.value.push({
        id: query.id,
        type: 'person',
        viewed: ['index']
      })
    if (set_working) set_working(false)
  }

  const save = async thought => {
    if (!thought) return
    const post = {
      thought: thought.trim(),
      id: /** @type {Id} */ (
        `${localStorage.me}/thoughts/${new Date().getTime()}`
      ),
      type: /** @type {import('@/types').Type} */ ('thoughts')
    }
    if (!thought || links.some(link => thought.includes(link))) return
    my_thoughts.value.push(post)
    await tick()
    await new Thought().save(
      document.querySelector(`[itemid="${localStorage.me}/thoughts"]`)
    )
  }

  mounted(async () => {
    const promise =
      loading_promise || list(/** @type {Id} */ (`${localStorage.me}/thoughts`))
    if (!loading_promise) loading_promise = promise
    let loaded = await promise
    if (loaded.length === 0) {
      const legacy = await list(
        /** @type {Id} */ (`${localStorage.me}/statements`)
      )
      if (legacy.length) {
        /** @typedef {Item & { statement?: string, thought?: string }} Legacy_Item */
        const migrated = /** @type {import('@/types').Item[]} */ (
          legacy.map(
            /** @param {Legacy_Item} item */
            item => ({
              ...item,
              id: /** @type {Id} */ (
                item.id.replace('/statements/', '/thoughts/')
              ),
              thought: item.statement ?? item.thought ?? '',
              type: /** @type {import('@/types').Type} */ ('thoughts')
            })
          )
        )
        const section = document.createElement('section')
        section.setAttribute('itemscope', '')
        section.setAttribute('itemid', `${localStorage.me}/thoughts`)
        migrated.forEach(
          /** @param {import('@/types').Thought_Item} item */
          item => {
            const div = document.createElement('div')
            div.setAttribute('itemscope', '')
            div.setAttribute('itemid', item.id)
            const p = document.createElement('p')
            p.setAttribute('itemprop', 'thought')
            p.textContent = item.thought ?? ''
            div.appendChild(p)
            section.appendChild(div)
          }
        )
        await new Thought().save(section)
        loaded = migrated
      }
    }
    my_thoughts.value = loaded
    if (loading_promise === promise) loading_promise = null
    authors.value.push({
      id: /** @type {Id} */ (localStorage.me),
      type: 'person',
      viewed: ['index']
    })
  })

  return {
    authors,
    thoughts,
    my_thoughts,
    for_person,
    save,
    statement_shown
  }
}

/**
 * @param {Thought_Item[]} sacred_thoughts
 * @returns {Statement[]}
 */
export function as_statements(sacred_thoughts) {
  const thoughts = /** @type {Item[]} */ ([...sacred_thoughts])
  thoughts.sort(recent_item_first)
  const statements = /** @type {Statement[]} */ ([])
  while (thoughts.length) {
    const [thought] = thoughts.splice(-1, 1)
    if (!thought) break
    const stmt = [thought]
    while (is_train_of_statement(stmt, thoughts)) {
      const [next] = thoughts.splice(-1, 1)
      if (next) stmt.push(next)
    }
    statements.push(/** @type {Statement} */ (stmt))
  }
  return statements
}

/**
 * @param {Statement} first
 * @param {Statement} second
 */
export function statements_sort(first, second) {
  const [a] = first
  const [b] = second
  return (as_created_at(a?.id) ?? 0) - (as_created_at(b?.id) ?? 0)
}

export const slot_key = item => {
  if (Array.isArray(item)) return item[0].id
  return item.id
}

/**
 * @param {Statement} stmt
 * @param {Item[]} thoughts
 */
export function is_train_of_statement(stmt, thoughts) {
  const next_thought = thoughts[thoughts.length - 1]
  const nearest_thought = stmt[stmt.length - 1]
  if (next_thought && nearest_thought) {
    const nearest = as_created_at(nearest_thought.id) ?? 0
    const next = as_created_at(next_thought.id) ?? 0
    const difference = next - nearest
    if (difference < JS_TIME.THIRTEEN_MINUTES) return true
    return false
  }
  return false
}
