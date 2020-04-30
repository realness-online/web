export const thirteen_minutes = 1000 * 60 * 13
export function as_thoughts (posts, person) {
  const thoughts = []
  while (posts.length > 0) {
    const post = posts.shift()
    post.statements = []
    while (is_train_of_thought(post, posts)) {
      post.statements.push(posts.shift())
    }
    post.person = person
    thoughts.push(post)
  }
  return thoughts
},
export function is_train_of_thought (post, posts) {
  const next_post = posts[0]
  if (next_post) {
    let last_post = post
    const length = post.statements.length
    if (length > 0) last_post = post.statements[length - 1]
    const last = Date.parse(last_post.created_at)
    const next = Date.parse(next_post.created_at)
    const difference = next - last
    if (difference < thirteen_minutes) return true
    else return false
  } else return false
}

export default as_thoughts
