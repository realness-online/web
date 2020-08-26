<template lang="html">
  <div ref="sync" hidden>
    <as-days v-if="statements" v-slot="thoughts"
             itemscope
             :itemid="itemid('statements')"
             :statements="statements">
      <thought-as-article v-for="thought in thoughts"
                          :key="thought[0].id"
                          :statements="thought" />
    </as-days>
    <events-list v-if="events" :events="events" :itemid="itemid('events')" />
  </div>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import hash from '@/modules/hash'
  import { set, get } from 'idb-keyval'
  import { as_type } from '@/helpers/itemid'
  import profile from '@/helpers/profile'
  import as_days from '@/components/as-days'
  import as_list from '@/components/events/as-list'
  import thought_as_article from '@/components/statements/as-article'
  import {
    Events,
    Statements
  } from '@/persistance/Storage'

  export default {
    components: {
      'as-days': as_days,
      'events-list': as_list,
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
    mounted () {
      firebase.auth().onAuthStateChanged(this.sync)
      window.addEventListener('online', this.online)
    },
    beforeDestroy () {
      this.syncer.terminate()
    },
    methods: {
      itemid (type) {
        if (type) return `${localStorage.me}/${type}`
        else return `${localStorage.me}`
      },
      online () {
        this.sync(firebase.auth().currentUser)
      },
      async sync (current_user) {
        if (current_user) {
          localStorage.me = profile.from_e64(current_user.phoneNumber)
          this.sync_statements()
          this.sync_events()
        }
      },
      async sync_events () {
        const itemid = this.itemid('events')
        const events = new Events()
        this.events = await events.sync()
        await this.$nextTick()
        await this.sync_paged(itemid, events)
        this.events = null
      },
      async sync_statements () {
        const itemid = this.itemid('statements')
        const statements = new Statements()
        this.statements = await statements.sync()
        await this.$nextTick()
        await this.sync_paged(itemid, statements)
        this.statements = null
      },
      async sync_paged (itemid, paged) {
        const query = `[itemid="${itemid}"]`
        const elements = this.$el.querySelector(query)
        if (elements) {
          let index = await get('index')
          if (!index) index = {}
          const current_hash = parseInt(index[itemid])
          const new_hash = hash(elements.outerHTML)
          if (current_hash !== new_hash) {
            await paged.save()
            localStorage.removeItem(`/+/${as_type(itemid)}`)
            index[itemid] = new_hash
            set('index', index)
          }
        }
      }
    }
  }
</script>
