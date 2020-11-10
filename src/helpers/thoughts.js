import { as_created_at } from '@/helpers/itemid'
import { newer_item_first } from '@/helpers/sorting'
export const thirteen_minutes = 1000 * 60 * 13 // 780000
export function as_thoughts (sacred_statements) {
  const statements = [...sacred_statements]
  statements.sort(newer_item_first)
  const thoughts = []
  while (statements.length) {
    const statement = statements.pop()
    const thot = [statement]
    while (is_train_of_thought(thot, statements)) { thot.push(statements.pop()) }
    thoughts.push(thot)
  }
  return thoughts
}

export function thoughts_sort (first, second) {
  return as_created_at(first[0].id) - as_created_at(second[0].id)
}

export function is_train_of_thought (thot, statements) {
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
