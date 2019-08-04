export default {
  newer_first(earlier, later) {
    return Date.parse(later.created_at) - Date.parse(earlier.created_at)
  },
  older_first(earlier, later) {
    return Date.parse(earlier.created_at) - Date.parse(later.created_at)
  }
}
