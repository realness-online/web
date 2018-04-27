<template>
  <div itemprop="posts" id="posts" itemref="profile">
    <article v-for="post in posts" itemscope itemtype="http://schema.org/SocialMediaPosting">
      <blockquote itemprop="articleBody">{{post.articleBody}}</blockquote>
      <footer><time itemprop="created_at" :datetime="post.created_at">calculating...</time></footer>
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
    },
    watch: {
      posts() {
        Vue.nextTick(() => {
          posts_storage.save()
        })
      }
    }
  }
</script>

<style lang="stylus">
  @require '../style/variables'
  div[itemprop="posts"]
    display:flex
    flex-direction: column-reverse
    & > article
      margin-bottom: base-line
      & > footer > time
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
