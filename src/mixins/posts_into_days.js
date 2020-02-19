import sorting from '@/modules/sorting'
import date_helper from '@/helpers/date'
export default {
  data() {
    return {
      sort_count: 0
    }
  },
  methods: {
    populate_days(posts, person, days = new Map()) {
      const condensed = this.condense_posts(posts, person)
      condensed.forEach(post => this.insert_post_into_day(post, days))
      return days
    },
    today_as_date() {
      const now = new Date()
      return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`
    },
    is_today(date) {
      if (date === this.today_as_date()) return true
      else return false
    },
    insert_post_into_day(post, days) {
      const day_name = date_helper.day_name(post.created_at)
      const day = days.get(day_name)
      if (day) {
        day.unshift(post)
        day.sort(this.older_first)
      } else days.set(day_name, [post])
      return days
    },
    newer_day_first(earlier, later) {
      this.sort_count++
      return sorting.newer_day_first(earlier, later)
    },
    newer_first(earlier, later) {
      this.sort_count++
      return sorting.newer_first(earlier, later)
    },
    older_first(earlier, later) {
      this.sort_count++
      return sorting.older_first(earlier, later)
    }
  }
}
