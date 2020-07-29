import { as_created_at } from '@/helpers/itemid'
export function newer_item_first (first, second) {
  return as_created_at(second.id) - as_created_at(first.id)
}
export function older_item_first (first, second) {
  return as_created_at(first.id) - as_created_at(second.id)
}
export function newer_date_first (first, second) {
  return new Date(second[0]) - new Date(first[0]) // newer is larger
}
export function older_date_first (first, second) {
  return new Date(first[0]) - new Date(second[0]) // older is smaller
}
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
// If compareFunction(a, b) returns less than 0, sort a to an index lower than b (i.e. a comes first).
// If compareFunction(a, b) returns greater than 0, sort b to an index lower than a (i.e. b comes first).
// const older = 1590281557409
// const newer = 1590281566661
// older_item_first (older, newer)  1590281557409 - 1590281566661 = -9252
// older_item_first (newer, older)  1590281566661 - 1590281557409 = 9252
