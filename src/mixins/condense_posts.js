import post_helper from '@/helpers/post'
export default {
  data() {
    return {
      thirteen_minutes: 1000 * 60 * 13,
      include_muted: false
    }
  },
  methods: {
    shift_mute(posts) {
      let post = posts.shift()
      if (this.include_muted) return post
      else {
        while (post.muted) {
          this.sort_count++
          post = posts.shift()
        }
        return post
      }
    },
    condense_posts(posts, person) {
      const condensed_posts = []
      while (posts.length > 0) {
        this.sort_count++
        let post = this.shift_mute(posts)
        post_helper.as_id(post, person)
        post.statements = []
        while (this.is_train_of_thought(post, posts)) {
          this.sort_count++
          const next_statement = posts.shift()
          if (!next_statement.muted) post.statements.push(next_statement)
        }
        post.statements.sort(this.older_first)
        post.person = person // hack for Feed.vue
        condensed_posts.push(post)
      }
      return condensed_posts
    },
    is_train_of_thought(post, posts) {
      this.sort_count++
      const next_post = posts[0]
      if (next_post) {
        let last_post = post
        if (post.statements.length > 0) last_post = post.statements[0]
        const last = Date.parse(last_post.created_at)
        const next = Date.parse(next_post.created_at)
        const difference = next - last
        if (difference < this.thirteen_minutes) return true
        else return false
      } else return false
    }
  }
}
