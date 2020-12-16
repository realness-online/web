import { as_created_at } from '@/helpers/itemid'
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

export function today_as_date () {
  const now = new Date()
  return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`
}

export function is_today (a_date) {
  if (a_date === today_as_date()) return true
  else return false
}
export function is_same_day (d1, d2) {
  d1 = new Date(d1)
  d2 = new Date(d2)
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth()
}
export function is_fresh (date) { // you are only fresh for 4 hours
  const timestamp = Math.round(new Date().getTime() / 1000)
  const four_hours_ago = timestamp - (4 * 3600)
  const one_day_ago = four_hours_ago * 6
  const three_days_ago = one_day_ago * 3
  if (three_days_ago < new Date(date).getTime()) {
    console.log('is-fresh')
    return true
  } else {
    console.log('not-fresh')
    return false
  }
}
export function as_time (date, format = format_as_time) {
  const time = new Date(date)
  return time.toLocaleString('en-US', format) // TODO: get country code from browser
}
export function as_day (date) {
  let day
  if (Date.parse(date) < this_year) {
    day = as_time(date, format_as_day_and_year)
  } else day = as_time(date, format_as_day)
  if (is_same_day(date, new Date())) day = 'Today'
  return day
}
export function as_day_and_time (date) {
  return as_time(date, format_as_day_and_time)
}
export function day_name (date) {
  date = new Date(date)
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}
export function id_as_day (itemid) {
  return day_name(as_created_at(itemid))
}
