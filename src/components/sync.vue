<template>
  <div ref="sync" hidden>
    <as-address v-if="person" :person="person" />
    <as-days v-if="statements" v-slot="thoughts"
             itemscope :itemid="itemid('statements')"
             :statements="statements" :paginate="false">
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
  import { del, get } from 'idb-keyval'
  import {
    one_hour,
    fresh_metadata,
    hash_options,
    prune,
    sync_offline_actions
  } from '@/persistance/Cloud.sync'
  import { Statements, Events, Poster, Me } from '@/persistance/Storage'

  import { from_e64 } from '@/helpers/profile'
  import { list, load } from '@/helpers/itemid'
  import get_item from '@/modules/item'
  import hash from 'object-hash'
  import as_days from '@/components/as-days'
  import as_list from '@/components/events/as-list'
  import as_svg from '@/components/posters/as-svg'
  import thought_as_article from '@/components/statements/as-article'
  import as_address from '@/components/profile/as-address'
  const eight_hours = one_hour * 8
  export default {
    components: {
      'as-days': as_days,
      'events-list': as_list,
      'thought-as-article': thought_as_article,
      'unsynced-poster': as_svg,
      'as-address': as_address
    },
    props: {
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
    emits: ['update:statement', 'update:person', 'active'],
    data () {
      return {
        poster: null,
        statements: [],
        events: null
      }
    },
    watch: {
      async statement () {
        if (this.statement) {
          await this.$nextTick()
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
    methods: {
      async visibility_change () {
        if (document.visibilityState === 'visible') await this.play()
      },
      async auth_state_changed (me) {
        if (me && navigator.onLine) {
          localStorage.me = from_e64(me.phoneNumber)
          window.addEventListener('online', this.play)
          this.play()
        } else window.removeEventListener('online', this.play)
      },
      itemid (type) {
        if (type) return `${localStorage.me}/${type}`
        else return localStorage.me
      },
      async play () {
        const me = await load(localStorage.me) // check if new user
        if (!me || !firebase.auth().currentUser) return null // let's wait to sync
        await sync_offline_actions()
        let synced
        if (localStorage.sync_time) {
          synced = Date.now() - new Date(localStorage.sync_time).getTime()
        } else synced = eight_hours
        const time_left = eight_hours - synced
        if (time_left <= 0) {
          this.$emit('active', true)
          await Promise.all([
            await prune(),
            await this.sync_me(),
            await this.sync_statements(),
            await this.sync_events(),
            await this.sync_anonymous_posters(),
            await this.sync_happened()
          ])
          this.$emit('active', false)
        }
      },
      async sync_happened () {
        const statements = new Statements()
        await statements.optimize()
        localStorage.sync_time = new Date().toISOString()
        const me = await load(localStorage.me)
        if (!me) return // new user let's wait
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
        let my_info = localStorage.getItem(id)
        if (!my_info) my_info = await get(id)
        if (!my_info || !network) return
        const md5 = hash(my_info, hash_options)
        if (md5 !== network.md5) {
          localStorage.removeItem(id)
          del(id)
        }
      },
      async sync_statements () {
        const statements = new Statements()
        const itemid = this.itemid('statements')
        const network = (await fresh_metadata(itemid)).customMetadata
        const elements = this.$refs.sync.querySelector(`[itemid="${itemid}"]`)
        if (!elements || !elements.outerHTML) return null // nothing local so we'll let it load on request
        const md5 = hash(elements.outerHTML, hash_options)
        if (!network || network.md5 !== md5) {
          this.statements = await statements.sync()
          if (this.statements.length) {
            await this.$nextTick()
            await statements.save(elements)
            localStorage.removeItem('/+/statements')
          }
        }
      },
      async sync_events () {
        const events = new Events()
        const itemid = this.itemid('events')
        const network = (await fresh_metadata(itemid)).customMetadata
        const elements = this.$refs.sync.querySelector(`[itemid="${itemid}"]`)
        if (!elements) return
        const md5 = hash(elements.outerHTML, hash_options)
        if (!network || network.md5 !== md5) {
          this.events = await events.sync()
          if (this.events.length) {
            await this.$nextTick()
            await events.save(elements)
            localStorage.removeItem('/+/events')
          }
        }
      },
      async sync_anonymous_posters () {
        const offline_posters = await get('/+/posters/')
        if (!offline_posters || !offline_posters.items) return
        await Promise.all(offline_posters.items.map(async (created_at) => {
          const poster_string = await get(`/+/posters/${created_at}`)
          this.save_poster({
            id: `${localStorage.me}/posters/${created_at}`,
            outerHTML: poster_string
          })
          await del(`/+/posters/${created_at}`)
        }))
        await del('/+/posters/')
      },
      async save_poster (poster) {
        this.poster = get_item(poster.outerHTML)
        this.poster.id = poster.id
        await this.$nextTick()
        const new_poster = new Poster(this.poster.id)
        await new_poster.save()
        await del(`${localStorage.me}/posters/`)
        this.poster = null
      }
    }
  }
</script>
