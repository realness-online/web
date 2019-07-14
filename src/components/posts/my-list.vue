<template>
  <posts-list :me="true" :posts='posts'></posts-list>
</template>
<script>
  import Vue from 'vue'
  import { posts_storage } from '@/modules/Storage'
  import growth from '@/modules/growth'
  import postsList from '@/components/posts/as-list'
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  export default {
    components: {
      postsList
    },
    data() {
      return {
        posts: posts_storage.as_list(),
        observer: new IntersectionObserver(this.load_more_posts, {}),
        limit: growth.first()
      }
    },
    created() {
      this.$bus.$on('post-added', post => this.add_post(post))
      firebase.auth().onAuthStateChanged(this.sync_posts)
    },
    mounted() {
      this.observe_posts()
    },
    methods: {
      add_post(post) {
        this.posts.push(post)
        Vue.nextTick(async() => {
          await posts_storage.save()
          await posts_storage.optimize()
          this.posts = posts_storage.as_list()
        })
      },
      async sync_posts(user) {
        const last_synced = sessionStorage.getItem('posts-synced')
        const five_minutes_ago = Date.now() - (1000 * 60 * 5)
        if (user && !last_synced || five_minutes_ago > last_synced) {
          this.posts = await posts_storage.sync_list()
          sessionStorage.setItem('posts-synced', Date.now())
          Vue.nextTick(_ => posts_storage.save())
          console.log('posts synced')
        }
      },
      observe_posts() {
        const selector = '[itemprop=posts] > .day:first-of-type > article:first-of-type'
        const article = document.querySelector(selector)
        if (article) this.observer.observe(article);
      },
      load_more_posts(event) {
        if (event[0].isIntersecting) {
          console.log('isIntersecting', event)
          this.observer.unobserve(event[0].target)
          const more_posts = posts_storage.next_list(this.limit)
          if (more_posts.length > 0) {
            this.posts = [ ...this.posts, ...more_posts ]
            this.limit = growth.next(this.limit)
            Vue.nextTick(_ => this.observe_posts())
          }
        }
      }
    }
  }
</script>
