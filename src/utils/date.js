import { as_created_at } from '@/utils/itemid'
const this_year = Date.parse(new Date().getFullYear())
const format_as_time = {
  hour: 'numeric',
  minute: 'numeric',
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
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: 'numeric',
  minute: 'numeric',
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
  d1 = new Date(d1)
  d2 = new Date(d2)
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth()
  )
}
export function is_fresh(date = 0) {
  const expires = new Date()
  expires.setDate(expires.getDate() - 13)
  if (new Date(date) > expires) return true
  return false
}
export function as_time(date, format = format_as_time) {
  const time = new Date(date)
  return time.toLocaleString('en-US', format) // TODO: get country code from browser
}
export function as_day(date) {
  let day
  if (Date.parse(date) < this_year) day = as_time(date, format_as_day_and_year)
  else day = as_time(date, format_as_day)
  if (is_same_day(date, new Date())) day = 'Today'
  return day
}
export function as_day_and_time(date) {
  return as_time(date, format_as_day_and_time)
}
export function day_name(date) {
  date = new Date(date)
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}
export function id_as_day(itemid) {
  return day_name(as_created_at(itemid))
}
export const format_time_remaining = time_ms => {
  const minutes = Math.floor(time_ms / 60000)
  const hours = Math.floor(minutes / 60)
  const remaining_minutes = minutes % 60

  if (hours > 0) return `${hours}h ${remaining_minutes}m`

  return `${minutes}m`
}
