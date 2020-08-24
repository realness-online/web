<template lang="html">
  <div ref="sync" hidden>
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
  import hash from '@/modules/hash'
  import { set, get } from 'idb-keyval'
  import profile from '@/helpers/profile'
  import as_days from '@/components/as-days'
  import thought_as_article from '@/components/statements/as-article'
  import {
    Statements
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
        return `${localStorage.me}/statements`
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
        if (current_user) {
          localStorage.me = profile.from_e64(current_user.phoneNumber)
          this.syncer.postMessage('signed-in')
          this.sync_statements()
          this.syncer.postMessage('local-synced')
        } else this.syncer.postMessage('signed-out')
      },
      async sync_statements () {
        const index = get('index')
        const statements = new Statements()
        this.statements = await statements.sync()
        await this.$nextTick()
        const synced_statements = this.$el.querySelector(`[itemid="${this.statements_id}"]`)
        if (synced_statements) {
          console.log(synced_statements)
          const hash_code = hash(synced_statements.outerHTML)
          if (index.statements_hash && index.statements_hash !== hash_code) {
            statements.save(this.$refs.statement_item)
            localStorage.removeItem('/+/statements')
            set('index', index)
          }
        }
      },
      worker_message (message) {
        console.log(`message:${message}`)
      }
    }
  }
</script>
