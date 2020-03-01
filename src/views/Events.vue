<template>
  <section id="events" class="page">
    <header>
      <icon name="nothing"></icon>
      <logo-as-link></logo-as-link>
    </header>
    <hgroup>
      <h1>Tonight!</h1>
      <icon v-show="working" name="working"></icon>
      <h6 class="app_version">{{version}}</h6>
    </hgroup>
    <event-as-figure v-for="event in events" :event="event" :key="event.url"></event-as-figure>
  </section>
</template>
<script>
  import { relations_storage, person_storage as me } from '@/persistance/Storage'
  import profile from '@/helpers/profile'
  import signed_in from '@/mixins/signed_in'
  import logo_as_link from '@/components/logo-as-link'
  import as_figure from '@/components/events/as-figure'
  import icon from '@/components/icon'
  export default {
    mixins: [signed_in],
    components: {
      'logo-as-link': logo_as_link,
      'event-as-figure': as_figure,
      icon
    },
    data() {
      return {
        version: process.env.VUE_APP_VERSION,
        events: [],
        working: true,
        days: new Map()
      }
    },
    async created() {
      console.clear()
      console.time('events-load')
      this.events = await this.get_upcoming_events()
      this.working = false
      console.timeEnd('events-load')
    },
    methods: {
      async get_upcoming_events() {
        const relations = relations_storage.as_list()
        relations.push(me.as_object())
        let events = []
        await Promise.all(relations.map(async (relation) => {
          const relation_events = await profile.items(relation.id, 'events/index')
          events = [...relation_events, ...events]
        }))
        events.sort(this.newer_first)
        return events
        // sort events into nights
        // filter out any events that already happened
        // events.forEach(event => this.insert_event_into_day(event, this.days))
      },
      newer_first(earlier, later) {
        return later.id - earlier.id
      }
    }
  }
</script>
<style lang="stylus">
  section#events
    & > hgroup > h6.app_version
      margin: 0
      padding: 0
      position: fixed
      bottom: 0
      left: (base-line / 2)
    h1
      color: green
    & > header
      margin: auto
      @media (min-width: typing-begins)
        max-width: page-width
      & > svg
        width: base-line * 2
        height: base-line * 2
        fill: transparent
      & > a
        -webkit-tap-highlight-color: green
    & > figure
      display: grid
      grid-template-columns: repeat(auto-fit, minmax(base-line * 12, 1fr))
      grid-gap: base-line
      @media (min-width: pad-begins)
        padding: 0 base-line
      & > svg
        display: block
        width: 100%
        min-height: 66vh
        height: inherit

</style>
