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
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import developer_tools from '@/components/developer-tools'
  import activity from '@/components/activity/as-table'
  import profile from '@/helpers/profile'
  export default {
    components: {
      'developer-tools': developer_tools,
      'activity-as-table': activity
    },
    data () {
      return {
        status: null,
        worker: new Worker('/sync.worker.js'),
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
      this.worker.addEventListener('message', this.worker_message)
      window.addEventListener('online', this.online)
      window.addEventListener('offline', this.offline)
      firebase.initializeApp(this.firebase_keys)
      firebase.auth().onAuthStateChanged(this.sync)
    },
    beforeDestroy () {
      window.removeEventListener('online', this.online)
      window.removeEventListener('offline', this.offline)
      this.worker.terminate()
    },
    methods: {
      online () {
        this.sync(firebase.auth().currentUser)
        this.status = null
      },
      offline () {
        this.status = 'offline'
      },
      sync (current_user) {
        // console.log('calling sync', new Date(), current_user)
        if (current_user) {
          const me = profile.from_e64(current_user.phoneNumber)
          localStorage.setItem('me', me)
          // this.worker.postMessage('sync message')
        } else localStorage.setItem('me', '/+')
      },
      worker_message (message) {
        console.log('worker message!', message)
      }
    }
  }
</script>
<style lang="stylus">
  main.offline
    border: (base-line * .333) solid yellow
    border-radius: base-line
</style>
