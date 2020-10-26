<template>
  <section id="events" class="page">
    <header>
      <icon name="nothing" />
      <logo-as-link />
    </header>
    <hgroup>
      <h1>Tonight!</h1>
      <icon v-show="working" name="working" />
    </hgroup>
    <article v-if="events.length" id="tonight">
      <event-as-figure v-for="event in events" :key="event.url" :event="event" />
    </article>
    <hgroup v-else class="message">
      <p><span>Zero</span> public events. You create events from <router-link to="/posters">Posters</router-link>.</p>
      <p>People see them after you <sign-on /></p>
      <h6><a>Watch</a> a video and learn some more</h6>
    </hgroup>
  </section>
</template>
<script>
  import itemid from '@/helpers/itemid'
  import { newer_item_first } from '@/helpers/sorting'
  import signed_in from '@/mixins/signed_in'
  import icon from '@/components/icon'
  import sign_on from '@/components/profile/sign-on'
  import logo_as_link from '@/components/logo-as-link'
  import as_figure from '@/components/events/as-figure'
    export default {
    components: {
      'sign-on': sign_on,
      'logo-as-link': logo_as_link,
      'event-as-figure': as_figure,
      icon
    },
    mixins: [signed_in],
    data () {
      return {
        events: [],
        upcoming: [],
        working: false,
        days: new Map()
      }
    },
    async created () {
      console.time('events-load')
      this.events = await this.get_upcoming_events()
      this.working = false
      console.timeEnd('events-load')
    },
    methods: {
      async get_upcoming_events () {
        const [relations, my_events] = await Promise.all([
          itemid.list(`${localStorage.me}/relations`),
          itemid.list(`${localStorage.me}/events`)
        ])
        let events = my_events
        await Promise.all(relations.map(async (person) => {
          const relation_events = await itemid.list(`${person.id}/events`)
          events = [...relation_events, ...events]
        }))
        events.sort(newer_item_first)
        return events
      }
    }
  }
</script>
<style lang="stylus">
  section#events
    hgroup.message
      svg, a, button, span
        border-color: green
        fill: green
        color: green
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
