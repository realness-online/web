<template>
  <div itemprop="posts" itemref="profile">
    <article v-for="post in posts" itemscope itemtype="/post" :key="post.created_at" v-bind:class="{silent: post.muted}">
      <header v-if="me">
        <menu>
          <a @click="toggle_post(post)">
            <icon v-if="post.muted" name="add"></icon>
            <icon v-else name="remove"></icon>
          </a>
        </menu>
      </header>
      <meta itemprop="muted" :content="post.muted">
      <time itemprop="created_at" :datetime="post.created_at">{{created_day_and_time(post.created_at)}}</time>
      <blockquote :contenteditable="me" @blur="save_me" itemprop="articleBody">{{post.articleBody}}</blockquote>
    </article>
  </div>
</template>
<script>
  import Vue from 'vue'
  import {posts_storage} from '@/modules/Storage'
  import icon from '@/components/icon'
  import time_ago from '@/modules/time_ago'
  import posts_into_days from '@/mixins/posts_into_days'
  export default {
    mixins: [posts_into_days],
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
    created(){
      time_ago()
    },
    methods: {
      save_me(){
        console.log('save_me()')
        Vue.nextTick(() => posts_storage.save())
      },
      toggle_post(post) {
        post.muted = !post.muted
        this.save_me()
      }
    }
  }
</script>
<style lang="stylus">
  div[itemprop="posts"]
    display:flex
    flex-direction: column-reverse
    & > article
      margin-bottom: base-line
      & > header
        float:left
        shape-outside: circle()
        clip-path: circle(50%)
        & > menu svg
          padding-right: (base-line / 6)
          height: base-line
          width: base-line
          fill: white
      & > blockquote
        display: inline-block
        width:100%
      &.silent
        time
        blockquote
          color: white
</style>
