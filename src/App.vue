<style src="@/style/index.styl" lang="stylus"></style>
<template lang="html">
  <main id="realness" :class="status">
    <router-view />
    <aside v-if="production_mode">
      <activity-as-table />
    </aside>
    <aside v-else>
      <developer-tools />
    </aside>
  </main>
</template>
<script>
  import developer_tools from '@/components/developer-tools'
  import activity from '@/components/activity/as-table'
  import { Me } from '@/persistance/Storage'
  import * as firebase from 'firebase/app'
  export default {
    components: {
      'developer-tools': developer_tools,
      'activity-as-table': activity
    },
    computed: {
      status () {
        return ~navigator.online ? null : 'offline'
      },
      production_mode () {
        return process.env.NODE_ENV === 'production'
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
        return new Me() // guarantees that me gets set in localstorage
      }
    }
  }
</script>
<style lang="stylus">
  main.offline
    border: (base-line * .333) solid yellow
    border-radius: base-line
</style>
