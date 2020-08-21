<template lang="html">
  <div hidden>
    <as-days v-slot="thoughts"
             itemscope
             :itemid="statements_id"
             :statements="statements">
      <thought-as-article v-for="thought in thoughts"
                          :key="thought[0].id"
                          :statements="thought" />
    </as-days>
  </div>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import profile from '@/helpers/profile'
  import as_days from '@/components/as-days'
  import thought_as_article from '@/components/statements/as-article'
  import {
    Statements,
    Events
  } from '@/persistance/Storage'
  export default {
    components: {
      'as-days': as_days,
      'thought-as-article': thought_as_article
    },
    data () {
      return {
        syncer: new Worker('/sync.worker.js'),
        posters: null,
        statements: null,
        events: null
      }
    },
    computed: {
      statements_changed () {
        return true
      },
      statements_id () {
        return `${this.me}/statements`
      }
    },
    created () {
      console.log('sync component loaded')
      firebase.auth().onAuthStateChanged(this.sync)
      this.syncer.addEventListener('message', this.worker_message)
      window.addEventListener('online', this.online)
    },
    beforeDestroy () {
      console.log('sync component destroyed')
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
          this.syncer.postMessage('signed-in')
          if (this.statements_changed) this.sync_statements()
        } else this.syncer.postMessage('signed-out')
      },
      async sync_statements () {
        const statements = new Statements()
        this.statements = await statements.sync()
        console.log('sync_statements', this.statements)
      },
      async sync_events () {
        const events = new Events()
        await events.sync()
        console.log(this.events)
      },
      worker_message (message) {
        console.log(`message:${message}`)
      }
    }
  }
</script>
