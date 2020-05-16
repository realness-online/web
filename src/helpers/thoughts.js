import { as_created_at } from '@/helpers/itemid'
import { newer_item_first } from '@/helpers/sorting'
export const thirteen_minutes = 1000 * 60 * 13 // 780000
export function as_thoughts (statements) {
  statements.sort(newer_item_first)
  const thoughts = []
  while (statements.length) {
    const statement = statements.shift()
    const thot = [statement]
    while (is_train_of_thought(thot, statements)) { thot.push(statements.shift()) }
    thoughts.push(thot)
  }
  return thoughts
}
export function is_train_of_thought (thot, statements) {
  const next_statement = statements[0]
  const last_statement = thot[thot.length - 1]
  if (next_statement && last_statement) {
    const last = as_created_at(last_statement.id)
    const next = as_created_at(next_statement.id)
    const difference = next - last
    if (difference < thirteen_minutes) return true
    else return false
  } else return false
}
export default as_thoughts
