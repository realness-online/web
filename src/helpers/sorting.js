import { as_created_at } from '@/helpers/itemid'
export function recent_id_first (first, second) {
  return as_created_at(second) - as_created_at(first)
}
export function recent_item_first (first, second) {
  return as_created_at(second.id) - as_created_at(first.id)
}
export function recent_visit_first (first, second) {
  return new Date(first.visited) - as_created_at(second.visited)
}

export function recent_date_first (first, second) {
  return new Date(second[0]) - new Date(first[0]) // newer is larger
}
export function recent_number_first (first, second) {
  return parseInt(second) - parseInt(first)
}
export function earlier_weirdo_first (first, second) {
  return recent_id_first(get_id(second), get_id(first))
}
export function recent_weirdo_first (first, second) {
  return recent_id_first(get_id(first), get_id(second))
}
function get_id (thing) {
  if (Array.isArray(thing)) return thing[0].id
  else return thing.id
}
