export const KB = 1024
export const MB = KB * KB
export const PERCENT = 100
export const FIVE_HOURS = 5 * 60 * 60 // 18000 seconds

export const format_bytes = bytes => {
  if (bytes < KB) return `${bytes} B`
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`
  return `${(bytes / MB).toFixed(1)} MB`
}
export const to_kb = obj => {
  const as_string = JSON.stringify(obj)
  const size_of = new Blob([as_string]).size
  return (size_of / 1024).toFixed(2)
}
