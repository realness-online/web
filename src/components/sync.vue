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
  import hash from '@/modules/hash'
  import { set, get, del } from 'idb-keyval'
  import { as_type, as_created_at, list } from '@/helpers/itemid'
  import get_item from '@/modules/item'
  import { from_e64 } from '@/helpers/profile'
  import as_days from '@/components/as-days'
  import as_list from '@/components/events/as-list'
  import as_svg from '@/components/posters/as-svg'
  import thought_as_article from '@/components/statements/as-article'
  import {
    Events,
    Statements,
    Poster,
    Offline
  } from '@/persistance/Storage'
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
      firebase.auth().onAuthStateChanged(this.sync_local_storage)
      window.addEventListener('online', this.online)
    },
    beforeDestroy () {
      this.syncer.terminate()
    },
    methods: {
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
        this.sync_local_storage(firebase.auth().currentUser)
      },
      async sync_local_storage (current_user) {
        if (navigator.onLine && current_user) {
          console.time('syncing:local-storage')
          this.syncing = true
          localStorage.me = from_e64(current_user.phoneNumber)
          // await Promise.all([
          //   this.sync_statements(),
          //   this.sync_offline(),
          //   this.sync_anonymous_posters(current_user),
          //   this.sync_events()
          // ])
          this.sync_offline()
          this.sync_anonymous_posters(current_user)
          this.sync_events()
          this.sync_statements()
          this.syncing = false
          console.timeEnd('syncing:local-storage')
        }
      },
      async sync_offline () {
        const offline = await get('offline')
        if (!offline) return
        while (offline.length) {
          const item = offline.pop()
          if (item.action === 'save') await new Offline(item.id).save()
          else if (item.action === 'delete') await new Offline(item.id).delete()
          else console.info('unknown offline action', item.action, item.id)
        }
        await del('offline')
      },
      async sync_anonymous_posters (my) {
        const offline_posters = await get('/+/posters/')
        if (!offline_posters || !offline_posters.items) return
        const posters = []
        await Promise.all(offline_posters.items.map(async (created_at) => {
          const poster_as_string = await get(`/+/posters/${created_at}`)
          const poster = get_item(poster_as_string)
          poster.id = `${from_e64(my.phoneNumber)}/posters/${created_at}`
          posters.push(poster)
        }))
        if (posters.length) {
          this.posters = posters
          await this.$nextTick()
          await Promise.all(this.posters.map(async (poster) => {
            const created_at = as_created_at(poster.id)
            const new_poster = new Poster(poster.id)
            await new_poster.save()
            await del(`/+/posters/${created_at}`)
            offline_posters.items = offline_posters.items.filter(when => {
              return parseInt(when) !== created_at
            })
            await set('/+/posters/', offline_posters)
          }))
          this.posters = []
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
