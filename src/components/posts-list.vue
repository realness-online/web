<template>
  <div itemprop="posts" id="posts" itemref="profile">
    <article v-for="post in posts" itemscope itemtype="http://schema.org/SocialMediaPosting">
      <header><time itemprop="created_at" :datetime="post.created_at">calculating...</time></header>
      <blockquote itemprop="articleBody">{{post.articleBody}}</blockquote>
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
  div[itemprop="posts"]
    display:flex
    flex-direction: column-reverse
    & > article > blockquote
      white-space: pre-wrap
</style>
