<template>
  <div ref="sync" hidden>
    <as-address v-if="person" :person="person" />
    <as-days
      v-if="statements"
      v-slot="thoughts"
      itemscope
      :itemid="get_itemid('statements')"
      :statements="statements"
      :paginate="false">
      <thought-as-article
        v-for="thought in thoughts"
        :key="thought[0].id"
        :statements="thought" />
    </as-days>
    <events-list
      v-if="events"
      :events="events"
      :itemid="get_itemid('events')" />
    <unsynced-poster
      v-if="poster"
      :key="poster.id"
      :itemid="poster.id"
      :poster="poster"
      :immediate="true" />
  </div>
</template>
<script setup>
  import AsDays from '@/components/as-days'
  import EventsList from '@/components/events/as-list'
  import UnsyncedPoster from '@/components/posters/as-svg'
  import ThoughtAsArticle from '@/components/statements/as-article'
  import AsAddress from '@/components/profile/as-address'
  import { current_user } from '@/use/serverless'
  import { del, get } from 'idb-keyval'
  import {
    one_hour,
    fresh_metadata,
    hash_options,
    prune,
    sync_offline_actions
  } from '@/persistance/Cloud.sync'
  import { Statements, Events, Poster, Me } from '@/persistance/Storage'
  import { from_e64 } from '@/use/profile'
  import { list, load } from '@/use/itemid'
  import get_item from '@/use/item'
  import hash from 'object-hash'
  import { watch, watchEffect, ref, nextTick as next_tick } from 'vue'

  const sync = ref(null)
  const eight_hours = one_hour * 4
  const props = defineProps({
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
  })
  const emit = defineEmits(['update:statement', 'update:person', 'active'])
  const poster = ref(null)
  const statements = ref([])
  const events = ref(null)

  const visibility_change = async () => {
    if (document.visibilityState === 'visible') await play()
  }
  const get_itemid = type => {
    if (type) return `${localStorage.me}/${type}`
    else return localStorage.me
  }
  const play = async () => {
    const me = await load(localStorage.me) // check if new user
    if (!me || current_user.value === null) return null // let's wait to sync
    await sync_offline_actions()
    let synced
    if (localStorage.sync_time) {
      synced = Date.now() - new Date(localStorage.sync_time).getTime()
    } else synced = eight_hours
    const time_left = eight_hours - synced
    if (time_left <= 0) {
      // setTimeout(async () => {
      emit('active', true)
      await prune()
      await sync_me()
      await sync_statements()
      await sync_events()
      await sync_anonymous_posters()
      await sync_happened()
      emit('active', false)
      // }, 1000)
    }
  }
  const sync_happened = async () => {
    const statements = new Statements()
    await statements.optimize()
    localStorage.sync_time = new Date().toISOString()
    const me = await load(localStorage.me)
    if (!me) return // new user let's wait
    if (!me.visited) me.visited = null
    const visit_gap = Date.now() - new Date(me.visited).getTime()
    if (me && visit_gap > one_hour) {
      me.visited = new Date().toISOString()
      emit('update:person', me)
    }
  }
  const sync_me = async () => {
    const id = get_itemid()
    const network = (await fresh_metadata(id)).customMetadata
    let my_info = localStorage.getItem(id)
    if (!my_info) my_info = await get(id)
    if (!my_info || !network) return
    const md5 = hash(my_info, hash_options)
    if (md5 !== network.md5) {
      localStorage.removeItem(id)
      del(id)
    }
  }
  const sync_statements = async () => {
    const statements = new Statements()
    const itemid = get_itemid('statements')
    const network = (await fresh_metadata(itemid)).customMetadata
    const elements = sync.value.querySelector(`[itemid="${itemid}"]`)
    if (!elements || !elements.outerHTML) return null // nothing local so we'll let it load on request
    const md5 = hash(elements.outerHTML, hash_options)
    if (!network || network.md5 !== md5) {
      statements.value = await statements.sync()
      if (statements.value.length) {
        await next_tick()
        await statements.save(elements)
        localStorage.removeItem('/+/statements')
      }
    }
  }
  const sync_events = async () => {
    const events = new Events()
    const itemid = get_itemid('events')
    const network = (await fresh_metadata(itemid)).customMetadata
    const elements = sync.value.querySelector(`[itemid="${itemid}"]`)
    if (!elements) return
    const md5 = hash(elements.outerHTML, hash_options)
    if (!network || network.md5 !== md5) {
      events.value = await events.sync()
      if (events.value.length) {
        await next_tick()
        await events.save(elements)
        localStorage.removeItem('/+/events')
      }
    }
  }
  const sync_anonymous_posters = async () => {
    const offline_posters = await get('/+/posters/')
    if (!offline_posters || !offline_posters.items) return
    await Promise.all(
      offline_posters.items.map(async created_at => {
        const poster_string = await get(`/+/posters/${created_at}`)
        save_poster({
          id: `${localStorage.me}/posters/${created_at}`,
          outerHTML: poster_string
        })
        await del(`/+/posters/${created_at}`)
      })
    )
    await del('/+/posters/')
  }
  const save_poster = async poster => {
    props.poster.value = get_item(poster.outerHTML)
    props.poster.id = poster.id
    await next_tick()
    const new_poster = new Poster(poster.value.id)
    await new_poster.save()
    await del(`${localStorage.me}/posters/`)
    poster.value = null
  }

  watchEffect(() => {
    if (current_user.value && navigator.onLine) {
      localStorage.me = from_e64(current_user.value.phoneNumber)
      window.addEventListener('online', play)
      play()
    } else window.removeEventListener('online', play)
  })
  watchEffect(async () => {
    if (props.statement) {
      await next_tick()
      const id = get_itemid('statements')
      statements.value = await list(id)
      statements.value.push(props.statement)
      const data = new Statements()
      await next_tick()
      await data.save()
      emit('update:statement', null)
    }
  })
  watchEffect(async () => {
    if (props.person) {
      await next_tick()
      const me = new Me()
      await me.save()
    }
  })
  document.addEventListener('visibilitychange', visibility_change)
</script>
