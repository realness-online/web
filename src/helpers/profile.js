import { as_query_id, as_fragment } from '@/helpers/itemid'
export function as_phone_number (id = '/+1') {
  return id.substring(3)
}
export function from_phone_number (phone_number) {
  return `/+1${phone_number}`
}
export function from_e64 (e64_number) {
  return `/${e64_number}`
}
export default {
  as_query_id,
  as_fragment,
  as_phone_number,
  from_phone_number,
  from_e64
}
