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
  import * as firebase from 'firebase/app'
  export default {
    components: {
      'developer-tools': developer_tools,
      'activity-as-table': activity
    },
    data () {
      return {
        status: null
      }
    },
    computed: {
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
      window.addEventListener('online', this.online)
      window.addEventListener('offline', this.offline)
      firebase.initializeApp({
        apiKey: process.env.VUE_APP_API_KEY,
        authDomain: process.env.VUE_APP_AUTH_DOMAIN,
        databaseUrl: process.env.VUE_APP_DATABASE_URL,
        projectId: process.env.VUE_APP_PROJECT_ID,
        storageBucket: process.env.VUE_APP_STORAGE_BUCKET,
        messagingSenderId: process.env.VUE_APP_MESSAGING_SENDER_ID
      })
    },
    beforeDestroy () {
      window.removeEventListener('online', this.online)
      window.removeEventListener('offline', this.offline)
    },
    methods: {
      online () {
        this.status = null
      },
      offline () {
        this.status = 'offline'
      }
    }
  }
</script>
<style lang="stylus">
  main.offline
    border: (base-line * .333) solid yellow
    border-radius: base-line
</style>
