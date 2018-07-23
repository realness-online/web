<template>
  <div itemprop="posts" itemref="profile">
    <article v-for="post in posts" itemscope itemtype="/post">
      <blockquote itemprop="articleBody">{{post.articleBody}}</blockquote>
      <time itemprop="created_at" :datetime="post.created_at">calculating...</time>
    </article>
  </div>
</template>
<script>
  import Vue from 'vue'
  import {posts_storage} from '@/modules/Storage'
  export default {
    data() {
      return {
        posts: posts_storage.as_list()
      }
    },
    created: function() {
      localStorage.setItem('posts-count', this.posts.length)
      this.$bus.$on('post-added', post => {
        this.posts.push(post)
        localStorage.setItem('posts-count', this.posts.length)
      })
      this.$bus.$on('signed-in', () => {
        posts_storage.sync_list().then(items => (this.posts = items))
      })
    },
    watch: {
      posts() {
        Vue.nextTick(() => posts_storage.save())
      }
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
