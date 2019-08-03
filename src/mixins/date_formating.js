// const a_year_ago = new Date().getFullYear() - 1
const a_year_ago = Date.parse( (new Date().getFullYear() ) )
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
  data() {
    return {
      today: this.created_day(new Date().toISOString())
    }
  },
  methods: {
    created_time(created_at, format = format_as_time) {
      const time = new Date(created_at)
      return time.toLocaleString('en-US', format) // TODO: get country code from browser
    },
    created_day(created_at) {
      let day
      if (Date.parse(created_at) < a_year_ago) {
        day = this.created_time(created_at, format_as_day_and_year)
      } else day = this.created_time(created_at, format_as_day)
      const today = this.created_time(new Date().toISOString(), format_as_day)
      if (day === today) day = `Today – ${day}`
      return day
    },
    created_day_and_time(created_at) {
      return this.created_time(created_at, format_as_day_and_time)
    }
  }
}
