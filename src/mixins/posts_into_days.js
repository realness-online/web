// const a_year_ago = new Date().getFullYear() - 1
import sorting from '@/modules/sorting'
export default {
  data() {
    return {
      sort_count: 0,
      chronological: false
    }
  },
  methods: {
    populate_days(posts, person, days = new Map() ) {
      const condensed = this.condense_posts(posts, person)
      condensed.forEach(post => this.insert_post_into_day(post, days))
      return days
    },
    is_today(date) {
      if (date.indexOf('Today') > -1) return true
      else return false
    },
    insert_post_into_day(post, days) {
      const day_name = post.created_at.split('T', 1)[0]
      const day = days.get(day_name)
      if (day) {
        day.push(post) // TODO: play around with what's the fastest sorting unshift or push etc
        if (this.chronological || day === this.today) day.sort(this.newer_first)
        else day.sort(this.older_first)
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
