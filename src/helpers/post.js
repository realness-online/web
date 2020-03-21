export default {
  as_statement (post) {
    if (post.articleBody) {
      return post.articleBody
    }
    return post.statement
  },
  as_id (post, person) {
    post.id = `${person.id}/${post.created_at}`
    this.check_oldest(post, person)
    return post.id
  },
  check_oldest (post, person) {
    const current = person.oldest_post
    if (!current || (post.created_at < current)) person.oldest_post = post.created_at
  }
}
