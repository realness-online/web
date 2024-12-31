<template>
  <section id="events" class="page">
    <header>
      <logo-as-link />
      <icon name="nothing" />
    </header>
    <h1>Events</h1>
    <icon v-show="working" name="working" />
    <as-days id="tonight" v-slot="items" :paginate="false" :events="events">
      <as-figure v-for="item in items" :key="item.url" :itemid="item.url" />
    </as-days>
    <footer>
      <p class="message">
        You create events from
        <router-link to="/posters">Posters</router-link>
      </p>
    </footer>
  </section>
</template>
<script>
  import { list } from '@/use/itemid'
  import { recent_item_first } from '@/use/sorting'
  import icon from '@/components/icon'
  import logo_as_link from '@/components/logo-as-link'
  import as_days from '@/components/as-days'
  import as_figure from '@/components/posters/as-figure'
  export default {
    components: {
      'logo-as-link': logo_as_link,
      'as-figure': as_figure,
      'as-days': as_days,
      icon
    },
    data() {
      return {
        events: [],
        upcoming: [],
        working: true
      }
    },
    async created() {
      this.events = await this.get_upcoming_events()
      this.working = false
      console.info('views:events', this.events.length)
    },
    methods: {
      async get_upcoming_events() {
        const [relations, my_events] = await Promise.all([
          list(`${localStorage.me}/relations`),
          list(`${localStorage.me}/events`)
        ])
        let events = my_events
        await Promise.all(
          relations.map(async person => {
            const relation_events = await list(`${person.id}/events`)
            events = [...relation_events, ...events]
          })
        )
        events.sort(recent_item_first)
        const now = new Date().getTime()
        events = events.filter(event => event.id > now)
        return events
      }
    }
  }
</script>
<style lang="stylus">
  section#events
    & > header > svg
      width: base-line * 2
      height: base-line * 2
      fill: transparent
    & > h1
      color: green
    & > article
      standard-grid: howdy
      & > figure
        & > svg.background
          fill: green
        & > figcaption menu a
          svg.message
          svg.download
          svg.background
            fill: green
          address > h3,
          address > time
            color: green
      & > header
        max-height: base-line * 6
      @media (min-width: pad-begins)
        & > header > h1
          padding: 0
    & > footer
      display: flex
      flex-direction: column
      justify-content: space-evenly
      align-items: center
      p.message
        padding: 0 base-line
        svg, a, button, span
          border-color: green
          fill: green
          color: green
</style>
