<template lang="html">
  <main id="realness" :class="status">
    <router-view v-if="!working" :statement.sync="statement" :person.sync="me" />
    <aside v-if="!working">
      <developer-tools v-if="!is_production" />
      <sync :statement.sync="statement" :person.sync="me" @active="sync_active" />
    </aside>
  </main>
</template>
<script>
  import firebase from 'firebase/app'
  import { get, set } from 'idb-keyval'
  import developer_tools from '@/components/developer-tools'
  import sync from '@/components/sync'
  export default {
    components: {
      sync,
      'developer-tools': developer_tools
    },
    data () {
      return {
        working: true,
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
        await set('firebase-keys', await response.json())
      } else set('firebase-keys', this.firebase_keys)
      firebase.initializeApp(await get('firebase-keys'))
      window.addEventListener('online', this.online)
      window.addEventListener('offline', this.offline)
      this.working = false
    },
    beforeDestroy () {
      window.removeEventListener('online', this.online)
      window.removeEventListener('offline', this.offline)
    },
    methods: {
      sync_active (active) {
        if (active) this.status = 'working'
        else this.status = null
      },
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
<style src="@/style/index.styl" lang="stylus"></style>
<style lang="stylus">
  main
    border: (base-line / 16) solid background-black
    border-radius (base-line / 16)
  main.offline
    border-color: yellow
  main.working
    border-color: green
    animation-name: pulsing
    animation-duration: 8s
    animation-delay: 200ms
    animation-iteration-count: infinite
</style>
