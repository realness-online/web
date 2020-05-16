import { as_created_at } from '@/helpers/itemid'
export function newer_item_first (first, second) {
  return as_created_at(first.id) - as_created_at(second.id)
}
export function older_item_first (first, second) {
  return as_created_at(second.id) - as_created_at(first.id)
}
export function newer_date_first (first, second) {
  return new Date(first) - new Date(second)
}
export function older_date_first (first, second) {
  return new Date(second) - new Date(first)
}
