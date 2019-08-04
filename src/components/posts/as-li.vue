<template lang="html">
  <li itemscope itemtype='/post' :itemid="post_id(statement)">
    <time itemprop="created_at" :datetime="statement.created_at">{{created_time(statement.created_at)}}</time>
    <p :contenteditable="me" itemprop="statement">{{get_statement(statement)}}</p>
  </li>
</template>

<script>
export default {
}
</script>

<style lang="css" scoped>
</style>
