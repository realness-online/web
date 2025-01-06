import { as_created_at, list, as_directory, as_author } from '@/utils/itemid'
import { recent_item_first, recent_number_first } from '@/utils/sorting'
import { Statements } from '@/persistance/Storage'
import { ref, onMounted as mounted, nextTick as next_tick } from 'vue'
import { JS_TIME } from '@/utils/numbers'
const links = ['http://', 'https://']
const my_statements = ref([])

export const use = () => {
  const authors = ref([])
  const statements = ref(null)
  const thought_shown = async thought => {
    const oldest = thought[thought.length - 1]
    let author = as_author(oldest.id)
    const author_statements = statements.value.filter(
      statement => author === as_author(statement.id)
    )
    const author_oldest = author_statements[author_statements.length - 1]
    if (oldest.id === author_oldest.id) {
      author = authors.value.find(relation => relation.id === author)
      if (!author) return
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
        statements.value = [...statements.value, ...next_statements]
      }
    }
  }
  const for_person = async person => {
    const statement_id = `${person.id}/statements`
    const their_statements = await list(statement_id)
    if (statements.value)
      statements.value = [...statements.value, ...their_statements]
    else statements.value = their_statements
    person.viewed = ['index']
    authors.value.push(person)
  }
  const save = async statement => {
    if (!statement) return
    const post = {
      statement: statement.trim(),
      id: `${localStorage.me}/statements/${new Date().getTime()}`
    }
    if (!statement || links.some(link => statement.includes(link))) return
    my_statements.value.push(post)
    await next_tick()
    await new Statements().save()
  }
  mounted(async () => {
    my_statements.value = await list(`${localStorage.me}/statements`)
  })
  return {
    save,
    statements,
    for_person,
    thought_shown,
    my_statements,
    authors
  }
}

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
    if (difference < JS_TIME.THIRTEEN_MINUTES) return true
    return false
  }
  return false
}
