<template>
  <main id="realness" :class="status">
    <router-view
      v-if="!working"
      v-model:statement="statement"
      v-model:person="me" />
    <aside v-if="!working">
      <sync v-model:statement="statement" :person="me" @active="sync_active" />
    </aside>
  </main>
</template>
<script>
  import firebase from 'firebase/compat/app'
  import { get, set } from 'idb-keyval'
  import sync from '@/components/sync'
  export default {
    components: { sync },
    data() {
      return {
        working: true,
        me: null,
        statement: null,
        status: null
      }
    },
    computed: {
      is_production() {
        return import.meta.env.NODE_ENV === 'production'
      }
    },
    async created() {
      if (this.is_production) {
        const response = await fetch('__/firebase/init.json')
        await set('firebase-keys', await response.json())
      } else {
        const keys = {
          apiKey: import.meta.env.VITE_API_KEY,
          authDomain: import.meta.env.VITE_AUTH_DOMAIN,
          databaseUrl: import.meta.env.VITE_DATABASE_URL,
          projectId: import.meta.env.VITE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID
        }
        await set('firebase-keys', keys)
      }
      firebase.initializeApp(await get('firebase-keys'))
      window.addEventListener('online', this.online)
      window.addEventListener('offline', this.offline)
      this.working = false
    },
    beforeUnMount() {
      window.removeEventListener('online', this.online)
      window.removeEventListener('offline', this.offline)
    },
    methods: {
      sync_active(active) {
        if (active) this.status = 'working'
        else this.status = null
      },
      online() {
        const editable = document.querySelectorAll('[contenteditable]')
        editable.forEach(e => e.setAttribute('contenteditable', true))
        this.status = null
      },
      offline() {
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
    border: (base-line / 16) solid transparent
    border-radius (base-line / 16)
    &.offline
      border-color: yellow
    &.working
      border-color: green
      animation-name: pulsing
      animation-duration: 5s
      animation-delay: 200ms
      animation-iteration-count: infinite
</style>
