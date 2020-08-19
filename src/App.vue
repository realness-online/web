<style src="@/style/index.styl" lang="stylus"></style>
<template lang="html">
  <main id="realness" :class="status">
    <router-view />
    <aside>
      <activity-as-table v-if="production_mode" />
      <developer-tools v-else />
      <sync />
    </aside>
  </main>
</template>
<script>
  import * as firebase from 'firebase/app'
  import developer_tools from '@/components/developer-tools'
  import sync from '@/components/sync'
  import activity from '@/components/activity/as-table'
  export default {
    components: {
      sync,
      'developer-tools': developer_tools,
      'activity-as-table': activity
    },
    data () {
      return {
        status: null,
        firebase_keys: {
          apiKey: process.env.VUE_APP_API_KEY,
          authDomain: process.env.VUE_APP_AUTH_DOMAIN,
          databaseUrl: process.env.VUE_APP_DATABASE_URL,
          projectId: process.env.VUE_APP_PROJECT_ID,
          storageBucket: process.env.VUE_APP_STORAGE_BUCKET,
          messagingSenderId: process.env.VUE_APP_MESSAGING_SENDER_ID
        }
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
      firebase.initializeApp(this.firebase_keys)
      if (!navigator.onLine) this.offline()
    },
    beforeDestroy () {
      window.removeEventListener('online', this.online)
      window.removeEventListener('offline', this.offline)
    },
    methods: {
      online () {
        const editable = document.querySelectorAll('[contenteditable]')
        editable.forEach(e => e.setAttribute('contenteditable', true))
        this.status = null
      },
      offline () {
        const editable = document.querySelectorAll('[contenteditable]')
        editable.forEach(e => e.setAttribute('contenteditable', false))
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
