export default {
  as_id(post) {
    return `${post.person.id}/${post.created_at}`
  }
}
