<template>
  <div itemprop="posts" itemref="profile" outline>
    <article v-for="post in posts" itemscope itemtype="/post" :key="post.created_at" v-bind:class="{silent: post.muted}">
      <header v-if="me">
        <menu>
          <a v-if="post.muted" @click="sync_post(post)">
            <icon name="add"></icon>
          </a>
          <a v-else @click="mute_post(post)">
            <icon name="remove"></icon>
          </a>
        </menu>
      </header>
      <meta itemprop="muted" :content="post.muted">
      <time itemprop="created_at" :datetime="post.created_at">Calculating...</time>
      <blockquote itemprop="articleBody">{{post.articleBody}}</blockquote>
    </article>
  </div>
</template>
<script>
  import Vue from 'vue'
  import {posts_storage} from '@/modules/Storage'
  import icon from '@/components/icon'
  export default {
    components: {
      icon
    },
    props: {
      posts: Array,
      me: {
        type: Boolean,
        default: false
      }
    },
    methods: {
      mute_post(post) {
        post.muted = true
        Vue.nextTick(() => posts_storage.save())
      },
      sync_post(post) {
        post.muted = false
        Vue.nextTick(() => posts_storage.save())
      }
    }
  }
</script>
<style lang="stylus">
  div[itemprop="posts"]
    display:flex
    flex-direction: column
    & > article
      margin-bottom: base-line
      & > header
        float:left
        shape-outside: circle()
        clip-path: circle(50%)
        & > menu svg
          // padding: (base-line / 3) 0
          padding-right: (base-line / 6)
          height: base-line
          width: base-line
          fill: white
      &.silent
        time
        blockquote
          color: white
</style>
