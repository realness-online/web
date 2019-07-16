<template>
  <section id="home" class="page">
    <main-nav></main-nav>
    <h6 class="app_version">{{version}}</h6>
    <aside>
      <my-posts></my-posts>
      <my-figure :person="me"></my-figure>
    </aside>
  </section>
</template>
<script>
  import Vue from 'vue'
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import profile_id from '@/modules/profile_id'
  import { person_storage } from '@/modules/Storage'
  import main_nav from '@/components/main-nav'
  import my_posts_as_list from '@/components/posts/my-list'
  import as_figure from '@/components/profile/as-figure'
  export default {
    components: {
      'main-nav': main_nav,
      'my-posts': my_posts_as_list,
      'my-figure': as_figure
    },
    data() {
      return {
        version: process.env.VUE_APP_VERSION,
        me: {}
      }
    },
    async created() {
      this.me = await person_storage.as_object()
      this.sync_profile()
    },
    methods: {
      async sync_profile(firebase_user, me = this.me) {
        const last_synced = sessionStorage.getItem('profile-synced')
        const five_minutes_ago = Date.now() - (1000 * 60 * 5)
        firebase.auth().onAuthStateChanged(await auth)
        async function auth(user) {
          if (user && five_minutes_ago > last_synced) {
            const id = profile_id.from_e64(user.phoneNumber)
            me = await profile_id.load(id)
            Vue.nextTick(async() => {
              await person_storage.save()
              sessionStorage.setItem('profile-synced', Date.now())
              console.log('profile synced')
            })
          }
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
