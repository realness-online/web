// const a_year_ago = new Date().getFullYear() - 1
import sorting from '@/modules/sorting'
export default {
  data() {
    return {
      sort_count: 0,
      chronological: false,
      days: new Map()
    }
  },
  methods: {
    posts_into_days() {
      this.posts.forEach(this.insert_post_into_day)
    },
    insert_post_into_day(post) {
      this.sort_count++
      const day_name = this.created_day(post.created_at)
      const day = this.days.get(day_name)
      if (day) {
        // TODO: play around with what's the fastest sorting unshift or push etc
        day.push(post)
        if (this.chronological || day === this.today) {
          day.sort(this.newer_first)
        } else {
          day.sort(this.older_first)
        }
      } else {
        this.days.set(day_name, [post])
      }
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
