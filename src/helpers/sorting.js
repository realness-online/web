import { as_created_at } from '@/helpers/itemid'
export function newer_id_first (first, second) {
  return as_created_at(second) - as_created_at(first)
}
export function newer_item_first (first, second) {
  return as_created_at(second.id) - as_created_at(first.id)
}
export function newer_date_first (first, second) {
  return new Date(second[0]) - new Date(first[0]) // newer is larger
}
export function newer_number_first (first, second) {
   return parseInt(second) - parseInt(first)
}
export function earlier_weirdo_first (first, second) {
  return newer_id_first(get_id(second), get_id(first))
}
// these items are more recent
export function recent_weirdo_first (first, second) {
  return newer_id_first(get_id(first), get_id(second))
}
function get_id (thing) {
  if (Array.isArray(thing)) return thing[0].id
  else return thing.id
}
