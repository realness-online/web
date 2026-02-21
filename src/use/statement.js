/** @typedef {import('@/types').Type} Type */
/** @typedef {import('@/types').PersonQuery} PersonQuery */
/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Item} Item */
/** @typedef {import('@/types').Statement_Item} Statement_Item */
/** @typedef {Statement_Item[]} Thought */

import { as_created_at, list, as_author } from '@/utils/itemid'
import { as_directory } from '@/persistance/Directory'
import { recent_item_first, recent_number_first } from '@/utils/sorting'
import { Statement } from '@/persistance/Storage'
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
   * @param {Thought} thought
   */
  const thought_shown = async thought => {
    const oldest = thought[thought.length - 1]
    const author = as_author(oldest.id)
    const current = thoughts.value
    if (!current) return
    const author_statements = current.filter(
      statement => author === as_author(statement.id)
    )
    const author_oldest = author_statements[author_statements.length - 1]
    if (oldest.id === author_oldest.id) {
      const author_obj = authors.value.find(relation => relation.id === author)
      if (!author_obj) return
      const directory = await as_directory(
        /** @type {Id} */ (`${author_obj.id}/statements`)
      )
      if (!directory) return
      let history = directory.items
      history.sort(recent_number_first)
      history = history.filter(
        page => !author_obj.viewed.some(v => String(v) === String(page))
      )
      const next = history.shift()
      if (next) {
        const next_statements = await list(
          /** @type {Id} */ (`${author_obj.id}/statements/${next}`)
        )
        author_obj.viewed.push(next)
        thoughts.value = [...(thoughts.value ?? []), ...next_statements]
      }
    }
  }

  /**
   * @param {PersonQuery} query
   */
  const for_person = async query => {
    if (set_working) set_working(true)
    const statement_id = /** @type {Id} */ (`${query.id}/statements`)
    const their_statements = await list(statement_id)
    if (thoughts.value)
      thoughts.value = [...thoughts.value, ...their_statements]
    else thoughts.value = their_statements
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

  const save = async statement => {
    if (!statement) return
    const post = {
      statement: statement.trim(),
      id: /** @type {Id} */ (
        `${localStorage.me}/statements/${new Date().getTime()}`
      ),
      type: /** @type {import('@/types').Type} */ ('statements')
    }
    if (!statement || links.some(link => statement.includes(link))) return
    my_thoughts.value.push(post)
    await tick()
    await new Statement().save(
      document.querySelector(`[itemid="${localStorage.me}/statements"]`)
    )
  }

  mounted(async () => {
    const promise =
      loading_promise ||
      list(/** @type {Id} */ (`${localStorage.me}/statements`))
    if (!loading_promise) loading_promise = promise

    my_thoughts.value = await promise
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
    thought_shown
  }
}

/**
 * @param {Statement_Item[]} sacred_statements
 * @returns {Thought[]}
 */
export function as_thoughts(sacred_statements) {
  const statements = /** @type {Item[]} */ ([...sacred_statements])
  statements.sort(recent_item_first)
  const thoughts = /** @type {Thought[]} */ ([])
  while (statements.length) {
    const [statement] = statements.splice(-1, 1)
    if (!statement) break
    const thot = [statement]
    while (is_train_of_thought(thot, statements)) {
      const [next] = statements.splice(-1, 1)
      if (next) thot.push(next)
    }
    thoughts.push(/** @type {Thought} */ (thot))
  }
  return thoughts
}

/**
 * @param {Thought} first
 * @param {Thought} second
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
 * @param {Thought} thot
 * @param {Item[]} statements
 */
export function is_train_of_thought(thot, statements) {
  const next_statement = statements[statements.length - 1]
  const nearest_statement = thot[thot.length - 1]
  if (next_statement && nearest_statement) {
    const nearest = as_created_at(nearest_statement.id) ?? 0
    const next = as_created_at(next_statement.id) ?? 0
    const difference = next - nearest
    if (difference < JS_TIME.THIRTEEN_MINUTES) return true
    return false
  }
  return false
}
