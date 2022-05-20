import { as_created_at, list, as_directory, as_author } from '@/use/itemid'
import { recent_item_first, recent_number_first } from '@/use/sorting'
import { Statements } from '@/persistance/Storage'
import { current_user } from '@/use/serverless'
import { ref, watchEffect as watch_effect, nextTick as next_tick } from 'vue'
export const thirteen_minutes = 1000 * 60 * 13 // 780000

const new_statement = ref(null)
const my_statements = ref([])

export const use = () => {
  const authors = ref([])
  const statements = ref(null)
  const textarea = ref(null)
  const thought_shown = async thought => {
    console.log('thought_shown')
    const oldest = thought[thought.length - 1]
    let author = as_author(oldest.id)
    const author_statements = statements.value.filter(
      statement => author === as_author(statement.id)
    )
    const author_oldest = author_statements[author_statements.length - 1]
    if (oldest.id === author_oldest.id) {
      author = authors.value.find(relation => relation.id === author)
      const directory = await as_directory(`${author.id}/statements`)
      if (!directory) return
      let history = directory.items
      history.sort(recent_number_first)
      history = history.filter(
        page => !author.viewed.some(viewed => viewed === page)
      )
      const next = history.shift()
      if (next) {
        const next_statements = await list(`${author.id}/statements/${next}`)
        author.viewed.push(next)
        statements.value = [...statements, ...next_statements]
      }
    }
  }
  const for_person = async person => {
    const statement_id = `${person.id}/statements`
    statements.value = await list(statement_id)
    person.viewed = ['index']
    authors.value.push(person)
  }
  watch_effect(async () => {
    if (current_user.value && navigator.onLine)
      my_statements.value = await list(`${localStorage.me}/statements`)
  })
  // watch_effect(async () => {
  //   console.log(textarea.value)
  //   if (textarea.value) {
  //     console.log('no way')
  //     await next_tick()
  //     my_statements.value.push(new_statement.value)
  //     await next_tick()
  //     await new Statements().save()
  //     new_statement.value = ''
  //   }
  // })
  return {
    textarea,
    statements,
    for_person,
    thought_shown,
    my_statements,
    new_statement
  }
}

export function as_thoughts(sacred_statements) {
  const statements = [...sacred_statements]
  statements.sort(recent_item_first)
  const thoughts = []
  while (statements.length) {
    const statement = statements.pop()
    const thot = [statement]
    while (is_train_of_thought(thot, statements)) {
      thot.push(statements.pop())
    }
    thoughts.push(thot)
  }
  return thoughts
}
export function thoughts_sort(first, second) {
  return as_created_at(first[0].id) - as_created_at(second[0].id)
}
export const slot_key = item => {
  if (Array.isArray(item)) return item[0].id
  return item.id
}
export function is_train_of_thought(thot, statements) {
  const next_statement = statements[statements.length - 1]
  const nearest_statement = thot[thot.length - 1]
  if (next_statement && nearest_statement) {
    const nearest = as_created_at(nearest_statement.id)
    const next = as_created_at(next_statement.id)
    const difference = next - nearest
    if (difference < thirteen_minutes) return true
    else return false
  } else return false
}
