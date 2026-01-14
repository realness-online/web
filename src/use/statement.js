/** @typedef {import('@/types').Type} Type */
/** @typedef {import('@/types').PersonQuery} PersonQuery */
/** @typedef {import('@/types').Id} Id */

import { as_created_at, list, as_author } from '@/utils/itemid'
import { as_directory } from '@/persistance/Directory'
import { recent_item_first, recent_number_first } from '@/utils/sorting'
import { Statement } from '@/persistance/Storage'
import { ref, onMounted as mounted, nextTick as tick } from 'vue'
import { JS_TIME } from '@/utils/numbers'

const links = ['http://', 'https://']
const my_statements = ref([])
let loading_promise = null

export const use = () => {
  const authors = ref([])
  const statements = ref(null)

  /**
   * @param {Statement[]} thought
   */
  const thought_shown = async thought => {
    const oldest = thought[thought.length - 1]
    const author = as_author(oldest.id)
    const author_statements = statements.value.filter(
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
        page => !author_obj.viewed.some(viewed => viewed === page)
      )
      const next = history.shift()
      if (next) {
        const next_statements = await list(
          /** @type {Id} */ (`${author_obj.id}/statements/${next}`)
        )
        author_obj.viewed.push(next)
        statements.value = [...statements.value, ...next_statements]
      }
    }
  }

  /**
   * @param {PersonQuery} query
   */
  const for_person = async query => {
    const statement_id = /** @type {Id} */ (`${query.id}/statements`)
    const their_statements = await list(statement_id)
    if (statements.value)
      statements.value = [...statements.value, ...their_statements]
    else statements.value = their_statements
    const existing_author = authors.value.find(a => a.id === query.id)
    if (existing_author) existing_author.viewed = ['index']
    else
      authors.value.push({
        id: query.id,
        type: 'person',
        viewed: ['index']
      })
  }

  const save = async statement => {
    if (!statement) return
    const post = {
      statement: statement.trim(),
      id: `${localStorage.me}/statements/${new Date().getTime()}`
    }
    if (!statement || links.some(link => statement.includes(link))) return
    my_statements.value.push(post)
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

    my_statements.value = await promise
    if (loading_promise === promise) loading_promise = null
    authors.value.push({
      id: localStorage.me,
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
    thought_shown
  }
}

/**
 * @param {Statement[]} sacred_statements
 */
export function as_thoughts(sacred_statements) {
  const statements = [...sacred_statements]
  statements.sort(recent_item_first)
  const thoughts = []
  while (statements.length) {
    const statement = statements.pop()
    const thot = [statement]
    while (is_train_of_thought(thot, statements)) thot.push(statements.pop())
    thoughts.push(thot)
  }
  return thoughts
}

/**
 * @param {Statement} first
 * @param {Statement} second
 */
export function thoughts_sort(first, second) {
  return as_created_at(first[0].id) - as_created_at(second[0].id)
}

export const slot_key = item => {
  if (Array.isArray(item)) return item[0].id
  return item.id
}

/**
 * @param {Statement[]} thot
 * @param {Statement[]} statements
 */
export function is_train_of_thought(thot, statements) {
  const next_statement = statements[statements.length - 1]
  const nearest_statement = thot[thot.length - 1]
  if (next_statement && nearest_statement) {
    const nearest = as_created_at(nearest_statement.id)
    const next = as_created_at(next_statement.id)
    const difference = next - nearest
    if (difference < JS_TIME.THIRTEEN_MINUTES) return true
    return false
  }
  return false
}
