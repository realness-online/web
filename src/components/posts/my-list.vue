<template>
  <posts-list :me="true" :posts='posts'></posts-list>
</template>
<script>
  import Vue from 'vue'
  import { posts_storage } from '@/modules/Storage'
  import postsList from '@/components/posts/as-list'
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  export default {
    components: {
      postsList
    },
    data() {
      return {
        posts: posts_storage.as_list()
      }
    },
    methods: {
      add_post(post) {
        this.posts.push(post)
        Vue.nextTick(async() => {
          await posts_storage.save()
          await posts_storage.optimize()
          this.posts = posts_storage.as_list()
        })
      }
    },
    created() {
      this.$bus.$on('post-added', post => this.add_post(post))
      const last_synced = sessionStorage.getItem('posts-synced')
      const five_minutes_ago = Date.now() - (1000 * 60 * 5)
      if (!last_synced || five_minutes_ago > last_synced) {
        firebase.auth().onAuthStateChanged(user => {
          if (user) {
            posts_storage.sync_list().then(items => {
              this.posts = items
              sessionStorage.setItem('posts-synced', Date.now())
              Vue.nextTick(_ => posts_storage.save())
              console.log('posts synced')
            })
          }
        })
      }
    },
    watch: {
      posts() {
        // Vue.nextTick(_ => posts_storage.save())
      }
    }
  }
</script>
