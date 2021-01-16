<template lang="html">
  <main id="realness" :class="status">
    <router-view :statement.sync="statement" :person.sync="me" />
    <aside>
      <activity-as-table v-if="is_production" />
      <developer-tools v-else />
      <sync :statement.sync="statement" :person="me" />
    </aside>
  </main>
</template>
<script>
  import firebase from 'firebase/app'
  import { del } from 'idb-keyval'
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
        me: null,
        statement: null,
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
      is_production () {
        return process.env.NODE_ENV === 'production'
      }
    },
    watch: {
      '$route' (to, from) {
        sessionStorage.previous = from.path
      }
    },
    async created () {
      if (this.is_production) {
        const response = await fetch('__/firebase/init.json')
        firebase.initializeApp(await response.json())
      } else firebase.initializeApp(this.firebase_keys)
      del('sync:peer-connected')
      window.addEventListener('online', this.online)
      window.addEventListener('offline', this.offline)

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
        // TODO: this could potentally override
        // other components intentionally having this set false
        // we can fix this by setting a class variable for any contenteditable
        // we change and than only flip those guys back to editable
        // this is not a big deal now as I remove contenteditable rather than
        // set it false
        const editable = document.querySelectorAll('[contenteditable]')
        editable.forEach(e => e.setAttribute('contenteditable', false))
        this.status = 'offline'
      }
    }
  }
</script>
<style src="@/style/index.styl" lang="stylus"></style>
<style lang="stylus">
  main.offline
    border: (base-line * .333) solid yellow
    border-radius: (base-line / 6)
</style>
