export const KB = 1024
export const MB = KB * KB
export const PERCENT = 100
export const OPEN_ANGLE = 60 // ASCII 60
export const MS_PER_SECOND = 1000

export const CACHE_TIME = {
  THREE_MINUTES: 3 * 60, // 180 seconds
  FIVE_HOURS: 5 * 60 * 60, // 18000 seconds
  THIRTEEN_MINUTES: 13 * 60, // 780 seconds
  ONE_HOUR: 60 * 60, // 3600 seconds
  EIGHT_HOURS: 8 * 60 * 60 // 28800 seconds
}

export const JS_TIME = {
  THREE_MINUTES: 3 * 60 * MS_PER_SECOND, // 180000 ms
  FIVE_MINUTES: 5 * 60 * MS_PER_SECOND, // 300000 ms
  THIRTEEN_MINUTES: 13 * 60 * MS_PER_SECOND, // 780000 ms
  ONE_HOUR: 60 * 60 * MS_PER_SECOND, // 3600000 ms
  EIGHT_HOURS: 8 * 60 * 60 * MS_PER_SECOND // 28800000 ms
}

// Storage size thresholds in KB
export const SIZE = {
  MIN: 21, // Initial threshold for optimization
  MID: 34, // Target reduction size
  MAX: 55 // Upper limit requiring optimization
}

export const IMAGE = {
  TARGET_SIZE: 512 // Default size for image processing
}

export const format_bytes = bytes => {
  if (bytes < KB) return `${bytes} B`
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`
  return `${(bytes / MB).toFixed(1)} MB`
}
export const to_kb = obj => {
  // If obj is already a Blob, use its size directly
  if (obj instanceof Blob) return (obj.size / KB).toFixed(2)

  // For other types, convert to string and create blob
  const as_string = JSON.stringify(obj)
  const size_of = new Blob([as_string]).size
  return (size_of / KB).toFixed(2)
}
export const itemid_as_kilobytes = itemid => {
  const bytes = localStorage.getItem(itemid)
  if (bytes) return bytes.length / KB
  return 0
}
export const elements_as_kilobytes = elements => {
  if (elements) return elements.outerHTML.length / KB
  return 0
}
