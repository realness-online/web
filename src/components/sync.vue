<template lang="html">
  <div hidden>
    <!-- <as-statements />
    <as-posters />
    <as-events /> -->
  </div>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import profile from '@/helpers/profile'
  import {
    Statements,
    Events
  } from '@/persistance/Storage'
  export default {
    data () {
      return {
        syncer: new Worker('/sync.worker.js'),
        statements: null,
        events: null
      }
    },
    created () {
      firebase.auth().onAuthStateChanged(this.sync)
      this.syncer.addEventListener('message', this.worker_message)
      window.addEventListener('online', this.online)
    },
    beforeDestroy () {
      this.syncer.terminate()
    },
    methods: {
      online () {
        this.sync(firebase.auth().currentUser)
      },
      async sync (current_user) {
        console.log('sync auth state change', current_user)
        if (current_user) {
          localStorage.me = profile.from_e64(current_user.phoneNumber)
          const statements = new Statements()
          const events = new Events()
          await Promise.all([
            await statements.sync(),
            await events.sync()
          ])
          this.syncer.postMessage('signed-in')
        } else this.syncer.postMessage('signed-out')
      },
      worker_message (message) {
        console.log(`message:${message}`)
      }
    }
  }
</script>
