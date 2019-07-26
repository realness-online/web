<template>
  <div id="pages-of-posts">
    <posts-list v-for="page in pages" :me="true" :posts='page'></posts-list>
  </div>
</template>
<script>
  import Vue from 'vue'
  import { posts_storage } from '@/modules/Storage'
  import growth from '@/modules/growth'
  import postsList from '@/components/posts/as-list'
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  const options = { rootMargin: '0px 0px 64px 0px' }
  export default {
    components: {
      postsList
    },
    data() {
      return {
        pages: [],
        observer: new IntersectionObserver(this.load_more_posts, options),
        limit: growth.first()
      }
    },
    async created() {
      this.$bus.$on('post-added', post => this.add_post(post))
      this.pages.push(await posts_storage.as_list())
      this.sync_posts(firebase.auth().currentUser)
    },
    updated() {
      Vue.nextTick(() => this.observe_posts())
    },
    beforeDestroy(){
      this.observer.disconnect()
    },
    methods: {
      add_post(post) {
        if (this.pages[0]) {
          this.pages[0].push(post)
        }
        else {
          const recent_posts = []
          recent_posts.push(post)
          this.pages[0] = recent_posts
        }
        Vue.nextTick(async() => {
          await posts_storage.save()
          await posts_storage.optimize()
        })
      },
      async sync_posts(firebase_user) {
        const last_synced = sessionStorage.getItem('posts-synced')
        const five_minutes_ago = Date.now() - (1000 * 60 * 5)
        if (firebase_user && five_minutes_ago > last_synced) {
          this.posts = await posts_storage.sync_list()
          sessionStorage.setItem('posts-synced', Date.now())
          Vue.nextTick(_ => posts_storage.save())
          console.log('posts synced')
        }
      },
      observe_posts() {
        this.observer.disconnect()
        const selector = '[itemprop=posts]:last-of-type > .day:first-of-type > article:first-of-type'
        const article = this.$el.querySelector(selector)
        if (article) this.observer.observe(article);
      },
      async load_more_posts(entries) {
        entries.forEach(async entry => {
          if (entry.isIntersecting) {
            this.observer.unobserve(entry.target)
            const older_posts = await posts_storage.next_list(this.limit)
            if (older_posts.length > 0) {
              this.pages.push(older_posts)
              this.limit = growth.next(this.limit)
            }
          }
        })
      }
    }
  }
</script>
