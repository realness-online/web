<template>
  <section id="home" class="page">
    <h6 class="app_version">{{version}}</h6>
    <main-nav @new-post="add_post"></main-nav>
    <aside>
      <my-figure :person="me"></my-figure>
      <div id="my-posts">
        <as-article v-for="post in posts" :key="as_id(post)" :post="post" :me="true"></as-article>
      </div>
    </aside>
  </section>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import profile from '@/models/profile_id'
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
        posts: posts_local.as_list(),
        auth: firebase.auth()
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
        return `${person_local.as_object().id}/${post.created_at}`
      },
      add_post(post) {
        this.posts.push(post)
        this.$nextTick(async() => {
          await posts_local.save()
          await posts_local.optimize()
        })
      },
      async sync_profile() {
        const last_synced = sessionStorage.getItem('profile-synced')
        if (this.auth.currentUser && this.five_minutes_ago > last_synced) {
          const id = profile.from_e64(this.auth.currentUser.phoneNumber)
          this.me = await profile.load(id)
          this.$nextTick(async() => {
            await person_local.save()
            sessionStorage.setItem('profile-synced', Date.now())
          })
        }
      },
      async sync_posts() {
        const last_synced = sessionStorage.getItem('posts-synced')
        if (this.auth.currentUser && this.five_minutes_ago > last_synced) {
          this.posts = await posts_local.sync_list()
          sessionStorage.setItem('posts-synced', Date.now())
          this.$nextTick(_ => posts_local.save())
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
