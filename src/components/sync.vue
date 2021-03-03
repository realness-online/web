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
  import { del } from 'idb-keyval'
  import { one_hour, fresh_metadata } from '@/workers/sync'
  import { Statements, Poster, Me } from '@/persistance/Storage'
  import { from_e64 } from '@/helpers/profile'
  import { list, load } from '@/helpers/itemid'
  import get_item from '@/modules/item'
  import hash from 'object-hash'
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
        syncing: true,
        poster: null,
        statements: [],
        events: null,
        options: { encoding: 'base64', algorithm: 'md5' }
      }
    },
    watch: {
      async statement () {
        if (this.statement) {
          const itemid = this.itemid('statements')
          this.statements = await list(itemid)
          this.statements.push(this.statement)
          const data = new Statements()
          await this.$nextTick()
          await data.save()
          this.$emit('update:statement', null)
        }
      },
      async person () {
        if (this.person) {
          await this.$nextTick()
          const me = new Me()
          await me.save()
        }
      }
    },
    created () {
      document.addEventListener('visibilitychange', this.visibility_change)
      firebase.auth().onAuthStateChanged(this.auth_state_changed)
    },
    beforeDestroy () {
      this.syncer.terminate()
    },
    methods: {
      visibility_change () {
        const message = { action: 'sync:play', last_sync: localStorage.sync_time }
        if (document.hidden) message.action = 'sync:pause'
        this.syncer.postMessage(message)
      },
      async auth_state_changed (me) {
        if (me && navigator.onLine) {
          localStorage.me = from_e64(me.phoneNumber)
          this.syncer.addEventListener('message', this.worker_message)
          window.addEventListener('online', this.online)
          this.syncer.postMessage({
            action: 'sync:initialize',
            last_sync: localStorage.sync_time,
            config: this.config
          })
        } else {
          this.syncer.removeEventListener('message', this.worker_message)
          window.removeEventListener('online', this.online)
          this.syncer.postMessage({ action: 'sync:pause' })
        }
      },
      online () {
        this.syncer.postMessage({ action: 'sync:offline' })
      },
      itemid (type) {
        if (type) return `${localStorage.me}/${type}`
        else return localStorage.me
      },
      async worker_message (message) {
        switch (message.data.action) {
          case 'sync:me': return await this.sync_me()
          case 'sync:statements': return await this.sync_statements()
          case 'save:poster': return await this.save_poster(message.data.param)
          case 'sync:happened':return await this.sync_happened()
          default: console.warn('Unhandled worker action: ', message.data.action)
        }
      },
      async sync_happened () {
        localStorage.sync_time = new Date().toISOString()
        const me = await load(localStorage.me)
        if (!me.visited) me.visited = null
        const visit_gap = Date.now() - new Date(me.visited).getTime()
        if (me && visit_gap > one_hour) {
          me.visited = new Date().toISOString()
          this.$emit('update:person', me)
        }
      },
      async sync_me () {
        const id = this.itemid()
        const network = (await fresh_metadata(id)).customMetadata
        const my_info = localStorage.getItem(id)
        if (!my_info || network.md5 == null) return
        const md5 = hash(my_info, this.options)
        if (md5 !== network.md5) {
          console.log('sync_me: remove local')
          localStorage.removeItem(id)
          del(id)
        }
      },
      async sync_statements () {
        const statements = new Statements()
        const itemid = this.itemid('statements')
        const network = (await fresh_metadata(itemid)).customMetadata
        const elements = this.$refs.sync.querySelector(`[itemid="${itemid}"]`)
        if (network.md5 && elements) {
          const md5 = hash(elements.outerHTML, this.options)
          if (md5 === network.md5) return
          this.statements = await statements.sync()
          if (this.statements.length) {
            await this.$nextTick()
            await statements.save(elements)
            localStorage.removeItem('/+/statements')
          }
        }
      },
      async save_poster (data) {
        this.poster = get_item(data.outerHTML)
        this.poster.id = data.id
        await this.$nextTick()
        const new_poster = new Poster(this.poster.id)
        await new_poster.save()
        await del(`${localStorage.me}/posters/`)
        this.poster = null
      }
    }
  }
</script>
