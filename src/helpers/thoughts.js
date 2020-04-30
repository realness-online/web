import { as_created_at } from '@/helpers/itemid'
export const thirteen_minutes = 1000 * 60 * 13
export function as_thoughts (posts) {
  const thoughts = []
  while (posts.length) {
    const post = posts.shift()
    const thot = [post]
    while (is_train_of_thought(thot, posts)) {
      thot.push(posts.shift())
    }
    thoughts.push(thot)
  }
  return thoughts
}
export function is_train_of_thought (thot, posts) {
  const next_post = posts[0]
  if (next_post) {
    let last_post = thot[thot.index -1]
    const last = Date.parse(as_created_at(last_post.id))
    const next = Date.parse(as_created_at(last_post.id))
    const difference = next - last
    if (difference < thirteen_minutes) return true
    else return false
  } else return false
}

export default as_thoughts
