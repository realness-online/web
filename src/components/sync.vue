<template lang="html">
  <div ref="sync" hidden>
    <as-hgroup v-if="person" :person="person" />
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
  import { Events, Statements, Me } from '@/persistance/Storage'
  import { from_e64 } from '@/helpers/profile'
  import { as_type, list, load } from '@/helpers/itemid'
  import { is_fresh } from '@/helpers/date'
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
      'unsynced-posters': as_svg,
      'as-hgroup': as_hgroup
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
        if (navigator.onLine && current_user) {
          localStorage.me = from_e64(current_user.phoneNumber)
          this.syncer.addEventListener('message', this.worker_message)
          this.syncer.postMessage({ action: 'sync:initialize', env: process.env })
          window.addEventListener('online', this.online)
          this.update_visit(current_user)
      }
      },
      online () {
        this.syncer.postMessage({ action: 'sync:offline' })
        this.update_visist(firebase.auth().currentUser)
      },
      async update_visit (current_user) {
        console.log('update_visit')
        if (navigator.onLine && current_user) {
          const person = await load(localStorage.me)
          if (!is_fresh(person.visited)) {
            person.visited = new Date().toISOString()
            this.person = person
            await this.$nextTick()
            new Me().save()
            this.person = null
          }
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
      async worker_message (message) {
        console.time('worker:message')
        this.syncing = true
        switch (message.data.action) {
          case 'sync:events':
            return await this.sync_events()
          case 'sync:statements':
            return await this.sync_statements()
          case 'save:poster':
            return await this.save_poster(message.data.poster)
          default:
            console.warn('Unhandled worker action: ', message.data.action, message)
        }
        this.syncing = false
        console.timeEnd('worker:message')
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
      },
      async save_poster (poster) {
        // this.posters = posters
        // await this.$nextTick()
        // await Promise.all(this.posters.map(async (poster) => {
        //   const created_at = as_created_at(poster.id)
        //   const new_poster = new Poster(poster.id)
        //   await new_poster.save()
        //   await del(`/+/posters/${created_at}`)
        //   offline_posters.items = offline_posters.items.filter(when => {
        //     return parseInt(when) !== created_at
        //   })
        //   await set('/+/posters/', offline_posters)
        // }))
        this.posters = []
      }
    }
  }
</script>
