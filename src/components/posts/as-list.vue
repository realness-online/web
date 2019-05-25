<template>
  <div itemprop="posts" itemref="profile">
    <section class="day" v-for="day in days" v-bind:class="{today: is_today(day)}" >
      <header>
        <h4>{{day[0]}}</h4>
      </header>
      <article v-for="post in day[1]" itemscope itemtype="/post" :key="post.created_at" v-bind:class="{silent: post.muted}">
        <header v-if="me">
          <menu>
            <a @click="toggle_post(post)">
              <icon v-if="post.muted" name="add"></icon>
              <icon v-else name="remove"></icon>
            </a>
          </menu>
        </header>
        <meta itemprop="muted" :content="post.muted">
        <time itemprop="created_at" :datetime="post.created_at">{{created_time(post.created_at)}}</time>
        <blockquote :contenteditable="me" @blur="save_me" itemprop="articleBody">{{post.articleBody}}</blockquote>
      </article>
    </section>
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
    data(){
      return {
        days: null
      }
    },
    created(){
      console.clear()
      this.days = this.posts_into_days(this.posts, true)
      console.info(`${this.posts.length} feed items`)
      console.info(`${this.sort_count} sort operations`)
    },
    watch: {
      posts() {
        this.days = this.posts_into_days(this.posts, true)
      }
    },
    methods: {
      is_today(day) {
        console.log(day[0].indexOf('Today'))
        if(day[0].indexOf('Today') > -1) {
          return true
        } else {
          return false
        }
      },
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

    & > section.day
      display:flex
      flex-direction: column
      &.today
        flex-direction: column-reverse
        & > header
          order: 1
      & > header > h4
        margin-top: base-line
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
