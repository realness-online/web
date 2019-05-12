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
        me: person_storage.as_object()
      }
    },
    created() {
      if (!sessionStorage.getItem('profile_synced')) {
        firebase.auth().onAuthStateChanged(user => {
          if (user) {
            const id = profile_id.from_e64(user.phoneNumber)
            profile_id.load(id).then(profile => {
              this.me = profile
              this.me.id = id
            })
          }
        })
      }
    },
    watch: {
      me() {
        Vue.nextTick(() => {
          person_storage.save().then(message => {
            sessionStorage.setItem('profile_synced', Date.now)
            console.log('profile_synced')
          })
        })
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
