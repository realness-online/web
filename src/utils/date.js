import { as_created_at } from '@/utils/itemid'
const this_year = Date.parse(String(new Date().getFullYear()))
const format_as_time = {
  hour: /** @type {'numeric'} */ ('numeric'),
  minute: /** @type {'numeric'} */ ('numeric'),
  hour12: true
}
const format_as_day = {
  weekday: 'long',
  day: 'numeric',
  month: 'long'
}
const format_as_day_and_year = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
}
const format_as_day_time_year = {
  weekday: /** @type {'long'} */ ('long'),
  day: /** @type {'numeric'} */ ('numeric'),
  month: /** @type {'long'} */ ('long'),
  year: /** @type {'numeric'} */ ('numeric'),
  hour: /** @type {'numeric'} */ ('numeric'),
  minute: /** @type {'numeric'} */ ('numeric'),
  second: /** @type {'numeric'} */ ('numeric'),
  hour12: true
}

function today_as_date() {
  const now = new Date()
  return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`
}

export function is_today(a_date) {
  if (a_date === today_as_date()) return true
  return false
}
function is_same_day(d1, d2) {
  const date1 = new Date(d1)
  const date2 = new Date(d2)
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth()
  )
}
/**
 * @param {string|Date} date
 * @param {Intl.DateTimeFormatOptions} [format]
 */
export function as_time(date, format = format_as_time) {
  const time = new Date(date)
  return time.toLocaleString('en-US', format) // TODO: get country code from browser
}
export function as_day(date) {
  let day
  if (Date.parse(date) < this_year)
    day = as_time(
      date,
      /** @type {Intl.DateTimeFormatOptions} */ (format_as_day_and_year)
    )
  else
    day = as_time(
      date,
      /** @type {Intl.DateTimeFormatOptions} */ (format_as_day)
    )
  if (is_same_day(date, new Date())) day = 'Today'
  return day
}

export function as_day_time_year(date) {
  return as_time(date, format_as_day_time_year)
}
function day_name(date) {
  const d = new Date(date)
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

const HOUR_NOON = 12
const HOUR_EVENING = 17
const HOUR_NIGHT = 22

/**
 * @param {Date|number} date
 * @returns {'morning'|'afternoon'|'evening'|'night'}
 */
export function time_of_day(date) {
  const hour = new Date(date).getHours()
  if (hour >= 5 && hour < HOUR_NOON) return 'morning'
  if (hour >= HOUR_NOON && hour < HOUR_EVENING) return 'afternoon'
  if (hour >= HOUR_EVENING && hour < HOUR_NIGHT) return 'evening'
  return 'night'
}

/** Day, time of day, date for filenames; spaces kept */
export function as_day_time_of_day_for_filename(date) {
  const d = new Date(date)
  const day = d.toLocaleString('en-US', { weekday: 'long' })
  const period = time_of_day(d)
  const date_str = d.toLocaleString('en-US', { month: 'long', day: 'numeric' })
  return `${day} ${period}, ${date_str}`
}
export function id_as_day(itemid) {
  return day_name(as_created_at(itemid))
}
