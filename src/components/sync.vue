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
  import { set, get, del } from 'idb-keyval'
  import { as_type, get_item, as_created_at } from '@/helpers/itemid'
  import { from_e64 } from '@/helpers/profile'
  import as_days from '@/components/as-days'
  import as_list from '@/components/events/as-list'
  import thought_as_article from '@/components/statements/as-article'
  import {
    Events,
    Statements,
    Posters
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
        if (navigator.online && current_user) {
          localStorage.me = from_e64(current_user.phoneNumber)
          this.sync_statements()
          this.sync_events()
        }
      },
      async sync_offline_posters (my) {
        const posters = []
        const offline_posters = get('/+/posters/')
        offline_posters.items.forEach(async (created_at) => {
          const poster_as_string = await get(`/+/posters/${created_at}`)
          const poster = get_item(poster_as_string)
          poster.id = `${from_e64(my.phoneNumber)}/posters/${created_at}`
          posters.push(poster)
        })
        if (posters.length) {
          this.posters = posters
          await this.$nextTick()
          this.posters.forEach(async (poster) => {
            const created_at = as_created_at(poster.id)
            const new_poster = new Posters(poster.id)
            await new_poster.save()
            del(`/+/posters/${created_at}`)
            offline_posters.items.filter(when => parseInt(when) !== created_at)
            set('/+/posters/', offline_posters)
          })
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
