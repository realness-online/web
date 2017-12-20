<template>
  <section id="posts" itemprop="posts" itemscope itemtype="http://schema.org/blog">
    <article v-for="post in posts" itemscope itemtype="http://schema.org/SocialMediaPosting">
      <header><time itemprop="created_at" :datetime="post.created_at"></time></header>
      <blockquote itemprop="articleBody">{{post.articleBody}}</blockquote>
    </article>
  </section>
</template>

<script>
  import Vue from 'vue'
  import {posts_storage} from '../modules/Storage'

  export default {
    props: ['posts'],
    watch: {
      posts() {
        Vue.nextTick(() => {
          posts_storage.save()
        })
      }
    }

  }
</script>
