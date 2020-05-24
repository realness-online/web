<style src="@/style/index.styl" lang="stylus"></style>
<template lang="html">
  <main id="realness" :class="status">
    <router-view />
    <developer-tools />
  </main>
</template>
<script>
  import developerTools from '@/components/developer-tools'
  import { Me } from '@/persistance/Storage'
  import * as firebase from 'firebase/app'
  export default {
    components: {
      developerTools
    },
    computed: {
      status () {
        return ~navigator.online ? null : 'offline'
      }
    },
    watch: {
      '$route' (to, from) {
        sessionStorage.previous = from.path
      }
    },
    created () {
      firebase.initializeApp({
        apiKey: process.env.VUE_APP_API_KEY,
        authDomain: process.env.VUE_APP_AUTH_DOMAIN,
        databaseUrl: process.env.VUE_APP_DATABASE_URL,
        projectId: process.env.VUE_APP_PROJECT_ID,
        storageBucket: process.env.VUE_APP_STORAGE_BUCKET,
        messagingSenderId: process.env.VUE_APP_MESSAGING_SENDER_ID
      })
      firebase.auth().onAuthStateChanged(this.init_me)
    },
    methods: {
      init_me (user) {
        // guarantees that me gets set in localstorage
        const me = new Me()
        return me
      }
    }
  }
</script>
<style lang="stylus">
  main.offline
    border: (base-line * .333) solid yellow
    border-radius: base-line
</style>
