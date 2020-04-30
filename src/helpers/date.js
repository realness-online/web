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
export default {
  as_time (date, format = format_as_time) {
    const time = new Date(date)
    return time.toLocaleString('en-US', format) // TODO: get country code from browser
  },
  as_day (date) {
    let day
    if (Date.parse(date) < this_year) {
      day = this.as_time(date, format_as_day_and_year)
    } else day = this.as_time(date, format_as_day)
    if (this.is_same_day(date, new Date())) day = 'Today'
    return day
  },
  as_day_and_time (date) {
    return this.as_time(date, format_as_day_and_time)
  },
  is_same_day (d1, d2) {
    d1 = new Date(d1)
    d2 = new Date(d2)
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth()
  },
  day_name (date) {
    date = new Date(date)
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
  },
  id_as_day (itemid) {
    return new Date(as_created_at(itemid))
  }

}
