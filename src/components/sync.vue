<template lang="html">
  <div v-if="syncing" ref="sync" hidden>
    <as-hgroup v-if="person" :person="person" />
    <as-days v-if="statements" v-slot="thoughts"
             itemscope :itemid="itemid('statements')"
             :statements="statements">
      <thought-as-article v-for="thought in thoughts" :key="thought[0].id"
                          :statements="thought" />
    </as-days>
    <events-list v-if="events" :events="events" :itemid="itemid('events')" />
    <unsynced-poster v-if="poster" :key="poster.id"
                     :itemid="poster.id" :poster="poster"
                     :immediate="true" />
  </div>
</template>
<script>
  import firebase from 'firebase/app'
  import 'firebase/auth'
  import { set, get } from 'idb-keyval'
  import { visit_interval } from '@/workers/sync'
  import { Events, Statements, Poster, Me } from '@/persistance/Storage'
  import { from_e64 } from '@/helpers/profile'
  import { as_type, list, load } from '@/helpers/itemid'
  import get_item from '@/modules/item'
  import hash from '@/modules/hash'
  import as_days from '@/components/as-days'
  import as_list from '@/components/events/as-list'
  import as_svg from '@/components/posters/as-svg'
  import thought_as_article from '@/components/statements/as-article'
  import as_hgroup from '@/components/profile/as-hgroup'
  export default {
    components: {
      'as-days': as_days,
      'events-list': as_list,
      'thought-as-article': thought_as_article,
      'unsynced-poster': as_svg,
      'as-hgroup': as_hgroup
    },
    props: {
      config: {
        type: Object,
        required: true
      },
      statement: {
        type: Object,
        required: false,
        default: null
      },
      person: {
        type: Object,
        required: false,
        default: null
      }
    },
    data () {
      return {
        syncer: new Worker('/sync.worker.js'),
        syncing: false,
        poster: null,
        statements: [],
        events: null
      }
    },
    watch: {
      async statement () {
        if (this.statement) {
          this.syncing = true
          const itemid = this.itemid('statements')
          this.statements = await list(itemid)
          this.statements.push(this.statement)
          const data = new Statements()
          await this.$nextTick()
          await data.save()
          this.$emit('update:statement', null)
          this.syncing = false
        }
      },
      async person () {
        if (this.person) {
          this.syncing = true
          await this.$nextTick()
          const me = new Me()
          await me.save()
          this.syncing = false
        }
      }
    },
    created () {
      firebase.auth().onAuthStateChanged(this.auth_state_changed)
    },
    beforeDestroy () {
      this.syncer.terminate()
    },
    methods: {
      async auth_state_changed (current_user) {
        if (navigator.onLine && current_user) {
          localStorage.me = from_e64(current_user.phoneNumber)
          this.syncer.addEventListener('message', this.worker_message)
          this.syncer.postMessage({
            action: 'sync:initialize',
            last_sync: localStorage.sync_time,
            config: this.config
          })
          window.addEventListener('online', this.online)
        }
      },
      online () {
        this.syncer.postMessage({ action: 'sync:offline' })
      },
      itemid (type) {
        if (type) return `${localStorage.me}/${type}`
        else return `${localStorage.me}`
      },
      async update_visit () {
        const me = await load(localStorage.me)
        const visit_digit = new Date(me.visited).getTime()
        if (me && visit_interval() > visit_digit) {
          me.visited = new Date().toISOString()
          this.$emit('update:person', me)
        }
      },
      async worker_message (message) {
        this.syncing = true
        switch (message.data.action) {
          case 'sync:happened':
            this.update_visit()
            localStorage.sync_time = new Date().toISOString()
            return
          case 'sync:events':
            return await this.sync_events()
          case 'sync:statements':
            return await this.sync_statements()
          case 'save:poster':
            return await this.save_poster(message.data)
          default:
            console.warn('Unhandled worker action: ', message.data.action, message)
        }
        this.syncing = false
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
      },
      async sync_paged (itemid, paged) {
        const query = `[itemid="${itemid}"]`
        const elements = this.$refs.sync.querySelector(query)
        if (elements) {
          let index = await get('hash')
          if (!index) index = {}
          const current_hash = parseInt(index[itemid])
          const new_hash = hash(elements.outerHTML)
          if (current_hash !== new_hash) {
            await paged.save(elements)
            localStorage.removeItem(`/+/${as_type(itemid)}`)
            index[itemid] = new_hash
            await set('hash', index)
          }
        }
      },
      async save_poster (data) {
        this.poster = get_item(data.outerHTML)
        this.poster.id = data.id
        await this.$nextTick()
        const new_poster = new Poster(this.poster.id)
        await new_poster.save()
        this.poster = null
      }
    }
  }
</script>
