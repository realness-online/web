<template>
  <div itemprop="feed" itemref="profile">
    <article v-for="post in feed" itemscope itemtype="/post">
      <header>
        <profile-as-figure :person='post.person'></profile-as-figure>
      </header>
      <blockquote itemprop="articleBody">{{post.articleBody}}</blockquote>
      <time itemprop="created_at" :datetime="post.created_at">calculating...</time>
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
  @require '../../style/variables'
  div[itemprop="posts"]
    margin-top: base-line
    display:flex
    flex-direction: column-reverse
    & > article
      margin-bottom: base-line
      & > time
        display: block
        cursor: default;
        transition: opacity 0.25s
        opacity: 0.5
        &:active
          transition: opacity 0.24s
          opacity: 1
      & > blockquote
        cursor: default
        white-space: pre-wrap
</style>
