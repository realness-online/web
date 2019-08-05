const a_year_ago = Date.parse(new Date().getFullYear())
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
  as_time(date, format = format_as_time) {
    const time = new Date(date)
    return time.toLocaleString('en-US', format) // TODO: get country code from browser
  },
  as_day(date) {
    let day
    if (Date.parse(date) < a_year_ago) {
      day = this.as_time(date, format_as_day_and_year)
    } else day = this.as_time(date, format_as_day)
    const today = this.as_time(new Date().toISOString(), format_as_day)
    if (day === today) day = `Today – ${day}`
    return day
  },
  as_day_and_time(date) {
    return this.as_time(date, format_as_day_and_time)
  }
}
