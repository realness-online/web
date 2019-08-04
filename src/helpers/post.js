export default {
  as_statement(post) {
    if (post.articleBody) {
      return post.articleBody
    }
    return post.statement
  },
  as_id(post, person = post.person) {
    return `${person.id}/${post.created_at}`
  }
}
