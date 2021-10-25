export function as_phone_number(id = '/+1') {
  return id.substring(3)
}
export function from_e64(e64_number) {
  return `/${e64_number}`
}
