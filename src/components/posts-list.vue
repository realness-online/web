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
  import Item from '@/modules/Item'
  import Storage from '@/modules/Storage'
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
      this.$bus.$on('signed-in', user => {
        this.sync()
      })
    },
    methods: {
      sync() {
        posts_storage.get_download_url().then(url => {
          fetch(url).then(response => {
            response.text().then(server_text => {
              const server_as_fragment = Storage.hydrate(server_text)
              let from_server = Item.get_items(server_as_fragment)
              let filtered_local = posts_storage.as_list().filter(local_item => {
                return !from_server.some(server_item => {
                  return local_item.created_at === server_item.created_at
                })
              })
              let items = [...filtered_local, ...from_server]
              items.sort((a,b) => {
                let a_date = Date.parse(a.created_at)
                let b_date = Date.parse(b.created_at)
                return a_date - b_date
              })
              this.posts = items
            })
          })
        })
      }
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
