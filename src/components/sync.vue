<template lang="html">
  <div ref="sync" hidden>
    <as-days v-if="statements" v-slot="thoughts"
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
      statements_id () {
        return `${localStorage.me}/statements`
      }
    },
    mounted () {
      firebase.auth().onAuthStateChanged(this.sync)
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
          this.sync_statements()
        }
      },
      async sync_statements () {
        const statements = new Statements()
        this.statements = await statements.sync()
        await this.$nextTick()
        const synced_statements = this.$el.querySelector(`[itemid="${this.statements_id}"]`)
        if (synced_statements) {
          const index = await get('index')
          if (index) {
            const current_hash = parseInt(index[this.statements_id])
            const new_hash = hash(synced_statements.outerHTML)
            if (current_hash !== new_hash) {
              statements.save()
              localStorage.removeItem('/+/statements')
              set('index', index)
            }
          } else await set('index', {})
        }
        this.statements = null
      }
    }
  }
</script>
