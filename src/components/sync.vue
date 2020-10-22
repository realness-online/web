<template lang="html">
  <div ref="sync" hidden>
    <as-days v-if="show_statements" v-slot="thoughts"
             itemscope
             :itemid="itemid('statements')"
             :statements="statements">
      <thought-as-article v-for="thought in thoughts"
                          :key="thought[0].id"
                          :statements="thought" />
    </as-days>
    <events-list v-if="events" :events="events" :itemid="itemid('events')" />
    <unsynced-posters v-for="poster in posters"
                      :key="poster.id"
                      :immediate="true"
                      :itemid="poster.id"
                      :poster="poster" />
  </div>
</template>
<script>
  import * as firebase from 'firebase/app'
  import 'firebase/auth'
  import { set, get } from 'idb-keyval'
  import { from_e64 } from '@/helpers/profile'
  import { as_type, list } from '@/helpers/itemid'
  import hash from '@/modules/hash'
  import as_days from '@/components/as-days'
  import as_list from '@/components/events/as-list'
  import as_svg from '@/components/posters/as-svg'
  import thought_as_article from '@/components/statements/as-article'
  import { Events, Statements } from '@/persistance/Storage'
  export default {
    components: {
      'as-days': as_days,
      'events-list': as_list,
      'thought-as-article': thought_as_article,
      'unsynced-posters': as_svg
    },
    props: {
      statement: {
        type: Object,
        required: false,
        default: null
      }
    },
    data () {
      return {
        syncer: new Worker('/sync.worker.js'),
        syncing: false,
        person: null,
        posters: null,
        statements: [],
        events: null
      }
    },
    computed: {
      show_statements () {
        if (this.statement) return true
        else if (this.syncing) return true
        return false
      }
    },
    watch: {
      statement () {
        if (this.statement) this.save_statement()
      }
    },
    mounted () {
      firebase.auth().onAuthStateChanged(this.init)
    },
    beforeDestroy () {
      this.syncer.terminate()
    },
    methods: {
      init (current_user) {
        console.log('auth state changed')
        if (navigator.onLine && current_user) {
          localStorage.me = from_e64(current_user.phoneNumber)
          this.syncer.addEventListener('message', this.worker_message)
          this.syncer.postMessage({ action: 'initialize', env: process.env })
          window.addEventListener('online', this.online)
        }
      },
      async save_statement () {
        const itemid = this.itemid('statements')
        this.statements = await list(itemid)
        this.statements.push(this.statement)
        const data = new Statements()
        await this.$nextTick()
        await data.save()
        this.$emit('update:statement', null)
      },
      itemid (type) {
        if (type) return `${localStorage.me}/${type}`
        else return `${localStorage.me}`
      },
      online () {
        this.syncer.postMessage({ action: 'check' })
      },
      worker_message (message) {
        switch (message.data.action) {
          case 'sync:local-storage':
            return this.sync_local_storage(firebase.auth().currentUser)
          default:
            console.warn('Unhandled worker action: ', message.data.action, message)
        }
      },
      async sync_local_storage () {
        if (navigator.onLine) {
          console.time('sync:local-storage')
          this.syncing = true
          await Promise.all([
            this.sync_events(),
            this.sync_statements()
          ])
          this.syncing = false
          console.timeEnd('sync:local-storage')
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
        this.statements = []
      },
      async sync_paged (itemid, paged) {
        const query = `[itemid="${itemid}"]`
        const elements = this.$el.querySelector(query)
        if (elements) {
          let index = await get('hash-index')
          if (!index) index = {}
          const current_hash = parseInt(index[itemid])
          const new_hash = hash(elements.outerHTML)
          if (current_hash !== new_hash) {
            await paged.save()
            localStorage.removeItem(`/+/${as_type(itemid)}`)
            index[itemid] = new_hash
            set('hash-index', index)
          }
        }
      }
    }
  }
</script>
