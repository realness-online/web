<template>
  <section id="events" class="page">
    <header>
      <icon name="nothing"></icon>
      <logo-as-link></logo-as-link>
    </header>
    <hgroup>
      <icon v-show="working" name="working"></icon>
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
  import { person_storage as me } from '@/persistance/Storage'
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
    data () {
      return {
        events: [],
        upcoming: [],
        working: false,
        days: new Map()
      }
    },
    async created () {
      console.clear()
      console.time('events-load')
      console.info(`${me.as_object().first_name} views realness version ${this.version}`)
      this.events = await this.get_upcoming_events()
      this.working = false
      console.timeEnd('events-load')
    },
    methods: {
      async get_upcoming_events () {
        const relations = me.as_list()

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
      newer_first (earlier, later) {
        return later.id - earlier.id
      }
    }
  }
</script>
<style lang="stylus">
  section#events
    h1
      padding: base-line
      color: green
    & > header
      & > svg
        width: base-line * 2
        height: base-line * 2
        fill: transparent
      & > a
        -webkit-tap-highlight-color: green
    & > article
      display: grid
      grid-gap: base-line
      grid-template-columns: repeat(auto-fit, minmax(poster-min-width, 1fr))
      grid-template-rows: base-line * 22
      & > header
        max-height: base-line * 6
      @media (min-width: pad-begins)
        padding: 0 base-line
        & > header > h1
          padding: 0
      &:first-of-type
        margin-bottom: base-line
      & > figure > svg
        // @media (orientation: portrait)
        //   max-height: calc(100vmin * 1.33)
        // @media (min-height: pad-begins) and (orientation: landscape)
        //   between: max-height 26rem 26rem
        // @media (min-height: typing-begins) and (orientation: landscape)
        //   between: max-height 25rem 30rem
</style>
