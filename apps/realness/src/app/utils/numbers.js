import { THOUGHT_WINDOW_MS } from '@realness.online/thoughts'

const KB = 1024
export const OPEN_ANGLE = 60
const MS_PER_SECOND = 1000

export const JS_TIME = {
  THREE_MINUTES: 3 * 60 * MS_PER_SECOND,
  FIVE_MINUTES: 5 * 60 * MS_PER_SECOND,
  THIRTEEN_MINUTES: THOUGHT_WINDOW_MS,
  ONE_HOUR: 60 * 60 * MS_PER_SECOND,
  EIGHT_HOURS: 8 * 60 * 60 * MS_PER_SECOND
}

export const SIZE = {
  MIN: 21,
  MID: 34,
  MAX: 55
}

export const IMAGE = {
  TARGET_SIZE: 512
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
