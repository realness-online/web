<template>
  <section id="home" class="page">
    <h6 class="app_version">{{version}}</h6>
    <main-nav @new-post="add_post"></main-nav>
    <aside>
      <my-figure :person="me"></my-figure>
      <div itemprop="posts">
        <as-article v-for="post in posts" :post="post" :person="me" :key="as_id(post)"></as-article>
      </div>
    </aside>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import profile_helper from '@/helpers/profile'
  import post_helper from '@/helpers/post'
  import { person_local, posts_local } from '@/modules/LocalStorage'
  import main_nav from '@/components/main-nav'
  import as_figure from '@/components/profile/as-figure'
  import as_article from '@/components/posts/as-article'
  export default {
    components: {
      'main-nav': main_nav,
      'my-figure': as_figure,
      'as-article': as_article
    },
    data() {
      return {
        five_minutes_ago: Date.now() - (1000 * 60 * 5),
        version: process.env.VUE_APP_VERSION,
        me: person_local.as_object(),
        posts: posts_local.as_list()
      }
    },
    created() {
      this.$bus.$on('post-added', this.add_post)
    },
    async mounted() {
      await Promise.all([
        this.sync_posts(),
        this.sync_profile()
      ])
    },
    methods: {
      as_id(post) {
        return post_helper.as_id(post, this.me)
      },
      add_post(post) {
        this.posts.push(post)
        this.$nextTick(async() => {
          await posts_local.save()
          await posts_local.optimize()
          this.posts = posts_local.as_list()
        })
      },
      should_sync(last_synced) {
        const user = firebase.auth().currentUser
        if (!last_synced || (user && this.five_minutes_ago > last_synced)) {
          return true
        }
        return false
      },
      async sync_profile() {
        if (this.should_sync(sessionStorage.getItem('profile-synced'))) {
          const user = firebase.auth().currentUser
          if (user) {
            const id = profile_helper.from_e64(user.phoneNumber)
            this.me = await profile_helper.load(id)
            this.$nextTick(async() => {
              await person_local.save()
              sessionStorage.setItem('profile-synced', Date.now())
            })
          }
        }
      },
      async sync_posts() {
        if (this.should_sync(sessionStorage.getItem('posts-synced'))) {
          this.posts = await posts_local.sync_list()
          this.$nextTick(async() => {
            await posts_local.save()
            sessionStorage.setItem('posts-synced', Date.now())
          })
        }
      }
    }
  }
</script>
<style lang="stylus">
  section#home.page
    padding: base-line
    height:100vh
    display: flex
    align-items: center
    margin:auto
    max-width: page-width
    & > h6.app_version
      margin: 0
      position: fixed
      bottom: (base-line / 2)
      left: (base-line / 2)
</style>
