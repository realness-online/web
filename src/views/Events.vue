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
  import itemid from '@/helpers/itemid'
  import signed_in from '@/mixins/signed_in'
  import icon from '@/components/icon'
  import logo_as_link from '@/components/logo-as-link'
  import as_figure from '@/components/events/as-figure'
    export default {
    mixins: [signed_in],
    components: {
      'logo-as-link': logo_as_link,
      'event-as-figure': as_figure,
      icon
    },
    data () {
      return {
        me: localStorage.getItem('me'),
        events: [],
        upcoming: [],
        working: true,
        days: new Map()
      }
    },
    async created () {
      console.clear()
      console.time('events-load')
      console.info(`Views realness version ${this.version}`)
      this.events = await this.get_upcoming_events()
      this.working = false
      console.timeEnd('events-load')
    },
    methods: {
      async get_upcoming_events () {
        const [my_rel, my_ev] = await Promise.all([
          itemid.load(`${this.me}/relations`),
          itemid.load(`${this.me}/events`)
        ])
        let events = my_ev.events
        await Promise.all(my_rel.relations.map(async (person) => {
          const relation = await itemid.load(`${person.id}/events`)
          events = [...relation.events, ...events]
        }))
        events.sort(this.newer_first)
        return events
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
</style>
