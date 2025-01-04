export const KB = 1024
export const MB = KB * KB
export const PERCENT = 100
export const FIVE_HOURS = 5 * 60 * 60 // 18000 seconds
export const THIRTEEN_MINUTES = 13 * 60 * 1000 // 780000 milliseconds
export const OPEN_ANGLE = 60 // ASCII 60
// Storage size thresholds in KB
export const SIZE = {
  MIN: 13, // Initial threshold for optimization
  MID: 21, // Target reduction size
  MAX: 34 // Upper limit requiring optimization
}

export const format_bytes = bytes => {
  if (bytes < KB) return `${bytes} B`
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`
  return `${(bytes / MB).toFixed(1)} MB`
}
export const to_kb = obj => {
  const as_string = JSON.stringify(obj)
  const size_of = new Blob([as_string]).size
  return (size_of / KB).toFixed(2)
}
export const itemid_as_kilobytes = itemid => {
  const bytes = localStorage.getItem(itemid)
  if (bytes) return (bytes.length / KB).toFixed(2)
  return 0
}
export const elements_as_kilobytes = elements => {
  if (elements) return (elements.outerHTML.length / KB).toFixed(2)
  return 0
}
