export function newer_day_first (earlier, later) {
  return Date.parse(later[0]) - Date.parse(earlier[0])
}
export function newer_first (earlier, later) {
  return Date.parse(later.created_at) - Date.parse(earlier.created_at)
}
export function older_first (earlier, later) {
  return Date.parse(earlier.created_at) - Date.parse(later.created_at)
}
export default { newer_first, older_first }
