import post_helper from '@/helpers/post'
export default {
  data () {
    return {
      thirteen_minutes: 1000 * 60 * 13
    }
  },
  methods: {
    condense_posts (posts, person) {
      const condensed_posts = []
      while (posts.length > 0) {
        this.sort_count++
        const post = posts.shift()
        post_helper.as_id(post, person)
        post.statements = []
        while (this.is_train_of_thought(post, posts)) {
          this.sort_count++
          post.statements.push(posts.shift())
        }
        post.person = person
        condensed_posts.push(post)
      }
      return condensed_posts
    },
    is_train_of_thought (post, posts) {
      this.sort_count++
      const next_post = posts[0]
      if (next_post) {
        let last_post = post
        const length = post.statements.length
        if (length > 0) last_post = post.statements[length - 1]
        const last = Date.parse(last_post.created_at)
        const next = Date.parse(next_post.created_at)
        const difference = next - last
        if (difference < this.thirteen_minutes) return true
        else return false
      } else return false
    }
  }
}
