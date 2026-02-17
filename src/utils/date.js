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
const format_as_day_and_time = {
  weekday: /** @type {'long'} */ ('long'),
  day: /** @type {'numeric'} */ ('numeric'),
  month: /** @type {'long'} */ ('long'),
  hour: /** @type {'numeric'} */ ('numeric'),
  minute: /** @type {'numeric'} */ ('numeric'),
  second: /** @type {'numeric'} */ ('numeric'),
  hour12: true
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

export function today_as_date() {
  const now = new Date()
  return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`
}

export function is_today(a_date) {
  if (a_date === today_as_date()) return true
  return false
}
export function is_same_day(d1, d2) {
  const date1 = new Date(d1)
  const date2 = new Date(d2)
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth()
  )
}
export function is_fresh(date = 0) {
  const expires = new Date()
  expires.setDate(expires.getDate() - 13)
  if (new Date(date) > expires) return true
  return false
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
export function as_day_and_time(date) {
  return as_time(date, format_as_day_and_time)
}

/** Filename-safe date/time with seconds; colons replaced for Windows compatibility */
export function as_day_and_time_for_filename(date) {
  const formatted = as_time(date, format_as_day_and_time)
  return formatted.replace(/:/g, '-')
}

export function as_day_time_year(date) {
  return as_time(date, format_as_day_time_year)
}
export function day_name(date) {
  const d = new Date(date)
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}
export function id_as_day(itemid) {
  return day_name(as_created_at(itemid))
}
const MS_PER_MINUTE = 60000

export const format_time_remaining = time_ms => {
  const minutes = Math.floor(time_ms / MS_PER_MINUTE)
  const hours = Math.floor(minutes / 60)
  const remaining_minutes = minutes % 60

  if (hours > 0) return `${hours}h ${remaining_minutes}m`

  return `${minutes}m`
}
