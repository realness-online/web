<template>
  <posts-list :posts='posts'></posts-list>
</template>
<script>
  import Vue from 'vue'
  import {posts_storage} from '@/modules/Storage'
  import postsList from '@/components/posts/as-list'
  export default {
    components: {
      postsList
    },
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

      if (!sessionStorage.getItem('posts_synced')) {
        posts_storage.sync_list().then((items) => {
          this.posts = items
          sessionStorage.setItem('posts_synced|', 'true')
          console.log('posts synced')
        })
      }
    },
    watch: {
      posts() {
        Vue.nextTick(() => posts_storage.save())
      }
    }
  }
</script>
