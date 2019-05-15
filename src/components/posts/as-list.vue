<template>
  <div itemprop="posts" itemref="profile">
    <article v-for="post in posts" itemscope itemtype="/post">
      <time itemprop="created_at" :datetime="post.created_at">Calculating...</time>
      <blockquote itemprop="articleBody">{{post.articleBody}}</blockquote>
    </article>
  </div>
</template>
<script>
  export default {
    props: {
      posts: Array
    }
  }
</script>
<style lang="stylus">
  div[itemprop="posts"]
    display:flex
    flex-direction: column-reverse
    & > article
      margin-bottom: base-line
</style>
