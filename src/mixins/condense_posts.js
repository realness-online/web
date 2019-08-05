import post_helper from '@/helpers/post'
export default {
  data() {
    return {
      thirteen_minutes: 1000 * 60 * 13
    }
  },
  methods: {
    condense_posts(posts, person) {
      const condensed_posts = []
      while (posts.length > 0) {
        this.sort_count++
        const post = posts.shift()
        post_helper.as_id(post, person)
        post.statements = []
        while (this.is_train_of_thought(post, posts)) {
          const next_statement = posts.shift()
          post.statements.push(next_statement)
        }
        post.statements.sort(this.older_first)
        condensed_posts.push(post)
      }
      return condensed_posts
    },
    is_train_of_thought(post, posts) {
      this.sort_count++
      const next_post = posts[0]
      if (next_post) {
        let last_post = post
        // console.log('last_post', last_post);
        if (post.statements.length > 0) last_post = post.statements[0]
        const difference = Date.parse(last_post.created_at) - Date.parse(next_post.created_at)
        // console.log(this.thirteen_minutes, difference, (difference < this.thirteen_minutes));
        if (difference < this.thirteen_minutes) return true
        else return false
      } else return false
    }
  }
}
