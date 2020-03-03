<template>
  <section id="events" class="page">
    <header>
      <icon name="nothing"></icon>
      <logo-as-link></logo-as-link>
    </header>
    <hgroup>
      <icon v-show="working" name="working"></icon>
      <h6 class="app_version">{{version}}</h6>
    </hgroup>
    <article id="tonight">
      <header>
        <h1>Tonight!</h1>
      </header>
      <event-as-figure v-for="event in events" :event="event" :key="event.url"></event-as-figure>
    </article>
    <article id="upcoming">
      <header>
        <h1>Soon</h1>
      </header>
      <event-as-figure v-for="event in events" :event="event" :key="event.url"></event-as-figure>
    </article>
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
        upcoming: [],
        working: false,
        days: new Map()
      }
    },
    async created() {
      console.clear()
      console.time('events-load')
      console.info(`${me.as_object().first_name} views realness version ${this.version}`)
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
      bottom: (base-line / 2)
      left: (base-line / 2)
    h1
      padding: base-line
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
    & > article
      display: grid
      grid-gap: base-line
      grid-template-columns: repeat(auto-fit, minmax(min-poster, 1fr))
      grid-template-rows: repeat(auto-fit, minmax(min-poster, 1fr))
      @media (min-width: pad-begins)
        padding: 0 base-line
      &:first-of-type
        margin-bottom: base-line
</style>
