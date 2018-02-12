<template>
  <div itemprop="posts" id="posts">
    <article v-for="post in posts" itemscope itemtype="http://schema.org/SocialMediaPosting">
      <header><time itemprop="created_at" :datetime="post.created_at"></time></header>
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
        posts: posts_storage.get_items()
      }
    },
    created: function() {
      this.$bus.$on('post-added', post => {
        this.posts.push(post)
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
